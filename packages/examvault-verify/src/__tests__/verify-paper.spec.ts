import * as crypto from 'crypto';
import { canonicalizeJson } from '@examvault/audit-canonical';
import { Blueprint } from '@examvault/shared';
import { PaperVerifier, PaperVerificationInput } from '../paper-verifier';

describe('PaperVerifier (Step 4 & 5 Independent Auditor Verification)', () => {
  const verifier = new PaperVerifier();

  // Helper to generate Ed25519 keypair
  function makeEd25519() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    return {
      privateKey,
      publicKeyB64: pubDer.toString('base64'),
    };
  }

  const serverKeys = makeEd25519();
  const approverKeys = makeEd25519();

  const dummyBlueprint: Blueprint = {
    examId: 'exam-001',
    name: 'Auditor Test Blueprint',
    durationSeconds: 3600,
    totalQuestions: 2,
    totalMarks: 8,
    sections: [
      {
        code: 'SEC1',
        name: 'Section 1',
        subjectId: 'sub1',
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [{ topicId: 'top1', min: 0, max: 2 }],
        difficultyBins: {
          EASY: { min: 0, max: 2 },
          MEDIUM: { min: 0, max: 2 },
          HARD: { min: 0, max: 2 },
        },
        allowedMarksValues: [4],
      },
    ],
    difficulty: { targetMean: 50, meanTolerance: 30 },
    time: { minRatio: 0.1, maxRatio: 1.0 },
    exposure: {
      maxTotalUses: 5,
      cooldownPapers: 1,
      overlap: { recentPapersM: 2, maxSharedQuestionsPerPaper: 2 },
    },
    sets: { count: 1 },
    solver: { timeLimitSeconds: 10, requireOptimal: false, minPoolMultiplier: 1.0 },
    csv: { bom: true, formulaGuard: true, profileDefault: 'OFFLINE_QUESTION_PAPER', includeSolutions: false },
  };

  const seed = 'test-seed-hex-123456';
  const salt = 'test-salt-hex-abcdef';
  const seedCommit = crypto
    .createHash('sha256')
    .update(seed + salt)
    .digest('hex');

  const requestHash = crypto.createHash('sha256').update('canonical-req-data').digest('hex');
  const approverSig = crypto
    .sign(null, Buffer.from(requestHash, 'hex'), approverKeys.privateKey)
    .toString('base64');

  const publicManifestNoSig = {
    paperId: 'paper-999',
    examId: 'exam-001',
    blueprintVersionHash: 'bp-hash-123',
    setsCount: 1,
    files: [{ name: 'paper_set_A.csv', sha256: 'abcd1234', sizeBytes: 1024 }],
    validationSummary: { totalQuestions: 2, totalMarks: 8 },
  };

  const canonicalManifestForHash = canonicalizeJson(publicManifestNoSig);
  const paperHash = crypto.createHash('sha256').update(canonicalManifestForHash).digest('hex');
  const serverSig = crypto
    .sign(null, Buffer.from(paperHash, 'hex'), serverKeys.privateKey)
    .toString('base64');

  const validPublicManifest = {
    ...publicManifestNoSig,
    serverSignature: serverSig,
  };

  const validCiphertext = 'deadbeefcafebabe';
  const validCiphertextSha256 = crypto
    .createHash('sha256')
    .update(Buffer.from(validCiphertext, 'hex'))
    .digest('hex');

  const validItems = [
    {
      version_id: 'qv-1',
      question_id: 'q-1',
      section_code: 'SEC1',
      subject_id: 'sub1',
      topic_id: 'top1',
      type: 'MCQ_SINGLE' as const,
      marks: 4,
      final_difficulty: 40,
      final_time_seconds: 200,
    },
    {
      version_id: 'qv-2',
      question_id: 'q-2',
      section_code: 'SEC1',
      subject_id: 'sub1',
      topic_id: 'top1',
      type: 'MCQ_SINGLE' as const,
      marks: 4,
      final_difficulty: 60,
      final_time_seconds: 200,
    },
  ];

  function makeValidInput(): PaperVerificationInput {
    return {
      paperId: 'paper-999',
      status: 'RELEASED',
      publicManifest: { ...validPublicManifest },
      serverPublicKey: serverKeys.publicKeyB64,
      paperHash: paperHash,
      blueprint: dummyBlueprint,
      request: {
        requestId: 'req-001',
        proposerId: 'admin-1',
        approverId: 'admin-2',
        requestHash,
        approverSignature: approverSig,
        approverPublicKey: approverKeys.publicKeyB64,
      },
      auditTrail: {
        fabricAnchored: true,
        signedLogAnchored: true,
      },
      sealedManifest: {
        paperId: 'paper-999',
        items: [...validItems],
        seedReveal: { seed, salt },
      },
      sealedManifestCiphertext: validCiphertext,
      sealedManifestCiphertextSha256: validCiphertextSha256,
      seedCommit,
    };
  }

  it('passes all 7 checks on a completely valid released paper bundle', () => {
    const input = makeValidInput();
    const report = verifier.verify(input);

    expect(report.overallValid).toBe(true);
    expect(report.checks.length).toBe(7);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails if public manifest hash is altered', () => {
    const input = makeValidInput();
    input.paperHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const report = verifier.verify(input);
    expect(report.overallValid).toBe(false);
    const hashCheck = report.checks.find((c) => c.checkName === 'PUBLIC_MANIFEST_HASH');
    expect(hashCheck?.passed).toBe(false);
  });

  it('fails if dual admin control is violated (proposer === approver)', () => {
    const input = makeValidInput();
    input.request.approverId = 'admin-1'; // Same as proposerId

    const report = verifier.verify(input);
    expect(report.overallValid).toBe(false);
    const dualAdminCheck = report.checks.find((c) => c.checkName === 'DUAL_ADMIN_APPROVAL');
    expect(dualAdminCheck?.passed).toBe(false);
  });

  it('fails if dual audit trail is missing Fabric anchoring', () => {
    const input = makeValidInput();
    input.auditTrail.fabricAnchored = false;

    const report = verifier.verify(input);
    expect(report.overallValid).toBe(false);
    const auditCheck = report.checks.find((c) => c.checkName === 'DUAL_AUDIT_ANCHORING');
    expect(auditCheck?.passed).toBe(false);
  });

  it('fails if revealed PRNG seed does not hash to seed commitment', () => {
    const input = makeValidInput();
    input.sealedManifest!.seedReveal!.seed = 'tampered-seed';

    const report = verifier.verify(input);
    expect(report.overallValid).toBe(false);
    const seedCheck = report.checks.find((c) => c.checkName === 'SEED_COMMITMENT_VERIFICATION');
    expect(seedCheck?.passed).toBe(false);
  });

  it('fails if independent validator detects violation of marks or quota', () => {
    const input = makeValidInput();
    // Total marks required is 8; change item marks to 1 so total is 5
    input.sealedManifest!.items[0].marks = 1;

    const report = verifier.verify(input);
    expect(report.overallValid).toBe(false);
    const valCheck = report.checks.find((c) => c.checkName === 'INDEPENDENT_VALIDATOR_RERUN');
    expect(valCheck?.passed).toBe(false);
  });
});
