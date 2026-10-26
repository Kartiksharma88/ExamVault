import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';

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

    // If current version is SUBMITTED, create a new version
    const isSubmitted = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(currentVersion.status);
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
   * Submit a question (DRAFT -> SUBMITTED)
   */
  async submit(questionId: string, userId: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

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

    return { id: questionId, status: 'SUBMITTED' };
  }

  /**
   * Withdraw a question (SUBMITTED -> WITHDRAWN)
   */
  async withdraw(questionId: string, userId: string) {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });

    if (question.authorId !== userId) {
      throw new ForbiddenException('You can only withdraw your own questions');
    }

    const currentVersion = question.versions[0];
    if (currentVersion.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED questions can be withdrawn');
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
   * Get question content (decrypted) — enforces role-based access
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

    // REVIEWER can read SUBMITTED questions not authored by them (Step 2 stub)
    if (userRole === 'REVIEWER') {
      if (question.authorId === userId) {
        throw new ForbiddenException('Reviewers cannot review their own questions');
      }
      // TODO: Step 2 — check that question is in SUBMITTED/UNDER_REVIEW status
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

    const content = JSON.parse(contentJson);
    const answerKey = JSON.parse(answerJson);

    // Remove internal salt from response
    delete content._commitmentSalt;

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
        currentVersion: q.versions[0]?.versionNo || 1,
        status: q.versions[0]?.status || 'DRAFT',
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
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
}
