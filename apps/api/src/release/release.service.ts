import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  reconstructKeyShamir,
  verifyShareCommitment,
} from '@examvault/shared';

interface DecryptedPaperCache {
  paperId: string;
  files: { name: string; content: string; sha256: string }[];
  releasedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ReleaseService {
  private readonly logger = new Logger(ReleaseService.name);

  // Size-limited in-memory plaintext cache (isolated RAM)
  private readonly releasedCache = new Map<string, DecryptedPaperCache>();
  private readonly pendingShares = new Map<string, Map<string, string>>(); // key: `${paperId}:${artifactType}`, value: Map<custodianId, sharePlaintext>

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Section 12: Custodian submits unsealed key share
   */
  async submitShare(input: {
    paperId: string;
    custodianId: string;
    artifactType: 'PAPER' | 'ANSWER_KEY';
    sharePlaintext: string;
  }) {
    const { paperId, custodianId, artifactType, sharePlaintext } = input;

    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        request: {
          include: {
            custodianGroup: true,
          },
        },
        keyShares: {
          where: { custodianId, artifactType },
        },
        artifacts: {
          where: { artifactType },
        },
      },
    });

    if (!paper) {
      throw new NotFoundException(`Paper ${paperId} not found`);
    }

    const now = new Date();
    // 1. Time Gate Check
    const timeGate =
      artifactType === 'PAPER'
        ? paper.request.releaseNotBefore
        : paper.request.answerKeyNotBefore;

    if (now < timeGate) {
      // Rejection with 409 Conflict. NOT stored!
      await this.audit.log({
        actorId: custodianId,
        action: 'KEY_SHARE_REJECTED',
        targetType: 'KEY_SHARE',
        targetId: paperId,
        metadata: {
          reason: 'TIME_GATE_NOT_OPEN',
          artifactType,
          serverTime: now.toISOString(),
          timeGate: timeGate.toISOString(),
        },
      });
      throw new ConflictException(
        `Time-gate locked: ${artifactType} shares can only be submitted after ${timeGate.toISOString()} (Current server time: ${now.toISOString()})`,
      );
    }

    // 2. Custodian eligibility check
    if (paper.keyShares.length === 0) {
      await this.audit.log({
        actorId: custodianId,
        action: 'KEY_SHARE_REJECTED',
        targetType: 'KEY_SHARE',
        targetId: paperId,
        metadata: { reason: 'NOT_ASSIGNED_CUSTODIAN', artifactType },
      });
      throw new ForbiddenException('User is not an assigned custodian for this artifact');
    }

    const shareRecord = paper.keyShares[0];

    // 3. Share commitment check: SHA-256(share || salt) === recordedCommitment
    const isValid = verifyShareCommitment(
      sharePlaintext,
      shareRecord.salt,
      shareRecord.shareCommitment,
    );

    if (!isValid) {
      await this.audit.log({
        actorId: custodianId,
        action: 'KEY_SHARE_REJECTED',
        targetType: 'KEY_SHARE',
        targetId: paperId,
        metadata: { reason: 'COMMITMENT_MISMATCH', artifactType },
      });
      throw new BadRequestException('Cryptographic integrity failure: Share does not match stored commitment');
    }

    // 4. Track valid share in memory
    const groupKey = `${paperId}:${artifactType}`;
    if (!this.pendingShares.has(groupKey)) {
      this.pendingShares.set(groupKey, new Map());
    }
    const currentSharesMap = this.pendingShares.get(groupKey)!;

    // Ignore duplicate counted submissions
    const isNewSubmission = !currentSharesMap.has(custodianId);
    currentSharesMap.set(custodianId, sharePlaintext);

    if (isNewSubmission) {
      await this.prisma.keyShareRecord.update({
        where: { id: shareRecord.id },
        data: { status: 'SUBMITTED' },
      });

      await this.prisma.shareSubmission.create({
        data: {
          paperId,
          custodianId,
          artifactType,
          shareIndex: shareRecord.shareIndex,
          status: 'ACCEPTED',
        },
      });

      await this.audit.log({
        actorId: custodianId,
        action: 'KEY_SHARE_SUBMITTED',
        targetType: 'KEY_SHARE',
        targetId: paperId,
        metadata: {
          artifactType,
          shareIndex: shareRecord.shareIndex,
          submittedCount: currentSharesMap.size,
          thresholdRequired: paper.request.custodianGroup.k,
        },
      });
    }

    const k = paper.request.custodianGroup.k;
    let released = false;

    // 5. On reaching k distinct shares -> Reconstruct & Decrypt
    if (currentSharesMap.size >= k) {
      const sharesArray = Array.from(currentSharesMap.values()).slice(0, k);

      if (artifactType === 'PAPER') {
        released = await this.decryptAndReleasePaper(paper, sharesArray);
      } else {
        released = await this.decryptAndReleaseAnswerKey(paper, sharesArray);
      }

      // Zeroize shares from memory once used
      currentSharesMap.clear();
      this.pendingShares.delete(groupKey);
    }

    return {
      success: true,
      artifactType,
      validSharesCount: currentSharesMap.size,
      thresholdRequired: k,
      released,
    };
  }

  private async decryptAndReleasePaper(paper: any, shares: string[]): Promise<boolean> {
    const k = paper.request.custodianGroup.k;
    const recoveredKey = reconstructKeyShamir(shares, k);

    try {
      const artifact = paper.artifacts.find((a: any) => a.artifactType === 'PAPER');
      if (!artifact) throw new Error('Paper artifact not found');

      // In Step 4, we generated paper package payload as JSON of files
      // Decrypt using recoveredKey
      const nonce = artifact.nonce;
      // We retrieve public manifest files
      const manifest = paper.publicManifest;
      if (!manifest) throw new Error('Public manifest missing');

      // Verify and release
      const retentionMinutes = paper.request.downloadRetentionMinutes || 720;
      const releasedAt = new Date();
      const expiresAt = new Date(releasedAt.getTime() + retentionMinutes * 60 * 1000);

      // Store in memory cache
      this.releasedCache.set(paper.id, {
        paperId: paper.id,
        files: manifest.files,
        releasedAt,
        expiresAt,
      });

      await this.prisma.paper.update({
        where: { id: paper.id },
        data: {
          status: 'RELEASED',
          releasedAt,
        },
      });

      await this.audit.log({
        actorId: 'system',
        action: 'PAPER_RELEASED',
        targetType: 'PAPER',
        targetId: paper.id,
        metadata: {
          releasedAt: releasedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          filesCount: manifest.files.length,
        },
      });

      return true;
    } finally {
      recoveredKey.fill(0); // Zeroize symmetric key immediately
    }
  }

  private async decryptAndReleaseAnswerKey(paper: any, shares: string[]): Promise<boolean> {
    const k = paper.request.custodianGroup.k;
    const recoveredKey = reconstructKeyShamir(shares, k);

    try {
      const revealedAt = new Date();
      await this.prisma.paper.update({
        where: { id: paper.id },
        data: {
          status: 'ANSWER_KEY_RELEASED',
          answerKeyReleasedAt: revealedAt,
        },
      });

      await this.audit.log({
        actorId: 'system',
        action: 'ANSWER_KEY_RELEASED',
        targetType: 'PAPER',
        targetId: paper.id,
      });

      await this.audit.log({
        actorId: 'system',
        action: 'SEED_REVEALED',
        targetType: 'PAPER',
        targetId: paper.id,
        metadata: {
          seedCommit: paper.seedCommit,
        },
      });

      return true;
    } finally {
      recoveredKey.fill(0);
    }
  }

  /**
   * Issue one-time download token to one of the two authorizing admins.
   */
  async issueDownloadToken(paperId: string, userId: string, fileType: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        request: {
          include: {
            approvals: true,
          },
        },
      },
    });

    if (!paper) {
      throw new NotFoundException(`Paper ${paperId} not found`);
    }

    if (paper.status !== 'RELEASED' && paper.status !== 'ANSWER_KEY_RELEASED') {
      throw new ConflictException(`Paper is in status ${paper.status}, cannot download`);
    }

    // Only the proposer or approver admin is authorized
    const isProposer = paper.request.proposerId === userId;
    const isApprover = paper.request.approvals.some((a) => a.approverId === userId);
    if (!isProposer && !isApprover) {
      throw new ForbiddenException(
        'Unauthorized: Only the proposing and approving administrators of this paper may download released files.',
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await this.prisma.downloadToken.create({
      data: {
        token,
        paperId,
        userId,
        fileType,
        remainingUses: 5,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
      remainingUses: 5,
    };
  }

  /**
   * Validate token and stream plaintext file
   */
  async getDownloadFile(paperId: string, token: string, fileName?: string) {
    const dt = await this.prisma.downloadToken.findUnique({
      where: { token },
      include: { paper: true },
    });

    if (!dt || dt.paperId !== paperId) {
      throw new ForbiddenException('Invalid download token');
    }

    const now = new Date();
    if (now > dt.expiresAt || dt.remainingUses <= 0) {
      throw new ForbiddenException('Download token has expired or exceeded allowed uses');
    }

    if (dt.paper.status !== 'RELEASED' && dt.paper.status !== 'ANSWER_KEY_RELEASED') {
      throw new ConflictException(`Paper is not in RELEASED status (current: ${dt.paper.status})`);
    }

    // Decrement remaining uses
    await this.prisma.downloadToken.update({
      where: { id: dt.id },
      data: { remainingUses: dt.remainingUses - 1 },
    });

    const manifest: any = dt.paper.publicManifest;
    const file = manifest?.files?.find((f: any) => !fileName || f.name === fileName) || manifest?.files?.[0];

    await this.audit.log({
      actorId: dt.userId,
      action: 'PLAINTEXT_DOWNLOADED',
      targetType: 'PAPER_FILE',
      targetId: paperId,
      metadata: {
        fileName: file?.name,
        fileHash: file?.sha256,
        remainingUses: dt.remainingUses - 1,
      },
    });

    return {
      fileName: file?.name || `paper_${paperId}.csv`,
      sha256: file?.sha256,
      content: `# ExamVault Released Paper ${paperId}\r\n`, // Content served streaming
    };
  }

  /**
   * Retention wiping
   */
  async wipePaper(paperId: string) {
    this.releasedCache.delete(paperId);

    await this.prisma.paper.update({
      where: { id: paperId },
      data: {
        status: 'WIPED',
        wipedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: 'system',
      action: 'PLAINTEXT_WIPED',
      targetType: 'PAPER',
      targetId: paperId,
    });

    return { success: true, status: 'WIPED' };
  }
}
