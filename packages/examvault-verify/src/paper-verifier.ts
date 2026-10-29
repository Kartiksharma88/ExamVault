import * as crypto from 'crypto';
import { canonicalizeJson } from '@examvault/audit-canonical';
import { validatePaper, Blueprint, CandidateMetadata } from '@examvault/shared';

export interface PaperVerificationInput {
  paperId: string;
  status: string;
  publicManifest: {
    paperId: string;
    examId: string;
    blueprintVersionHash: string;
    setsCount: number;
    files: Array<{
      name: string;
      sha256: string;
      sizeBytes: number;
    }>;
    validationSummary: any;
    serverSignature: string;
  };
  serverPublicKey: string; // Ed25519 SPKI DER in base64 or PEM
  paperHash: string;
  blueprint: Blueprint;
  request: {
    requestId: string;
    proposerId: string;
    approverId: string;
    requestHash: string;
    approverSignature: string;
    approverPublicKey: string;
  };
  auditTrail: {
    sealedEventHash?: string;
    fabricAnchored: boolean;
    signedLogAnchored: boolean;
  };
  // Post-release details
  sealedManifest?: {
    paperId: string;
    items: Array<CandidateMetadata>;
    seedReveal?: {
      seed: string;
      salt: string;
    };
  };
  sealedManifestCiphertext?: string;
  sealedManifestCiphertextSha256?: string;
  seedCommit?: string;
}

export interface PaperCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface PaperVerificationReport {
  paperId: string;
  checkedAt: string;
  overallValid: boolean;
  checks: PaperCheckResult[];
}

export class PaperVerifier {
  verify(input: PaperVerificationInput): PaperVerificationReport {
    const checks: PaperCheckResult[] = [];

    // 1. Check Public Manifest Hash
    const manifestWithoutSig = { ...input.publicManifest };
    delete (manifestWithoutSig as any).serverSignature;
    const canonicalManifest = canonicalizeJson(manifestWithoutSig);
    const computedPaperHash = crypto
      .createHash('sha256')
      .update(canonicalManifest)
      .digest('hex');

    const manifestMatches = computedPaperHash === input.paperHash;
    checks.push({
      checkName: 'PUBLIC_MANIFEST_HASH',
      passed: manifestMatches,
      message: manifestMatches
        ? `Canonical manifest SHA-256 matches paperHash (${input.paperHash})`
        : `Manifest hash mismatch: expected ${input.paperHash}, computed ${computedPaperHash}`,
    });

    // 2. Server Ed25519 Signature over Paper Hash
    let serverSigPassed = false;
    try {
      const pubKey = crypto.createPublicKey({
        key: Buffer.from(input.serverPublicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
      serverSigPassed = crypto.verify(
        null,
        Buffer.from(input.paperHash, 'hex'),
        pubKey,
        Buffer.from(input.publicManifest.serverSignature, 'base64'),
      );
    } catch (err: any) {
      serverSigPassed = false;
    }
    checks.push({
      checkName: 'SERVER_ED25519_SIGNATURE',
      passed: serverSigPassed,
      message: serverSigPassed
        ? 'Server Ed25519 digital signature valid over paper hash'
        : 'Invalid or malformed server Ed25519 signature',
    });

    // 3. Two Distinct Admin Signatures
    const distinctAdmins =
      input.request.proposerId !== input.request.approverId &&
      Boolean(input.request.proposerId) &&
      Boolean(input.request.approverId);

    let approverSigPassed = false;
    try {
      const approverKey = crypto.createPublicKey({
        key: Buffer.from(input.request.approverPublicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
      approverSigPassed = crypto.verify(
        null,
        Buffer.from(input.request.requestHash, 'hex'),
        approverKey,
        Buffer.from(input.request.approverSignature, 'base64'),
      );
    } catch {
      approverSigPassed = false;
    }

    const dualAdminPassed = distinctAdmins && approverSigPassed;
    checks.push({
      checkName: 'DUAL_ADMIN_APPROVAL',
      passed: dualAdminPassed,
      message: dualAdminPassed
        ? `Verified distinct proposer (${input.request.proposerId}) and approver (${input.request.approverId}) with valid signature`
        : `Dual admin requirement failed (distinct: ${distinctAdmins}, signature: ${approverSigPassed})`,
    });

    // 4. Dual Audit Trail Anchoring (Fabric + Signed Log)
    const dualAuditPassed =
      input.auditTrail.fabricAnchored && input.auditTrail.signedLogAnchored;
    checks.push({
      checkName: 'DUAL_AUDIT_ANCHORING',
      passed: dualAuditPassed,
      message: dualAuditPassed
        ? 'Anchored in dual immutable ledgers: Hyperledger Fabric consensus & local signed hash chain'
        : `Audit anchoring incomplete (Fabric: ${input.auditTrail.fabricAnchored}, Signed Log: ${input.auditTrail.signedLogAnchored})`,
    });

    // 5. Sealed Manifest Ciphertext Hash (if present)
    if (input.sealedManifestCiphertext && input.sealedManifestCiphertextSha256) {
      const computedCiphertextHash = crypto
        .createHash('sha256')
        .update(Buffer.from(input.sealedManifestCiphertext, 'hex'))
        .digest('hex');

      const cipherHashMatches =
        computedCiphertextHash === input.sealedManifestCiphertextSha256;
      checks.push({
        checkName: 'SEALED_MANIFEST_CIPHERTEXT_HASH',
        passed: cipherHashMatches,
        message: cipherHashMatches
          ? 'Ciphertext SHA-256 matches recorded commitment in paper artifact'
          : `Ciphertext hash mismatch: expected ${input.sealedManifestCiphertextSha256}, computed ${computedCiphertextHash}`,
      });
    }

    // 6. Independent TypeScript Validator Rerun (Post-release)
    if (input.sealedManifest) {
      const selectedIds = input.sealedManifest.items.map((i) => i.version_id);
      const validation = validatePaper(
        input.blueprint,
        selectedIds,
        input.sealedManifest.items,
      );

      checks.push({
        checkName: 'INDEPENDENT_VALIDATOR_RERUN',
        passed: validation.valid,
        message: validation.valid
          ? `Independent validator passed all blueprint quotas (total questions: ${validation.summary.totalQuestions}, marks: ${validation.summary.totalMarks}, mean difficulty: ${validation.summary.meanDifficulty})`
          : `Independent validation failed: ${validation.errors.join('; ')}`,
      });
    }

    // 7. Seed Commitment Verification (Post Answer-Key Release)
    if (input.sealedManifest?.seedReveal && input.seedCommit) {
      const { seed, salt } = input.sealedManifest.seedReveal;
      const computedCommit = crypto
        .createHash('sha256')
        .update(seed + salt)
        .digest('hex');

      const seedMatches = computedCommit === input.seedCommit;
      checks.push({
        checkName: 'SEED_COMMITMENT_VERIFICATION',
        passed: seedMatches,
        message: seedMatches
          ? 'Revealed PRNG seed and salt correctly hash to public seedCommit'
          : `Seed commitment failed: expected ${input.seedCommit}, computed ${computedCommit}`,
      });
    }

    const overallValid = checks.every((c) => c.passed);

    return {
      paperId: input.paperId,
      checkedAt: new Date().toISOString(),
      overallValid,
      checks,
    };
  }
}
