import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { ScreeningQueue } from '../originality/screening.queue';
import { CreateNewVersionInput } from '@examvault/shared';

interface QuestionContent {
  type: string;
  stem: string;
  options?: { label: string; text: string; imageId?: string }[];
  imageIds?: string[];
  solution?: string;
  language: string;
  _commitmentSalt?: string; // Stored inside encrypted payload
}

interface AnswerKey {
  type: string;
  correct: string | string[] | number;
  tolerance?: number;
}

interface CreateQuestionInput {
  content: QuestionContent;
  answerKey: AnswerKey;
  metadata: {
    subjectId: string;
    topicId?: string;
    subtopicId?: string;
    type: string;
    difficulty: number;
    cognitiveLevel: string;
    marks: number;
    negativeMarks?: number;
    estimatedTimeSeconds: number;
    language?: string;
  };
}

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
    private screeningQueue: ScreeningQueue,
  ) {}

  /**
   * Create a new question with encrypted content
   */
  async create(input: CreateQuestionInput, authorId: string) {
    const { content, answerKey, metadata } = input;

    // Sanitize markdown content (no raw HTML)
    const sanitizedContent = this.sanitizeContent(content);

    // Get subject for human-readable ID
    const subject = await this.prisma.subject.findUniqueOrThrow({
      where: { id: metadata.subjectId },
    });

    // Generate human-readable ID and increment sequence atomically
    const updatedSubject = await this.prisma.subject.update({
      where: { id: subject.id },
      data: { nextSeq: { increment: 1 } },
    });
    const seqNo = updatedSubject.nextSeq - 1;
    const humanId = `EV-${subject.code}-${String(seqNo).padStart(6, '0')}`;

    // Create question record
    const question = await this.prisma.question.create({
      data: {
        humanId,
        authorId,
        subjectId: metadata.subjectId,
        topicId: metadata.topicId,
        subtopicId: metadata.subtopicId,
        type: metadata.type as any,
        difficulty: metadata.difficulty,
        cognitiveLevel: metadata.cognitiveLevel as any,
        marks: metadata.marks,
        negativeMarks: metadata.negativeMarks || 0,
        estimatedTime: metadata.estimatedTimeSeconds,
        language: (metadata.language || 'EN') as any,
        currentVersion: 1,
      },
    });

    // Compute content commitment
    const canonicalContent = JSON.stringify(sanitizedContent);
    const commitment = this.crypto.computeCommitment(canonicalContent);

    // Embed salt in content for later verification
    const contentWithSalt: QuestionContent = {
      ...sanitizedContent,
      _commitmentSalt: commitment.salt,
    };

    // Associated data for GCM authentication
    const associatedData = `${question.id}:1`;

    // Encrypt content
    const contentEnvelope = await this.crypto.encrypt(
      JSON.stringify(contentWithSalt),
      associatedData,
    );

    // Encrypt answer key separately
    const answerEnvelope = await this.crypto.encrypt(
      JSON.stringify(answerKey),
      associatedData,
    );

    // Create version
    await this.prisma.questionVersion.create({
      data: {
        questionId: question.id,
        versionNo: 1,
        status: 'DRAFT',
        authorId,
        encryptedContent: contentEnvelope.ciphertext,
        contentNonce: contentEnvelope.nonce,
        contentTag: contentEnvelope.tag,
        encryptedContentKey: contentEnvelope.wrappedKey,
        encryptedAnswer: answerEnvelope.ciphertext,
        answerNonce: answerEnvelope.nonce,
        answerTag: answerEnvelope.tag,
        encryptedAnswerKey: answerEnvelope.wrappedKey,
        contentCommitment: commitment.commitment,
        keyId: contentEnvelope.keyId,
        ciphertextSha256: crypto.createHash('sha256').update(contentEnvelope.ciphertext).digest('hex'),
        answerCiphertextSha256: crypto.createHash('sha256').update(answerEnvelope.ciphertext).digest('hex'),
      },
    });

    await this.audit.log({
      actorId: authorId,
      action: 'QUESTION_CREATE',
      targetType: 'question',
      targetId: question.id,
      metadata: { humanId, type: metadata.type, subjectId: metadata.subjectId },
    });

    return {
      id: question.id,
      humanId,
      currentVersion: 1,
      status: 'DRAFT',
    };
  }

  /**
   * Update a question — creates a new version if current is SUBMITTED
   */
  async update(
    questionId: string,
    input: CreateQuestionInput,
    userId: string,
  ) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

    // Check workflow lock
    if (question.isLocked) {
      throw new ForbiddenException(
        `Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`,
      );
    }

    // Only author can edit
    if (question.authorId !== userId) {
      await this.audit.log({
        actorId: userId,
        action: 'ACCESS_DENIED',
        targetType: 'question',
        targetId: questionId,
        metadata: { reason: 'not_author' },
      });
      throw new ForbiddenException('You can only edit your own questions');
    }

    const currentVersion = question.versions[0];
    if (!currentVersion) {
      throw new NotFoundException('No version found');
    }

    // Non-draft question versions are strictly immutable (enforced by DB trigger).
    // Any status other than DRAFT must spawn a new version.
    const isSubmitted = currentVersion.status !== 'DRAFT';
    const newVersionNo = isSubmitted ? currentVersion.versionNo + 1 : currentVersion.versionNo;

    const { content, answerKey, metadata } = input;
    const sanitizedContent = this.sanitizeContent(content);

    // Compute commitment
    const canonicalContent = JSON.stringify(sanitizedContent);
    const commitment = this.crypto.computeCommitment(canonicalContent);
    const contentWithSalt = { ...sanitizedContent, _commitmentSalt: commitment.salt };

    const associatedData = `${questionId}:${newVersionNo}`;

    // Encrypt
    const contentEnvelope = await this.crypto.encrypt(
      JSON.stringify(contentWithSalt),
      associatedData,
    );
    const answerEnvelope = await this.crypto.encrypt(
      JSON.stringify(answerKey),
      associatedData,
    );

    if (isSubmitted) {
      // Create new version
      await this.prisma.questionVersion.create({
        data: {
          questionId,
          versionNo: newVersionNo,
          status: 'DRAFT',
          authorId: userId,
          parentVersionId: currentVersion.id,
          encryptedContent: contentEnvelope.ciphertext,
          contentNonce: contentEnvelope.nonce,
          contentTag: contentEnvelope.tag,
          encryptedContentKey: contentEnvelope.wrappedKey,
          encryptedAnswer: answerEnvelope.ciphertext,
          answerNonce: answerEnvelope.nonce,
          answerTag: answerEnvelope.tag,
          encryptedAnswerKey: answerEnvelope.wrappedKey,
          contentCommitment: commitment.commitment,
          keyId: contentEnvelope.keyId,
          ciphertextSha256: crypto.createHash('sha256').update(contentEnvelope.ciphertext).digest('hex'),
          answerCiphertextSha256: crypto.createHash('sha256').update(answerEnvelope.ciphertext).digest('hex'),
        },
      });

      // Update question metadata
      await this.prisma.question.update({
        where: { id: questionId },
        data: {
          currentVersion: newVersionNo,
          subjectId: metadata.subjectId,
          topicId: metadata.topicId,
          subtopicId: metadata.subtopicId,
          type: metadata.type as any,
          difficulty: metadata.difficulty,
          cognitiveLevel: metadata.cognitiveLevel as any,
          marks: metadata.marks,
          negativeMarks: metadata.negativeMarks || 0,
          estimatedTime: metadata.estimatedTimeSeconds,
          language: (metadata.language || 'EN') as any,
        },
      });
    } else {
      // Update existing draft version
      await this.prisma.questionVersion.update({
        where: {
          questionId_versionNo: { questionId, versionNo: currentVersion.versionNo },
        },
        data: {
          encryptedContent: contentEnvelope.ciphertext,
          contentNonce: contentEnvelope.nonce,
          contentTag: contentEnvelope.tag,
          encryptedContentKey: contentEnvelope.wrappedKey,
          encryptedAnswer: answerEnvelope.ciphertext,
          answerNonce: answerEnvelope.nonce,
          answerTag: answerEnvelope.tag,
          encryptedAnswerKey: answerEnvelope.wrappedKey,
          contentCommitment: commitment.commitment,
          keyId: contentEnvelope.keyId,
          ciphertextSha256: crypto.createHash('sha256').update(contentEnvelope.ciphertext).digest('hex'),
          answerCiphertextSha256: crypto.createHash('sha256').update(answerEnvelope.ciphertext).digest('hex'),
        },
      });

      // Update question metadata
      await this.prisma.question.update({
        where: { id: questionId },
        data: {
          subjectId: metadata.subjectId,
          topicId: metadata.topicId,
          subtopicId: metadata.subtopicId,
          type: metadata.type as any,
          difficulty: metadata.difficulty,
          cognitiveLevel: metadata.cognitiveLevel as any,
          marks: metadata.marks,
          negativeMarks: metadata.negativeMarks || 0,
          estimatedTime: metadata.estimatedTimeSeconds,
          language: (metadata.language || 'EN') as any,
        },
      });
    }

    await this.audit.log({
      actorId: userId,
      action: 'QUESTION_EDIT',
      targetType: 'question',
      targetId: questionId,
      metadata: { versionNo: newVersionNo, newVersion: isSubmitted },
    });

    return {
      id: questionId,
      humanId: question.humanId,
      currentVersion: newVersionNo,
      status: 'DRAFT',
      newVersionCreated: isSubmitted,
    };
  }

  /**
   * Submit a question (DRAFT -> SUBMITTED -> SCREENING via background job)
   */
  async submit(questionId: string, userId: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

    if (question.isLocked) {
      throw new ForbiddenException(
        `Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`,
      );
    }

    if (question.authorId !== userId) {
      throw new ForbiddenException('You can only submit your own questions');
    }

    const currentVersion = question.versions[0];
    if (currentVersion.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT questions can be submitted');
    }

    await this.prisma.questionVersion.update({
      where: { id: currentVersion.id },
      data: { status: 'SUBMITTED' },
    });

    await this.audit.log({
      actorId: userId,
      action: 'QUESTION_SUBMIT',
      targetType: 'question',
      targetId: questionId,
      metadata: { versionNo: currentVersion.versionNo },
    });

    // Automatically trigger originality screening job
    await this.screeningQueue.enqueue(currentVersion.id);

    return { id: questionId, status: 'SUBMITTED' };
  }

  /**
   * Withdraw a question (SUBMITTED/READY_FOR_REVIEW -> WITHDRAWN before reviews start)
   */
  async withdraw(questionId: string, userId: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

    if (question.isLocked) {
      throw new ForbiddenException(
        `Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`,
      );
    }

    if (question.authorId !== userId) {
      throw new ForbiddenException('You can only withdraw your own questions');
    }

    const currentVersion = question.versions[0];
    if (!['SUBMITTED', 'READY_FOR_REVIEW'].includes(currentVersion.status)) {
      throw new BadRequestException(
        'Only SUBMITTED or READY_FOR_REVIEW questions can be withdrawn before reviewer assignment',
      );
    }

    await this.prisma.questionVersion.update({
      where: { id: currentVersion.id },
      data: { status: 'WITHDRAWN' },
    });

    await this.audit.log({
      actorId: userId,
      action: 'QUESTION_WITHDRAW',
      targetType: 'question',
      targetId: questionId,
      metadata: { versionNo: currentVersion.versionNo },
    });

    return { id: questionId, status: 'WITHDRAWN' };
  }

  /**
   * Get question content (decrypted) — enforces strict role-based access & blind solve barrier
   * ADMIN and AUDITOR MUST NOT access content
   */
  async getContent(
    questionId: string,
    userId: string,
    userRole: string,
    versionNo?: number,
  ) {
    // ADMIN and AUDITOR must never read question content
    if (['ADMIN', 'AUDITOR'].includes(userRole)) {
      await this.audit.log({
        actorId: userId,
        action: 'ACCESS_DENIED',
        targetType: 'question',
        targetId: questionId,
        metadata: { reason: 'role_restriction', role: userRole },
      });
      throw new ForbiddenException('Your role does not permit access to question content');
    }

    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
    });

    // EXAMINER can only read own questions
    if (userRole === 'EXAMINER' && question.authorId !== userId) {
      await this.audit.log({
        actorId: userId,
        action: 'ACCESS_DENIED',
        targetType: 'question',
        targetId: questionId,
        metadata: { reason: 'not_author' },
      });
      throw new ForbiddenException('You can only view your own questions');
    }

    const targetVersion = versionNo || question.currentVersion;
    const version = await this.prisma.questionVersion.findUnique({
      where: {
        questionId_versionNo: { questionId, versionNo: targetVersion },
      },
    });

    if (!version) {
      throw new NotFoundException(`Version ${targetVersion} not found`);
    }

    // REVIEWER: Can only read question versions currently assigned to them
    let isReviewerInSolvePhase = false;
    if (userRole === 'REVIEWER') {
      if (question.authorId === userId) {
        throw new ForbiddenException('Reviewers cannot review their own questions');
      }

      const assignment = await this.prisma.reviewAssignment.findFirst({
        where: {
          questionVersionId: version.id,
          reviewerId: userId,
          status: { in: ['PENDING', 'SOLVED', 'COMPLETED'] },
        },
        include: { review: true },
      });

      if (!assignment) {
        await this.audit.log({
          actorId: userId,
          action: 'ACCESS_DENIED',
          targetType: 'question_version',
          targetId: version.id,
          metadata: { reason: 'not_assigned_to_reviewer' },
        });
        throw new ForbiddenException('Reviewers can only read question versions currently assigned to them');
      }

      // Check if in blind solve phase
      if (!assignment.review || assignment.review.phase === 'SOLVE') {
        isReviewerInSolvePhase = true;
      }
    }

    // MODERATOR: Can only read versions in MODERATION stage or under DUPLICATE_FLAGGED
    if (userRole === 'MODERATOR') {
      if (!['MODERATION', 'DUPLICATE_FLAGGED'].includes(version.status)) {
        throw new ForbiddenException(
          'Moderators can only read question versions in moderation stage or under a duplicate flag',
        );
      }
    }

    const associatedData = `${questionId}:${targetVersion}`;

    // Decrypt content
    const contentJson = await this.crypto.decrypt(
      {
        ciphertext: version.encryptedContent,
        nonce: version.contentNonce,
        tag: version.contentTag,
        wrappedKey: version.encryptedContentKey,
        keyId: version.keyId,
      },
      associatedData,
    );

    const content = JSON.parse(contentJson);
    delete content._commitmentSalt;

    let answerKey: any = null;

    // BLIND SOLVE BARRIER:
    // If reviewer is in SOLVE phase, withhold answerKey and solution!
    if (isReviewerInSolvePhase) {
      delete content.solution;
    } else {
      // Decrypt answer key
      const answerJson = await this.crypto.decrypt(
        {
          ciphertext: version.encryptedAnswer,
          nonce: version.answerNonce,
          tag: version.answerTag,
          wrappedKey: version.encryptedAnswerKey,
          keyId: version.keyId,
        },
        associatedData,
      );
      answerKey = JSON.parse(answerJson);
    }

    // Log content access
    await this.audit.log({
      actorId: userId,
      action: 'QUESTION_CONTENT_READ',
      targetType: 'question',
      targetId: questionId,
      metadata: { versionNo: targetVersion },
    });

    return {
      id: question.id,
      humanId: question.humanId,
      versionNo: targetVersion,
      status: version.status,
      content,
      answerKey,
      contentCommitment: version.contentCommitment,
      metadata: {
        subjectId: question.subjectId,
        topicId: question.topicId,
        subtopicId: question.subtopicId,
        type: question.type,
        difficulty: question.difficulty,
        cognitiveLevel: question.cognitiveLevel,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        estimatedTimeSeconds: question.estimatedTime,
        language: question.language,
      },
    };
  }

  /**
   * Get anonymized reviewer and moderator feedback for the author
   * Anonymity guarantee: Reviewer names/IDs are NEVER leaked (Reviewer A, Reviewer B, Moderator)
   */
  async getAuthorFeedback(questionId: string, userId: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            reviews: {
              where: { phase: 'SUBMITTED' },
            },
            approvals: true,
          },
        },
      },
    });

    if (question.authorId !== userId) {
      throw new ForbiddenException('You can only view feedback for your own questions');
    }

    const feedbackList = [];
    const reviewerLabels = ['Reviewer A', 'Reviewer B', 'Reviewer C', 'Reviewer D'];

    for (const v of question.versions) {
      let labelIdx = 0;
      const anonMap: Record<string, string> = {};

      for (const rev of v.reviews) {
        if (!anonMap[rev.reviewerId]) {
          anonMap[rev.reviewerId] = reviewerLabels[labelIdx++ % reviewerLabels.length];
        }
        const anonRole = anonMap[rev.reviewerId];

        let commentsText = '';
        if (
          rev.encryptedComments &&
          rev.commentsNonce &&
          rev.commentsTag &&
          rev.encryptedCommentsKey &&
          rev.keyId
        ) {
          try {
            commentsText = await this.crypto.decrypt(
              {
                ciphertext: rev.encryptedComments,
                nonce: rev.commentsNonce,
                tag: rev.commentsTag,
                wrappedKey: rev.encryptedCommentsKey,
                keyId: rev.keyId,
              },
              `${rev.id}:${questionId}:${v.versionNo}`,
            );
          } catch {
            commentsText = '[Unable to decrypt review comment]';
          }
        }

        feedbackList.push({
          versionNo: v.versionNo,
          role: anonRole,
          decision: rev.decision,
          checklist: rev.checklist,
          comments: commentsText,
          submittedAt: rev.submittedAt,
        });
      }

      // Add moderator approval/rejection feedback
      for (const app of v.approvals) {
        if (app.role === 'MODERATOR') {
          feedbackList.push({
            versionNo: v.versionNo,
            role: 'Moderator',
            decision: app.decision,
            checklist: null,
            comments: `Moderator decision: ${app.decision}`,
            submittedAt: app.timestamp,
          });
        }
      }
    }

    return feedbackList;
  }

  /**
   * Create a new version for an APPROVED, CHANGES_REQUESTED, or REJECTED question
   * Enforces mandatory change justification (min 15 characters) and full review pipeline
   */
  async createNewVersion(input: CreateNewVersionInput, userId: string) {
    const parentVersion = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: input.parentVersionId },
      include: { question: true },
    });

    if (parentVersion.authorId !== userId) {
      throw new ForbiddenException('You can only create revisions of your own questions');
    }

    if (!['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'].includes(parentVersion.status)) {
      throw new BadRequestException(
        'Revisions can only be created from questions with status CHANGES_REQUESTED, APPROVED, or REJECTED',
      );
    }

    if (!input.changeJustification || input.changeJustification.trim().length < 15) {
      throw new BadRequestException(
        'A comprehensive change justification of at least 15 characters is required for revisions.',
      );
    }

    const { content, answerKey, metadata } = input;
    const sanitizedContent = this.sanitizeContent(content);

    const newVersionNo = parentVersion.question.currentVersion + 1;
    const associatedData = `${parentVersion.questionId}:${newVersionNo}`;

    // Compute commitment
    const canonicalContent = JSON.stringify(sanitizedContent);
    const { commitment, salt } = this.crypto.computeCommitment(canonicalContent);
    sanitizedContent._commitmentSalt = salt;

    // Encrypt content
    const encryptedContent = await this.crypto.encrypt(
      JSON.stringify(sanitizedContent),
      associatedData,
    );

    // Encrypt answer
    const encryptedAnswer = await this.crypto.encrypt(
      JSON.stringify(answerKey),
      associatedData,
    );

    const newVersion = await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: parentVersion.questionId },
        data: {
          currentVersion: newVersionNo,
          difficulty: metadata.difficulty,
          cognitiveLevel: metadata.cognitiveLevel as any,
          marks: metadata.marks,
          negativeMarks: metadata.negativeMarks ?? 0,
          estimatedTime: metadata.estimatedTimeSeconds,
          language: (metadata.language as any) || 'EN',
        },
      });

      return tx.questionVersion.create({
        data: {
          questionId: parentVersion.questionId,
          versionNo: newVersionNo,
          status: 'DRAFT', // Starts in DRAFT, follows full pipeline
          authorId: userId,
          parentVersionId: parentVersion.id,
          changeJustification: input.changeJustification,
          encryptedContent: encryptedContent.ciphertext,
          contentNonce: encryptedContent.nonce,
          contentTag: encryptedContent.tag,
          encryptedContentKey: encryptedContent.wrappedKey,
          encryptedAnswer: encryptedAnswer.ciphertext,
          answerNonce: encryptedAnswer.nonce,
          answerTag: encryptedAnswer.tag,
          encryptedAnswerKey: encryptedAnswer.wrappedKey,
          contentCommitment: commitment,
          keyId: encryptedContent.keyId,
          ciphertextSha256: crypto.createHash('sha256').update(encryptedContent.ciphertext).digest('hex'),
          answerCiphertextSha256: crypto.createHash('sha256').update(encryptedAnswer.ciphertext).digest('hex'),
        },
      });
    });

    await this.audit.log({
      actorId: userId,
      action: 'NEW_VERSION_CREATE',
      targetType: 'question_version',
      targetId: newVersion.id,
      metadata: {
        questionId: parentVersion.questionId,
        parentVersionId: parentVersion.id,
        versionNo: newVersionNo,
        justificationLength: input.changeJustification.length,
      },
    });

    return {
      id: parentVersion.questionId,
      humanId: parentVersion.question.humanId,
      versionNo: newVersionNo,
      status: 'DRAFT',
      parentVersionId: parentVersion.id,
    };
  }

  /**
   * List questions (metadata only — no content)
   */
  async findAll(
    userId: string,
    userRole: string,
    filters: {
      subjectId?: string;
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: any = {};

    // EXAMINER sees only own questions
    if (userRole === 'EXAMINER') {
      where.authorId = userId;
    }
    // REVIEWER sees only SUBMITTED questions not authored by them
    if (userRole === 'REVIEWER') {
      where.authorId = { not: userId };
      where.versions = { some: { status: 'SUBMITTED' } };
    }

    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.type) where.type = filters.type;

    // Status filter through versions
    if (filters.status) {
      where.versions = {
        ...where.versions,
        some: { ...(where.versions?.some || {}), status: filters.status },
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          subject: { select: { name: true, code: true } },
          topic: { select: { name: true } },
          subtopic: { select: { name: true } },
          author: { select: { name: true } },
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 1,
            select: { versionNo: true, status: true, createdAt: true },
          },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: items.map((q) => ({
        id: q.id,
        humanId: q.humanId,
        authorId: q.authorId,
        authorName: q.author.name,
        subjectName: q.subject.name,
        subjectCode: q.subject.code,
        topicName: q.topic?.name,
        subtopicName: q.subtopic?.name,
        type: q.type,
        difficulty: q.difficulty,
        cognitiveLevel: q.cognitiveLevel,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        language: q.language,
        isLocked: q.isLocked,
        lockReason: q.lockReason,
        lockedAt: q.lockedAt ? q.lockedAt.toISOString() : null,
        currentVersion: q.versions[0]?.versionNo || 1,
        status: q.versions[0]?.status || 'DRAFT',
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        metadata: {
          subjectId: q.subjectId,
          topicId: q.topicId,
          subtopicId: q.subtopicId,
          type: q.type,
          difficulty: q.difficulty,
          cognitiveLevel: q.cognitiveLevel,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          estimatedTimeSeconds: q.estimatedTime,
          language: q.language,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get version history for a question
   */
  async getVersionHistory(questionId: string, userId: string, userRole: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
    });

    if (userRole === 'EXAMINER' && question.authorId !== userId) {
      throw new ForbiddenException('You can only view your own questions');
    }

    const versions = await this.prisma.questionVersion.findMany({
      where: { questionId },
      select: {
        id: true,
        versionNo: true,
        status: true,
        authorId: true,
        author: {
          select: { id: true, name: true, email: true },
        },
        changeJustification: true,
        contentCommitment: true,
        createdAt: true,
      },
      orderBy: { versionNo: 'desc' },
    });

    return {
      questionId,
      humanId: question.humanId,
      versions,
    };
  }

  /**
   * Sanitize markdown content — strip raw HTML
   */
  private sanitizeContent(content: QuestionContent): QuestionContent {
    return {
      ...content,
      stem: sanitizeHtml(content.stem, {
        allowedTags: [], // Strip all HTML
        allowedAttributes: {},
      }),
      options: content.options?.map((opt) => ({
        ...opt,
        text: sanitizeHtml(opt.text, { allowedTags: [], allowedAttributes: {} }),
      })),
      solution: content.solution
        ? sanitizeHtml(content.solution, { allowedTags: [], allowedAttributes: {} })
        : undefined,
    };
  }

  /**
   * Lock or unlock question workflow (Admin only)
   */
  async toggleLock(
    questionId: string,
    isLocked: boolean,
    reason: string | undefined,
    adminId: string,
  ) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        isLocked,
        lockReason: isLocked ? (reason || 'Administrative governance suspension') : null,
        lockedAt: isLocked ? new Date() : null,
        lockedById: isLocked ? adminId : null,
      },
    });

    await this.audit.log({
      actorId: adminId,
      action: isLocked ? 'QUESTION_WORKFLOW_LOCKED' : 'QUESTION_WORKFLOW_UNLOCKED',
      targetType: 'question',
      targetId: questionId,
      metadata: {
        humanId: question.humanId,
        reason: reason || (isLocked ? 'Administrative lock' : 'Administrative unlock'),
        versionNo: question.versions[0]?.versionNo || 1,
      },
    });

    return {
      id: updated.id,
      humanId: updated.humanId,
      isLocked: updated.isLocked,
      lockReason: updated.lockReason,
      lockedAt: updated.lockedAt,
    };
  }
}
