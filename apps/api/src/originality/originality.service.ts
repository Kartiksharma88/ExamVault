import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { PoliciesService } from '../policies/policies.service';
import { ReviewService } from '../review/review.service';
import { DuplicateDispositionInput } from '@examvault/shared';

@Injectable()
export class OriginalityService implements OnModuleInit {
  private readonly logger = new Logger(OriginalityService.name);
  private readonly serviceUrl: string;
  private readonly serviceToken: string;

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
    private policies: PoliciesService,
    private config: ConfigService,
    @Inject(forwardRef(() => ReviewService))
    private reviewService: ReviewService,
  ) {
    this.serviceUrl = this.config.get<string>('ORIGINALITY_SERVICE_URL', 'http://localhost:8000');
    this.serviceToken = this.config.get<string>(
      'ORIGINALITY_SERVICE_TOKEN',
      'examvault_internal_secret_token_dev',
    );
  }

  async onModuleInit() {
    // Attempt async initial feed sync after brief startup delay
    setTimeout(() => {
      this.syncBankIndex().catch((err) => {
        this.logger.warn(`Initial index sync deferred: ${err.message}`);
      });
    }, 3000);
  }

  /**
   * Check health of Python originality service
   */
  private getServiceUrl(path: string): string {
    const base = (
      process.env.ORIGINALITY_SERVICE_URL ||
      this.config.get<string>('ORIGINALITY_SERVICE_URL') ||
      this.serviceUrl
    ).replace(/\/$/, '');
    const cleanPath = path.replace(/^\//, '');
    return `${base}/${cleanPath}`;
  }

  async checkHealth(): Promise<{
    status: string;
    service: string;
    indexedDocumentsCount: number;
    networkIsolationActive: boolean;
    available: boolean;
  }> {
    try {
      const res = await fetch(this.getServiceUrl('health'), {
        headers: { Authorization: `Bearer ${this.serviceToken}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        return { ...data, available: true } as any;
      }
      return {
        status: 'UNHEALTHY',
        service: 'originality-service',
        indexedDocumentsCount: 0,
        networkIsolationActive: true,
        available: false,
      };
    } catch (err: any) {
      return {
        status: 'OFFLINE',
        service: 'originality-service',
        indexedDocumentsCount: 0,
        networkIsolationActive: true,
        available: false,
      };
    }
  }

  /**
   * Populate in-memory originality index with all bank questions and imported corpus
   */
  async syncBankIndex(): Promise<{ syncedBank: number; syncedCorpus: number }> {
    const health = await this.checkHealth();
    if (!health.available) {
      this.logger.warn('Cannot sync bank index: originality-service is offline');
      return { syncedBank: 0, syncedCorpus: 0 };
    }

    // 1. Fetch eligible bank questions (SUBMITTED, UNDER_REVIEW, APPROVED, RETIRED)
    const versions = await this.prisma.questionVersion.findMany({
      where: {
        status: {
          in: ['SUBMITTED', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'MODERATION', 'APPROVED', 'RETIRED'],
        },
      },
      include: {
        question: { select: { humanId: true, authorId: true } },
      },
    });

    const items = [];
    for (const v of versions) {
      try {
        const associatedData = `${v.questionId}:${v.versionNo}`;
        const contentStr = await this.crypto.decrypt(
          {
            ciphertext: v.encryptedContent,
            nonce: v.contentNonce,
            tag: v.contentTag,
            wrappedKey: v.encryptedContentKey,
            keyId: v.keyId,
          },
          associatedData,
        );
        const content = JSON.parse(contentStr);
        const optionsList = content.options ? content.options.map((o: any) => o.text || '') : [];

        items.push({
          docId: v.id,
          sourceType: 'BANK',
          sourceReference: v.question.humanId,
          versionNo: v.versionNo,
          stem: content.stem || '',
          options: optionsList,
          parentVersionId: v.parentVersionId,
          authorId: v.authorId,
        });
      } catch (err: any) {
        this.logger.warn(`Failed decrypting version ${v.id} for index feed: ${err.message}`);
      }
    }

    // 2. Fetch corpus documents (past papers and public material)
    const corpusDocs = await this.prisma.corpusDocument.findMany({
      include: { source: true },
    });
    for (const cd of corpusDocs) {
      items.push({
        docId: cd.id,
        sourceType: cd.source.type, // 'PAST_PAPER' or 'PUBLIC'
        sourceReference: `${cd.source.name}: ${cd.identifier}`,
        versionNo: 1,
        stem: cd.plaintextContent,
        options: [],
        parentVersionId: null,
        authorId: null,
      });
    }

    if (items.length > 0) {
      const res = await fetch(this.getServiceUrl('index/feed'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        throw new Error(`Feed sync failed with status ${res.status}`);
      }
    }

    this.logger.log(`Synced ${items.length} items to originality memory index`);
    return { syncedBank: versions.length, syncedCorpus: corpusDocs.length };
  }

  /**
   * Screen a question version for originality
   * Enforces retry safety, audit logging, and strict state transitions
   */
  async screenQuestion(versionId: string): Promise<any> {
    const version = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        question: true,
      },
    });

    // Check current state: must be SUBMITTED or SCREENING
    if (!['SUBMITTED', 'SCREENING'].includes(version.status)) {
      this.logger.warn(`Version ${versionId} is in status ${version.status}, skipping screening.`);
      return { skipped: true, status: version.status };
    }

    // Transition to SCREENING if currently SUBMITTED
    if (version.status === 'SUBMITTED') {
      await this.prisma.questionVersion.update({
        where: { id: versionId },
        data: { status: 'SCREENING' },
      });
      await this.audit.log({
        actorId: version.authorId,
        action: 'SCREENING_START',
        targetType: 'question_version',
        targetId: versionId,
        metadata: { versionNo: version.versionNo, humanId: version.question.humanId },
      });
    }

    // Get active approval policy to get thresholds
    const policy = await this.policies.getActivePolicy(
      version.question.subjectId,
      undefined,
      version.question.type,
    );

    const exactThreshold = policy?.exactMatchThreshold ?? 1.0;
    const highThreshold = policy?.highSimilarityThreshold ?? 0.85;
    const mediumThreshold = policy?.mediumSimilarityThreshold ?? 0.60;

    // Decrypt content inside API (never pass encrypted blobs to copy checker)
    const associatedData = `${version.questionId}:${version.versionNo}`;
    let content: any;
    try {
      const contentStr = await this.crypto.decrypt(
        {
          ciphertext: version.encryptedContent,
          nonce: version.contentNonce,
          tag: version.contentTag,
          wrappedKey: version.encryptedContentKey,
          keyId: version.keyId,
        },
        associatedData,
      );
      content = JSON.parse(contentStr);
    } catch (err: any) {
      this.logger.error(`Failed decrypting question for screening: ${err.message}`);
      throw new Error(`Decryption error during screening: ${err.message}`);
    }

    const optionsList = content.options ? content.options.map((o: any) => o.text || '') : [];

    // Call Python originality service
    let serviceResponse: any;
    try {
      const res = await fetch(this.getServiceUrl('check'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
        },
        body: JSON.stringify({
          questionId: version.questionId,
          versionNo: version.versionNo,
          stem: content.stem,
          options: optionsList,
          parentVersionId: version.parentVersionId,
          authorId: version.authorId,
          exactMatchThreshold: exactThreshold,
          highSimilarityThreshold: highThreshold,
          mediumSimilarityThreshold: mediumThreshold,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`Originality service returned HTTP ${res.status}`);
      }
      serviceResponse = await res.json();
    } catch (err: any) {
      // Originality service is unreachable or failed
      this.logger.error(`Originality service check failed: ${err.message}`);
      await this.audit.log({
        actorId: undefined,
        action: 'ORIGINALITY_SERVICE_FAILURE',
        targetType: 'question_version',
        targetId: versionId,
        metadata: {
          error: err.message,
          versionNo: version.versionNo,
          actionTaken: 'remains_in_screening',
        },
      });

      // HARD SECURITY RULE: Never skip screening silently! Version remains in SCREENING.
      throw new Error(`Originality check unavailable. Version retained in SCREENING: ${err.message}`);
    }

    const { riskLevel, highestScore, matches } = serviceResponse;

    // Store OriginalityReport & matches in database inside transaction
    const savedReport = await this.prisma.$transaction(async (tx) => {
      // Upsert report
      const report = await tx.originalityReport.upsert({
        where: { questionVersionId: versionId },
        create: {
          questionVersionId: versionId,
          riskLevel,
          highestScore,
          checkedAt: new Date(),
          serviceVersion: '1.0.0',
          metadata: { totalMatches: matches.length },
        },
        update: {
          riskLevel,
          highestScore,
          checkedAt: new Date(),
          metadata: { totalMatches: matches.length },
        },
      });

      // Clear old matches if any
      await tx.originalityMatch.deleteMany({ where: { reportId: report.id } });

      // Insert matches
      for (const m of matches) {
        await tx.originalityMatch.create({
          data: {
            reportId: report.id,
            sourceType: m.sourceType,
            sourceReference: m.sourceReference,
            matchedQuestionVersionId: m.matchedQuestionVersionId,
            matchedDocumentId: m.matchedDocumentId,
            overallScore: m.overallScore,
            exactHashMatch: m.exactHashMatch,
            minhashScore: m.minhashScore,
            tfidfScore: m.tfidfScore,
            stemScore: m.stemScore,
            optionsScore: m.optionsScore,
            optionsReorderedMatch: m.optionsReorderedMatch,
            matchedSpans: m.matchedSpans || null,
            sourceTextSnippet: m.sourceTextSnippet || null,
          },
        });
      }

      // Determine next status:
      // If EXACT or HIGH: transition to DUPLICATE_FLAGGED
      // If NONE, LOW, MEDIUM: transition to READY_FOR_REVIEW
      const isBlockingMatch = riskLevel === 'EXACT' || riskLevel === 'HIGH';
      const targetStatus = isBlockingMatch ? 'DUPLICATE_FLAGGED' : 'READY_FOR_REVIEW';

      await tx.questionVersion.update({
        where: { id: versionId },
        data: {
          status: targetStatus,
          policyVersion: policy?.version ?? 1,
        },
      });

      return { report, targetStatus, isBlockingMatch, riskLevel, highestScore };
    });

    // Audit screening result (IDs and scores ONLY, NO question text!)
    await this.audit.log({
      actorId: version.authorId,
      action: savedReport.isBlockingMatch ? 'DUPLICATE_FLAGGED' : 'SCREENING_COMPLETE',
      targetType: 'question_version',
      targetId: versionId,
      metadata: {
        versionNo: version.versionNo,
        riskLevel: savedReport.riskLevel,
        highestScore: savedReport.highestScore,
        matchCount: matches.length,
        nextStatus: savedReport.targetStatus,
      },
    });

    // Also add to in-memory originality index so future submissions check against this version
    try {
      await fetch(this.getServiceUrl('index/feed'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              docId: version.id,
              sourceType: 'BANK',
              sourceReference: version.question.humanId,
              versionNo: version.versionNo,
              stem: content.stem,
              options: optionsList,
              parentVersionId: version.parentVersionId,
              authorId: version.authorId,
            },
          ],
        }),
      });
    } catch (e: any) {
      this.logger.warn(`Failed adding screened version ${version.id} to copy index: ${e.message}`);
    }

    // Automatically assign reviewers if question successfully passed screening to READY_FOR_REVIEW
    if (savedReport.targetStatus === 'READY_FOR_REVIEW') {
      try {
        await this.reviewService.assignReviewers(versionId);
      } catch (err: any) {
        this.logger.error(`Automatic reviewer assignment failed for ${versionId}: ${err.message}`);
      }
    }

    return savedReport;
  }

  /**
   * Moderator duplicate disposition
   */
  async dispositionDuplicate(
    versionId: string,
    input: DuplicateDispositionInput,
    moderatorId: string,
  ) {
    const version = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { question: true },
    });

    if (version.status !== 'DUPLICATE_FLAGGED') {
      throw new BadRequestException('Question is not in DUPLICATE_FLAGGED status');
    }

    // Moderator cannot disposition a question they authored
    if (version.authorId === moderatorId) {
      throw new ForbiddenException('A moderator cannot disposition a duplicate flag on their own question');
    }

    // Envelope-encrypt justification
    const encJustification = await this.crypto.encrypt(
      JSON.stringify({ justification: input.justification, disposition: input.disposition }),
      `disposition:${versionId}`,
    );

    const nextStatus =
      input.disposition === 'CONFIRMED_DUPLICATE' ? 'REJECTED' : 'READY_FOR_REVIEW';

    await this.prisma.$transaction(async (tx) => {
      // Upsert disposition
      await tx.duplicateDisposition.upsert({
        where: { questionVersionId: versionId },
        create: {
          questionVersionId: versionId,
          disposition: input.disposition,
          moderatorId,
          encryptedJustification: encJustification.ciphertext,
          justificationNonce: encJustification.nonce,
          justificationTag: encJustification.tag,
          encryptedJustificationKey: encJustification.wrappedKey,
          keyId: encJustification.keyId,
        },
        update: {
          disposition: input.disposition,
          moderatorId,
          encryptedJustification: encJustification.ciphertext,
          justificationNonce: encJustification.nonce,
          justificationTag: encJustification.tag,
          encryptedJustificationKey: encJustification.wrappedKey,
          keyId: encJustification.keyId,
          dispositionedAt: new Date(),
        },
      });

      // Update version status
      await tx.questionVersion.update({
        where: { id: versionId },
        data: { status: nextStatus },
      });
    });

    await this.audit.log({
      actorId: moderatorId,
      action: 'DUPLICATE_DISPOSITION',
      targetType: 'question_version',
      targetId: versionId,
      metadata: {
        disposition: input.disposition,
        nextStatus,
        versionNo: version.versionNo,
      },
    });

    // If cleared to READY_FOR_REVIEW, trigger reviewer assignment
    if (nextStatus === 'READY_FOR_REVIEW') {
      try {
        await this.reviewService.assignReviewers(versionId);
      } catch (err: any) {
        this.logger.error(
          `Reviewer assignment failed following duplicate disposition for ${versionId}: ${err.message}`,
        );
      }
    }

    return { success: true, disposition: input.disposition, nextStatus };
  }

  /**
   * Get originality report for a version with visibility masking
   * Non-moderators see masked bank codes; moderators see details
   */
  async getReport(versionId: string, userRole: string, userId: string) {
    const report = await this.prisma.originalityReport.findUnique({
      where: { questionVersionId: versionId },
      include: {
        matches: true,
        questionVersion: {
          select: {
            id: true,
            versionNo: true,
            status: true,
            authorId: true,
            question: { select: { humanId: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('No originality report found for this version');
    }

    const isModeratorOrAdmin = ['MODERATOR', 'ADMIN'].includes(userRole);

    // Apply visibility rules
    const sanitizedMatches = report.matches.map((m) => {
      if (m.sourceType === 'BANK') {
        if (!isModeratorOrAdmin) {
          // Mask bank question codes for non-moderators (e.g., EV-PHY-000123 -> EV-***-123)
          const maskedRef = m.sourceReference.replace(/^(EV-)[A-Z]+-(\d+)$/, '$1***-$2');
          return {
            ...m,
            sourceReference: maskedRef,
            matchedQuestionVersionId: null, // Hide internal UUID from non-moderators
            sourceTextSnippet: null, // Never leak bank question content
          };
        }
      }
      return m;
    });

    return {
      ...report,
      matches: sanitizedMatches,
    };
  }
}
