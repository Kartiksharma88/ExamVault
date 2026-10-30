"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionsService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
const screening_queue_1 = require("../originality/screening.queue");
let QuestionsService = class QuestionsService {
    prisma;
    crypto;
    audit;
    screeningQueue;
    constructor(prisma, crypto, audit, screeningQueue) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.audit = audit;
        this.screeningQueue = screeningQueue;
    }
    /**
     * Create a new question with encrypted content
     */
    async create(input, authorId) {
        const { content, answerKey, metadata } = input;
        // Enforce author subject category specialization
        const authorExpertise = await this.prisma.userSubjectExpertise.findMany({
            where: { userId: authorId },
            include: { subject: true },
        });
        if (authorExpertise.length > 0) {
            const allowedSubjectIds = authorExpertise.map((e) => e.subjectId);
            if (!allowedSubjectIds.includes(metadata.subjectId)) {
                const allowedSubjectNames = authorExpertise.map((e) => e.subject.name).join(', ');
                throw new common_1.ForbiddenException(`Subject category restriction: You are registered as an examiner for ${allowedSubjectNames} only. You cannot submit questions for other subjects.`);
            }
        }
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
                type: metadata.type,
                difficulty: metadata.difficulty,
                cognitiveLevel: metadata.cognitiveLevel,
                marks: metadata.marks,
                negativeMarks: metadata.negativeMarks || 0,
                estimatedTime: metadata.estimatedTimeSeconds,
                language: (metadata.language || 'EN'),
                currentVersion: 1,
            },
        });
        // Compute content commitment
        const canonicalContent = JSON.stringify(sanitizedContent);
        const commitment = this.crypto.computeCommitment(canonicalContent);
        // Embed salt in content for later verification
        const contentWithSalt = {
            ...sanitizedContent,
            _commitmentSalt: commitment.salt,
        };
        // Associated data for GCM authentication
        const associatedData = `${question.id}:1`;
        // Encrypt content
        const contentEnvelope = await this.crypto.encrypt(JSON.stringify(contentWithSalt), associatedData);
        // Encrypt answer key separately
        const answerEnvelope = await this.crypto.encrypt(JSON.stringify(answerKey), associatedData);
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
    async update(questionId, input, userId) {
        const question = await this.prisma.question.findUniqueOrThrow({
            where: { id: questionId },
            include: {
                versions: { orderBy: { versionNo: 'desc' }, take: 1 },
            },
        });
        // Check workflow lock
        if (question.isLocked) {
            throw new common_1.ForbiddenException(`Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`);
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
            throw new common_1.ForbiddenException('You can only edit your own questions');
        }
        const currentVersion = question.versions[0];
        if (!currentVersion) {
            throw new common_1.NotFoundException('No version found');
        }
        // Non-draft question versions are strictly immutable (enforced by DB trigger).
        // Any status other than DRAFT must spawn a new version.
        const isSubmitted = currentVersion.status !== 'DRAFT';
        const newVersionNo = isSubmitted ? currentVersion.versionNo + 1 : currentVersion.versionNo;
        const { content, answerKey, metadata } = input;
        // Enforce author subject category specialization on edit
        const authorExpertise = await this.prisma.userSubjectExpertise.findMany({
            where: { userId },
            include: { subject: true },
        });
        if (authorExpertise.length > 0) {
            const allowedSubjectIds = authorExpertise.map((e) => e.subjectId);
            if (!allowedSubjectIds.includes(metadata.subjectId)) {
                const allowedSubjectNames = authorExpertise.map((e) => e.subject.name).join(', ');
                throw new common_1.ForbiddenException(`Subject category restriction: You are registered as an examiner for ${allowedSubjectNames} only. You cannot change this question to another subject.`);
            }
        }
        const sanitizedContent = this.sanitizeContent(content);
        // Compute commitment
        const canonicalContent = JSON.stringify(sanitizedContent);
        const commitment = this.crypto.computeCommitment(canonicalContent);
        const contentWithSalt = { ...sanitizedContent, _commitmentSalt: commitment.salt };
        const associatedData = `${questionId}:${newVersionNo}`;
        // Encrypt
        const contentEnvelope = await this.crypto.encrypt(JSON.stringify(contentWithSalt), associatedData);
        const answerEnvelope = await this.crypto.encrypt(JSON.stringify(answerKey), associatedData);
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
                    type: metadata.type,
                    difficulty: metadata.difficulty,
                    cognitiveLevel: metadata.cognitiveLevel,
                    marks: metadata.marks,
                    negativeMarks: metadata.negativeMarks || 0,
                    estimatedTime: metadata.estimatedTimeSeconds,
                    language: (metadata.language || 'EN'),
                },
            });
        }
        else {
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
                    type: metadata.type,
                    difficulty: metadata.difficulty,
                    cognitiveLevel: metadata.cognitiveLevel,
                    marks: metadata.marks,
                    negativeMarks: metadata.negativeMarks || 0,
                    estimatedTime: metadata.estimatedTimeSeconds,
                    language: (metadata.language || 'EN'),
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
    async submit(questionId, userId) {
        const question = await this.prisma.question.findUniqueOrThrow({
            where: { id: questionId },
            include: {
                versions: { orderBy: { versionNo: 'desc' }, take: 1 },
            },
        });
        if (question.isLocked) {
            throw new common_1.ForbiddenException(`Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`);
        }
        if (question.authorId !== userId) {
            throw new common_1.ForbiddenException('You can only submit your own questions');
        }
        const currentVersion = question.versions[0];
        if (currentVersion.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT questions can be submitted');
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
    async withdraw(questionId, userId) {
        const question = await this.prisma.question.findUniqueOrThrow({
            where: { id: questionId },
            include: {
                versions: { orderBy: { versionNo: 'desc' }, take: 1 },
            },
        });
        if (question.isLocked) {
            throw new common_1.ForbiddenException(`Question workflow is currently locked/suspended: ${question.lockReason || 'Administrative freeze'}`);
        }
        if (question.authorId !== userId) {
            throw new common_1.ForbiddenException('You can only withdraw your own questions');
        }
        const currentVersion = question.versions[0];
        if (!['SUBMITTED', 'READY_FOR_REVIEW'].includes(currentVersion.status)) {
            throw new common_1.BadRequestException('Only SUBMITTED or READY_FOR_REVIEW questions can be withdrawn before reviewer assignment');
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
    async getContent(questionId, userId, userRole, versionNo) {
        // ADMIN and AUDITOR must never read question content
        if (['ADMIN', 'AUDITOR'].includes(userRole)) {
            await this.audit.log({
                actorId: userId,
                action: 'ACCESS_DENIED',
                targetType: 'question',
                targetId: questionId,
                metadata: { reason: 'role_restriction', role: userRole },
            });
            throw new common_1.ForbiddenException('Your role does not permit access to question content');
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
            throw new common_1.ForbiddenException('You can only view your own questions');
        }
        const targetVersion = versionNo || question.currentVersion;
        const version = await this.prisma.questionVersion.findUnique({
            where: {
                questionId_versionNo: { questionId, versionNo: targetVersion },
            },
        });
        if (!version) {
            throw new common_1.NotFoundException(`Version ${targetVersion} not found`);
        }
        // REVIEWER: Can only read question versions currently assigned to them
        let isReviewerInSolvePhase = false;
        if (userRole === 'REVIEWER') {
            if (question.authorId === userId) {
                throw new common_1.ForbiddenException('Reviewers cannot review their own questions');
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
                throw new common_1.ForbiddenException('Reviewers can only read question versions currently assigned to them');
            }
            // Check if in blind solve phase
            if (!assignment.review || assignment.review.phase === 'SOLVE') {
                isReviewerInSolvePhase = true;
            }
        }
        // MODERATOR: Can only read versions strictly within their queue
        if (userRole === 'MODERATOR') {
            // 1. Separation of duties: Cannot read or moderate their own authored question
            if (question.authorId === userId) {
                await this.audit.log({
                    actorId: userId,
                    action: 'ACCESS_DENIED',
                    targetType: 'question',
                    targetId: questionId,
                    metadata: { reason: 'moderator_is_author', role: 'MODERATOR' },
                });
                throw new common_1.ForbiddenException('Moderators cannot read or moderate questions they authored');
            }
            // Cannot act as both reviewer and moderator on same version
            const wasReviewer = await this.prisma.reviewAssignment.findFirst({
                where: {
                    questionVersionId: version.id,
                    reviewerId: userId,
                },
            });
            if (wasReviewer) {
                await this.audit.log({
                    actorId: userId,
                    action: 'ACCESS_DENIED',
                    targetType: 'question_version',
                    targetId: version.id,
                    metadata: { reason: 'moderator_was_reviewer', role: 'MODERATOR' },
                });
                throw new common_1.ForbiddenException('Separation of duties: You were assigned as reviewer on this version');
            }
            // 2. Strict queue barrier:
            // Queue = flagged duplicates (DUPLICATE_FLAGGED), versions awaiting final approval (MODERATION),
            // or questions with an active unresolved blind-solve disagreement.
            const hasUnresolvedDisagreement = await this.prisma.review.findFirst({
                where: {
                    questionVersionId: version.id,
                    disagreementFlag: true,
                    disagreementResolved: false,
                },
            });
            const inQueue = version.status === 'DUPLICATE_FLAGGED' ||
                version.status === 'MODERATION' ||
                !!hasUnresolvedDisagreement ||
                (version.difficultyConflictFlag && !version.difficultyConflictResolved);
            if (!inQueue) {
                await this.audit.log({
                    actorId: userId,
                    action: 'ACCESS_DENIED',
                    targetType: 'question_version',
                    targetId: version.id,
                    metadata: {
                        reason: 'out_of_queue_access',
                        status: version.status,
                        role: 'MODERATOR',
                        severity: 'HIGH',
                    },
                });
                throw new common_1.ForbiddenException('Access Denied: Moderators can only access questions that reach their active queue (flagged duplicates, unresolved disagreements, or awaiting final approval).');
            }
            // 3. Rate-limit content reads per moderator (configurable per hour and day)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const hourlyLimit = parseInt(process.env.MODERATOR_HOURLY_READ_LIMIT || '50', 10);
            const dailyLimit = parseInt(process.env.MODERATOR_DAILY_READ_LIMIT || '200', 10);
            const [hourlyReads, dailyReads] = await Promise.all([
                this.prisma.auditEvent.count({
                    where: {
                        actorId: userId,
                        action: 'QUESTION_CONTENT_READ',
                        timestamp: { gte: oneHourAgo },
                    },
                }),
                this.prisma.auditEvent.count({
                    where: {
                        actorId: userId,
                        action: 'QUESTION_CONTENT_READ',
                        timestamp: { gte: oneDayAgo },
                    },
                }),
            ]);
            if (hourlyReads >= hourlyLimit || dailyReads >= dailyLimit) {
                await this.audit.log({
                    actorId: userId,
                    action: 'MODERATOR_READ_LIMIT_EXCEEDED',
                    targetType: 'moderator_limit',
                    targetId: userId,
                    metadata: {
                        hourlyReads,
                        hourlyLimit,
                        dailyReads,
                        dailyLimit,
                        severity: 'HIGH',
                    },
                });
                throw new common_1.ForbiddenException(`Moderator content read limit exceeded (${hourlyReads >= hourlyLimit ? 'Hourly' : 'Daily'} limit). High-severity security alert logged.`);
            }
        }
        const associatedData = `${questionId}:${targetVersion}`;
        // Decrypt content
        const contentJson = await this.crypto.decrypt({
            ciphertext: version.encryptedContent,
            nonce: version.contentNonce,
            tag: version.contentTag,
            wrappedKey: version.encryptedContentKey,
            keyId: version.keyId,
        }, associatedData);
        const content = JSON.parse(contentJson);
        delete content._commitmentSalt;
        let answerKey = null;
        // BLIND SOLVE BARRIER:
        // If reviewer is in SOLVE phase, withhold answerKey and solution!
        if (isReviewerInSolvePhase) {
            delete content.solution;
        }
        else {
            // Decrypt answer key
            const answerJson = await this.crypto.decrypt({
                ciphertext: version.encryptedAnswer,
                nonce: version.answerNonce,
                tag: version.answerTag,
                wrappedKey: version.encryptedAnswerKey,
                keyId: version.keyId,
            }, associatedData);
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
    async getAuthorFeedback(questionId, userId) {
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
            throw new common_1.ForbiddenException('You can only view feedback for your own questions');
        }
        const feedbackList = [];
        const reviewerLabels = ['Reviewer A', 'Reviewer B', 'Reviewer C', 'Reviewer D'];
        for (const v of question.versions) {
            let labelIdx = 0;
            const anonMap = {};
            for (const rev of v.reviews) {
                if (!anonMap[rev.reviewerId]) {
                    anonMap[rev.reviewerId] = reviewerLabels[labelIdx++ % reviewerLabels.length];
                }
                const anonRole = anonMap[rev.reviewerId];
                let commentsText = '';
                if (rev.encryptedComments &&
                    rev.commentsNonce &&
                    rev.commentsTag &&
                    rev.encryptedCommentsKey &&
                    rev.keyId) {
                    try {
                        commentsText = await this.crypto.decrypt({
                            ciphertext: rev.encryptedComments,
                            nonce: rev.commentsNonce,
                            tag: rev.commentsTag,
                            wrappedKey: rev.encryptedCommentsKey,
                            keyId: rev.keyId,
                        }, `${rev.id}:${questionId}:${v.versionNo}`);
                    }
                    catch {
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
    async createNewVersion(input, userId) {
        const parentVersion = await this.prisma.questionVersion.findUniqueOrThrow({
            where: { id: input.parentVersionId },
            include: { question: true },
        });
        if (parentVersion.authorId !== userId) {
            throw new common_1.ForbiddenException('You can only create revisions of your own questions');
        }
        if (!['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'].includes(parentVersion.status)) {
            throw new common_1.BadRequestException('Revisions can only be created from questions with status CHANGES_REQUESTED, APPROVED, or REJECTED');
        }
        if (!input.changeJustification || input.changeJustification.trim().length < 15) {
            throw new common_1.BadRequestException('A comprehensive change justification of at least 15 characters is required for revisions.');
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
        const encryptedContent = await this.crypto.encrypt(JSON.stringify(sanitizedContent), associatedData);
        // Encrypt answer
        const encryptedAnswer = await this.crypto.encrypt(JSON.stringify(answerKey), associatedData);
        const newVersion = await this.prisma.$transaction(async (tx) => {
            await tx.question.update({
                where: { id: parentVersion.questionId },
                data: {
                    currentVersion: newVersionNo,
                    difficulty: metadata.difficulty,
                    cognitiveLevel: metadata.cognitiveLevel,
                    marks: metadata.marks,
                    negativeMarks: metadata.negativeMarks ?? 0,
                    estimatedTime: metadata.estimatedTimeSeconds,
                    language: metadata.language || 'EN',
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
    async findAll(userId, userRole, filters) {
        const where = {};
        // EXAMINER sees only own questions
        if (userRole === 'EXAMINER') {
            where.authorId = userId;
        }
        // REVIEWER sees only SUBMITTED questions not authored by them
        if (userRole === 'REVIEWER') {
            where.authorId = { not: userId };
            where.versions = { some: { status: 'SUBMITTED' } };
        }
        // MODERATOR sees only questions that reach their queue (DUPLICATE_FLAGGED, MODERATION, or unresolved disagreements)
        if (userRole === 'MODERATOR') {
            where.authorId = { not: userId }; // Cannot see own authored questions
            where.versions = {
                some: {
                    OR: [
                        { status: 'DUPLICATE_FLAGGED' },
                        { status: 'MODERATION' },
                        {
                            reviews: {
                                some: {
                                    disagreementFlag: true,
                                    disagreementResolved: false,
                                },
                            },
                        },
                        {
                            difficultyConflictFlag: true,
                            difficultyConflictResolved: false,
                        },
                    ],
                },
            };
        }
        if (filters.subjectId)
            where.subjectId = filters.subjectId;
        if (filters.type)
            where.type = filters.type;
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
                authorName: userRole === 'MODERATOR' ? 'Author' : q.author.name,
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
    async getVersionHistory(questionId, userId, userRole) {
        const question = await this.prisma.question.findUniqueOrThrow({
            where: { id: questionId },
        });
        if (userRole === 'EXAMINER' && question.authorId !== userId) {
            throw new common_1.ForbiddenException('You can only view your own questions');
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
    sanitizeContent(content) {
        return {
            ...content,
            stem: (0, sanitize_html_1.default)(content.stem, {
                allowedTags: [], // Strip all HTML
                allowedAttributes: {},
            }),
            options: content.options?.map((opt) => ({
                ...opt,
                text: (0, sanitize_html_1.default)(opt.text, { allowedTags: [], allowedAttributes: {} }),
            })),
            solution: content.solution
                ? (0, sanitize_html_1.default)(content.solution, { allowedTags: [], allowedAttributes: {} })
                : undefined,
        };
    }
    /**
     * Lock or unlock question workflow (Admin only)
     */
    async toggleLock(questionId, isLocked, reason, adminId) {
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
};
exports.QuestionsService = QuestionsService;
exports.QuestionsService = QuestionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        audit_service_1.AuditService,
        screening_queue_1.ScreeningQueue])
], QuestionsService);
//# sourceMappingURL=questions.service.js.map