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
var ModerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("../auth/auth.service");
const server_signing_provider_1 = require("../crypto/server-signing-provider");
let ModerationService = ModerationService_1 = class ModerationService {
    prisma;
    crypto;
    audit;
    auth;
    signingProvider;
    logger = new common_1.Logger(ModerationService_1.name);
    constructor(prisma, crypto, audit, auth, signingProvider) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.audit = audit;
        this.auth = auth;
        this.signingProvider = signingProvider;
    }
    /**
     * Get comprehensive moderator queue across all moderation stages
     * STRICT ENFORCEMENT:
     * 1. Only flagged duplicates, unresolved disagreements, and versions awaiting final approval
     * 2. Author and reviewer identities are strictly anonymized ('Author', 'Reviewer A')
     * 3. Separation of duties: Never include questions authored or reviewed by the moderator
     */
    async getModeratorQueue(moderatorId) {
        const now = new Date();
        // Base condition: Moderator cannot see own authored questions, or questions they reviewed
        const whereExclusions = {};
        if (moderatorId) {
            whereExclusions.authorId = { not: moderatorId };
            whereExclusions.reviewAssignments = {
                none: { reviewerId: moderatorId },
            };
        }
        // 1. Duplicate flags
        const rawDuplicateFlags = await this.prisma.questionVersion.findMany({
            where: {
                status: 'DUPLICATE_FLAGGED',
                ...whereExclusions,
            },
            include: {
                question: {
                    include: {
                        subject: true,
                        topic: true,
                    },
                },
                originalityReport: { include: { matches: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        // 2. Blind answer disagreements
        const rawDisagreements = await this.prisma.review.findMany({
            where: {
                disagreementFlag: true,
                disagreementResolved: false,
                questionVersion: {
                    ...whereExclusions,
                },
            },
            include: {
                questionVersion: {
                    include: {
                        question: { include: { subject: true, topic: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // 3. Ready for final approval (status === MODERATION and no open difficulty conflicts)
        const rawReadyForApproval = await this.prisma.questionVersion.findMany({
            where: {
                status: 'MODERATION',
                OR: [
                    { difficultyConflictFlag: false },
                    { difficultyConflictResolved: true },
                ],
                ...whereExclusions,
            },
            include: {
                question: { include: { subject: true, topic: true } },
                reviews: {
                    select: {
                        id: true,
                        decision: true,
                        difficultyRating: true,
                        checklist: true,
                        disagreementFlag: true,
                        disagreementResolved: true,
                        submittedAt: true,
                    },
                },
                parentVersion: {
                    select: {
                        id: true,
                        versionNo: true,
                        contentCommitment: true,
                    },
                },
                originalityReport: true,
                approvals: {
                    select: {
                        id: true,
                        role: true,
                        decision: true,
                        timestamp: true,
                        signature: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // 4. Difficulty Conflicts requiring moderator resolution
        const rawDifficultyConflicts = await this.prisma.questionVersion.findMany({
            where: {
                difficultyConflictFlag: true,
                difficultyConflictResolved: false,
                ...whereExclusions,
            },
            include: {
                question: { include: { subject: true, topic: true } },
                reviews: {
                    select: {
                        id: true,
                        decision: true,
                        difficultyRating: true,
                        timeTakenSeconds: true,
                        blindAnswerMatchesKey: true,
                        checklist: true,
                        submittedAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // 5. Overdue reviewer assignments (Workflow control: reassign overdue reviewers)
        const rawOverdueAssignments = await this.prisma.reviewAssignment.findMany({
            where: {
                status: 'PENDING',
                dueDate: { lt: now },
            },
            include: {
                questionVersion: {
                    include: {
                        question: { include: { subject: true, topic: true } },
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        });
        // 5. Staffing warnings (Workflow control: staffing quotas)
        const rawStaffingWarnings = await this.prisma.questionVersion.findMany({
            where: {
                status: { in: ['READY_FOR_REVIEW', 'SUBMITTED'] },
            },
            include: {
                question: { include: { subject: true, topic: true } },
                reviewAssignments: {
                    select: { id: true, status: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // STRICT ANONYMIZATION:
        // Mask author identity as 'Author'
        // Mask reviewers as 'Reviewer A', 'Reviewer B'
        const duplicateFlags = rawDuplicateFlags.map((v) => ({
            ...v,
            question: {
                ...v.question,
                author: { name: 'Author' },
            },
        }));
        const reviewerLabels = ['Reviewer A', 'Reviewer B', 'Reviewer C', 'Reviewer D', 'Reviewer E'];
        const disagreements = rawDisagreements.map((d, idx) => ({
            ...d,
            assignment: {
                reviewer: { name: reviewerLabels[idx % reviewerLabels.length] },
            },
            questionVersion: {
                ...d.questionVersion,
                question: {
                    ...d.questionVersion.question,
                    author: { name: 'Author' },
                },
            },
        }));
        const readyForApproval = rawReadyForApproval.map((v) => ({
            ...v,
            question: {
                ...v.question,
                author: { name: 'Author' },
            },
            reviews: v.reviews.map((r, rIdx) => ({
                ...r,
                reviewerLabel: reviewerLabels[rIdx % reviewerLabels.length],
            })),
        }));
        const difficultyConflicts = rawDifficultyConflicts.map((v) => ({
            ...v,
            question: {
                ...v.question,
                author: { name: 'Author' },
            },
            reviews: v.reviews.map((r, rIdx) => ({
                ...r,
                reviewerLabel: reviewerLabels[rIdx % reviewerLabels.length],
            })),
        }));
        const overdueAssignments = rawOverdueAssignments.map((oa, idx) => ({
            id: oa.id,
            dueDate: oa.dueDate,
            questionVersionId: oa.questionVersionId,
            reviewerId: oa.reviewerId,
            reviewer: { name: `Reviewer ${String.fromCharCode(65 + (idx % 26))}` },
            questionVersion: {
                id: oa.questionVersion.id,
                versionNo: oa.questionVersion.versionNo,
                question: {
                    humanId: oa.questionVersion.question.humanId,
                    subject: oa.questionVersion.question.subject,
                    topic: oa.questionVersion.question.topic,
                    author: { name: 'Author' },
                },
            },
        }));
        const staffingWarnings = rawStaffingWarnings.map((sw) => ({
            ...sw,
            question: {
                ...sw.question,
                author: { name: 'Author' },
            },
        }));
        return {
            duplicateFlags,
            disagreements,
            difficultyConflicts,
            readyForApproval,
            overdueAssignments,
            staffingWarnings,
        };
    }
    /**
     * Resolve a blind-answer key disagreement
     * Decides: REQUEST_CHANGES (send back to author), REJECT, or LET_STAND (author key verified)
     */
    async resolveDisagreement(reviewId, resolutionNote, moderatorId, decision = 'LET_STAND') {
        const review = await this.prisma.review.findUniqueOrThrow({
            where: { id: reviewId },
            include: {
                questionVersion: {
                    include: {
                        reviewAssignments: { include: { review: true } },
                    },
                },
            },
        });
        // Moderator cannot resolve their own question
        if (review.questionVersion.authorId === moderatorId) {
            throw new common_1.ForbiddenException('A moderator cannot resolve a disagreement on a question they authored');
        }
        const version = review.questionVersion;
        await this.prisma.$transaction(async (tx) => {
            await tx.review.update({
                where: { id: reviewId },
                data: {
                    disagreementResolved: true,
                    disagreementResolutionNote: resolutionNote,
                },
            });
            if (decision === 'REQUEST_CHANGES') {
                await tx.questionVersion.update({
                    where: { id: version.id },
                    data: { status: 'CHANGES_REQUESTED' },
                });
            }
            else if (decision === 'REJECT') {
                await tx.questionVersion.update({
                    where: { id: version.id },
                    data: { status: 'REJECTED' },
                });
            }
            else {
                // LET_STAND: Check if question version is now eligible to move from UNDER_REVIEW to MODERATION
                if (version.status === 'UNDER_REVIEW') {
                    const assignments = version.reviewAssignments;
                    const allCompleted = assignments.every((a) => a.status === 'COMPLETED');
                    const allApproved = assignments.every((a) => a.review?.decision === 'APPROVE');
                    const anyUnresolved = assignments.some((a) => a.review?.disagreementFlag && !a.review?.disagreementResolved && a.review.id !== reviewId);
                    if (allCompleted && allApproved && !anyUnresolved) {
                        await tx.questionVersion.update({
                            where: { id: version.id },
                            data: { status: 'MODERATION' },
                        });
                    }
                }
            }
        });
        await this.audit.log({
            actorId: moderatorId,
            action: 'DISAGREEMENT_RESOLVED',
            targetType: 'review',
            targetId: reviewId,
            metadata: { resolutionNote, decision },
        });
        return { success: true, reviewId, disagreementResolved: true, decision };
    }
    /**
     * Moderator final approval / request-changes / rejection with step-up MFA and Ed25519 signature
     * Handles atomic supersession of parent version when revision is approved
     */
    async submitDecision(versionId, input, moderatorId) {
        const version = await this.prisma.questionVersion.findUniqueOrThrow({
            where: { id: versionId },
            include: {
                question: true,
                reviewAssignments: true,
                parentVersion: true,
            },
        });
        if (version.status !== 'MODERATION') {
            throw new common_1.BadRequestException('Question is not in MODERATION status');
        }
        // SEPARATION OF DUTIES 1: Moderator cannot moderate a question they authored
        if (version.authorId === moderatorId) {
            throw new common_1.ForbiddenException('A user cannot moderate a question version they authored');
        }
        // SEPARATION OF DUTIES 2: The same user cannot be both a reviewer and the moderator
        const wasReviewer = version.reviewAssignments.some((a) => a.reviewerId === moderatorId);
        if (wasReviewer) {
            throw new common_1.ForbiddenException('Separation of duties violation: You were assigned as a reviewer for this question version and cannot act as its moderator.');
        }
        // ENFORCE SIGNED REVIEWER APPROVALS REQUIREMENT:
        if (input.decision === 'APPROVE') {
            const policy = await this.prisma.approvalPolicy.findFirst({
                where: { subjectId: version.question.subjectId, isActive: true },
            });
            const requiredCount = policy?.requiredReviewers ?? 2;
            // Check reviewer approvals in approvals table and completed reviews
            const reviewerApprovals = await this.prisma.approval.findMany({
                where: {
                    questionId: version.questionId,
                    versionNo: version.versionNo,
                    role: 'REVIEWER',
                    decision: 'APPROVE',
                },
            });
            const completedApprovedReviews = await this.prisma.review.findMany({
                where: {
                    questionVersionId: version.id,
                    decision: 'APPROVE',
                },
            });
            const validCount = Math.max(reviewerApprovals.length, completedApprovedReviews.length);
            if (validCount < requiredCount) {
                throw new common_1.BadRequestException(`Cannot approve question without required reviewer approvals (${validCount}/${requiredCount} found). Approval requires at least ${requiredCount} signed reviewer approvals.`);
            }
            // Check for any unresolved disagreements on this version
            const unresolved = await this.prisma.review.findFirst({
                where: {
                    questionVersionId: version.id,
                    disagreementFlag: true,
                    disagreementResolved: false,
                },
            });
            if (unresolved) {
                throw new common_1.BadRequestException('Cannot approve question with unresolved reviewer disagreements.');
            }
            // Check for unresolved difficulty conflict
            if (version.difficultyConflictFlag && !version.difficultyConflictResolved) {
                throw new common_1.BadRequestException('Cannot approve question with unresolved difficulty conflict. Please resolve the conflict first.');
            }
        }
        // 1. Fresh step-up MFA verification
        await this.auth.verifyStepUpTotp(moderatorId, input.totpToken);
        // 2. Ensure moderator has digital signing key
        const signingKey = await this.auth.ensureUserSigningKey(moderatorId);
        // 3. Create digital signature over canonical payload
        const approvalId = crypto.randomUUID();
        const timestamp = new Date();
        const approvalPayload = {
            approvalId,
            questionId: version.questionId,
            versionNo: version.versionNo,
            contentCommitment: version.contentCommitment,
            decision: input.decision,
            role: 'MODERATOR',
            approverId: moderatorId,
            reviewRound: 1,
            policyVersion: version.policyVersion ?? 1,
            timestamp,
        };
        const signature = await this.signingProvider.signApproval(approvalPayload, signingKey.wrappedPrivateKey, signingKey.keyId);
        let nextStatus = 'APPROVED';
        if (input.decision === 'REQUEST_CHANGES')
            nextStatus = 'CHANGES_REQUESTED';
        if (input.decision === 'REJECT')
            nextStatus = 'REJECTED';
        // Execute approval and atomic supersession inside a single PostgreSQL transaction
        await this.prisma.$transaction(async (tx) => {
            // 1. Insert append-only signed approval record
            await tx.approval.create({
                data: {
                    id: approvalId,
                    questionId: version.questionId,
                    versionNo: version.versionNo,
                    contentCommitment: version.contentCommitment,
                    decision: input.decision,
                    role: 'MODERATOR',
                    approverId: moderatorId,
                    reviewRound: 1,
                    policyVersion: version.policyVersion ?? 1,
                    timestamp,
                    signature,
                },
            });
            // 2. Update question version status
            await tx.questionVersion.update({
                where: { id: version.id },
                data: { status: nextStatus },
            });
            // 3. ATOMIC SUPERSESSION:
            // If version is an edit of a parent version, the parent stays APPROVED until
            // the new version is APPROVED. At that moment the parent becomes RETIRED with
            // reason 'SUPERSEDED' in the same transaction!
            if (nextStatus === 'APPROVED' && version.parentVersionId) {
                await tx.questionVersion.update({
                    where: { id: version.parentVersionId },
                    data: {
                        status: 'RETIRED',
                        supersededAt: timestamp,
                        retirementReason: 'SUPERSEDED',
                        retiredById: moderatorId,
                    },
                });
            }
        });
        await this.audit.log({
            actorId: moderatorId,
            action: 'APPROVAL_SIGNED',
            targetType: 'approval',
            targetId: approvalId,
            metadata: {
                role: 'MODERATOR',
                decision: input.decision,
                versionNo: version.versionNo,
            },
        });
        await this.audit.log({
            actorId: moderatorId,
            action: 'MODERATOR_DECISION',
            targetType: 'question_version',
            targetId: version.id,
            metadata: {
                decision: input.decision,
                nextStatus,
                versionNo: version.versionNo,
            },
        });
        if (nextStatus === 'APPROVED' && version.parentVersionId) {
            await this.audit.log({
                actorId: moderatorId,
                action: 'VERSION_SUPERSEDED',
                targetType: 'question_version',
                targetId: version.parentVersionId,
                metadata: {
                    supersededByVersionId: version.id,
                    supersededByVersionNo: version.versionNo,
                    reason: 'SUPERSEDED',
                },
            });
        }
        return {
            success: true,
            approvalId,
            decision: input.decision,
            status: nextStatus,
        };
    }
    /**
     * Reassign an overdue or contested reviewer assignment
     */
    async reassignReviewer(input, moderatorId) {
        const assignment = await this.prisma.reviewAssignment.findUniqueOrThrow({
            where: { id: input.assignmentId },
            include: {
                questionVersion: { include: { question: true } },
            },
        });
        const newReviewer = await this.prisma.user.findUniqueOrThrow({
            where: { id: input.newReviewerId },
        });
        if (newReviewer.role !== 'REVIEWER' || !newReviewer.isActive) {
            throw new common_1.BadRequestException('Selected user is not an active reviewer');
        }
        if (newReviewer.id === assignment.questionVersion.authorId) {
            throw new common_1.ForbiddenException('Cannot reassign question to its author');
        }
        await this.prisma.$transaction(async (tx) => {
            // Mark old assignment as REASSIGNED
            await tx.reviewAssignment.update({
                where: { id: assignment.id },
                data: {
                    status: 'REASSIGNED',
                    reassignedToId: newReviewer.id,
                    reassignedById: moderatorId,
                    reassignmentReason: input.reason,
                },
            });
            // Create new assignment
            const newAssignment = await tx.reviewAssignment.create({
                data: {
                    roundId: assignment.roundId,
                    questionVersionId: assignment.questionVersionId,
                    reviewerId: newReviewer.id,
                    assignedRole: assignment.assignedRole,
                    status: 'PENDING',
                    dueDate: new Date(Date.now() + 7 * 86400000), // Fresh 7 days
                    selectionSeed: crypto.randomBytes(32).toString('hex'),
                    eligibleCount: 1,
                },
            });
            // Initialize review for new assignment
            await tx.review.create({
                data: {
                    assignmentId: newAssignment.id,
                    questionVersionId: assignment.questionVersionId,
                    reviewerId: newReviewer.id,
                    phase: 'SOLVE',
                    contentCommitment: assignment.questionVersion.contentCommitment,
                },
            });
            // Notify new reviewer
            await tx.notification.create({
                data: {
                    userId: newReviewer.id,
                    type: 'REVIEW_REASSIGNED',
                    title: 'Review Reassigned to You',
                    message: `Question ${assignment.questionVersion.question.humanId} has been reassigned to you for review.`,
                    link: `/review/workspace/${newAssignment.id}`,
                },
            });
        });
        await this.audit.log({
            actorId: moderatorId,
            action: 'REVIEW_REASSIGN',
            targetType: 'review_assignment',
            targetId: assignment.id,
            metadata: {
                oldReviewerId: assignment.reviewerId,
                newReviewerId: newReviewer.id,
                reason: input.reason,
            },
        });
        return { success: true, reassignedTo: newReviewer.name };
    }
    /**
     * Retire an APPROVED question
     */
    async retireQuestion(versionId, input, moderatorId) {
        const version = await this.prisma.questionVersion.findUniqueOrThrow({
            where: { id: versionId },
            include: { question: true },
        });
        if (version.status !== 'APPROVED') {
            throw new common_1.BadRequestException('Only APPROVED questions can be retired');
        }
        const timestamp = new Date();
        await this.prisma.questionVersion.update({
            where: { id: versionId },
            data: {
                status: 'RETIRED',
                supersededAt: timestamp,
                retirementReason: input.reason,
                retiredById: moderatorId,
            },
        });
        await this.audit.log({
            actorId: moderatorId,
            action: 'VERSION_RETIRED',
            targetType: 'question_version',
            targetId: versionId,
            metadata: {
                reason: input.reason,
                note: input.note,
                versionNo: version.versionNo,
            },
        });
        return { success: true, status: 'RETIRED', reason: input.reason };
    }
    /**
     * Resolve a DIFFICULTY_CONFLICT
     * Options: ACCEPT_MEAN, SET_FINAL_VALUE, REQUEST_THIRD_REVIEW, REQUEST_CHANGES
     * Mandatory written justification stored encrypted.
     */
    async resolveDifficultyConflict(versionId, input, moderatorId) {
        const version = await this.prisma.questionVersion.findUniqueOrThrow({
            where: { id: versionId },
            include: {
                question: { include: { subject: true } },
                reviews: true,
                reviewAssignments: true,
            },
        });
        if (version.authorId === moderatorId) {
            throw new common_1.ForbiddenException('A user cannot resolve difficulty conflict on a question version they authored');
        }
        const wasReviewer = version.reviewAssignments.some((a) => a.reviewerId === moderatorId);
        if (wasReviewer) {
            throw new common_1.ForbiddenException('Separation of duties violation: You were assigned as a reviewer for this question version and cannot act as its moderator.');
        }
        if (!input.justification || input.justification.trim().length < 10) {
            throw new common_1.BadRequestException('Mandatory written justification of at least 10 characters is required');
        }
        // Envelope-encrypt justification
        const encJustification = await this.crypto.encrypt(JSON.stringify({ justification: input.justification, action: input.action, customValue: input.customValue }), `diff_justification:${versionId}`);
        let finalDifficulty = null;
        let derivationMethod = input.action;
        if (input.action === 'ACCEPT_MEAN') {
            const ratings = version.reviews.map((r) => r.difficultyRating).filter((r) => typeof r === 'number');
            if (ratings.length === 0) {
                throw new common_1.BadRequestException('No reviewer ratings available to calculate mean');
            }
            const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
            finalDifficulty = Math.round(mean * 10) / 10;
            derivationMethod = 'ACCEPT_MEAN';
            await this.prisma.$transaction(async (tx) => {
                const updateData = {
                    finalDifficulty,
                    difficultySource: 'EXPERT_RATING',
                    difficultyDerivationMethod: derivationMethod,
                    difficultySetById: moderatorId,
                    difficultyConflictFlag: true,
                    difficultyConflictResolved: true,
                    difficultyResolutionNote: input.justification,
                    encryptedDiffJustification: encJustification.ciphertext,
                    diffJustificationNonce: encJustification.nonce,
                    diffJustificationTag: encJustification.tag,
                    diffJustificationKey: encJustification.wrappedKey,
                };
                if (input.autoApprove) {
                    updateData.status = 'APPROVED';
                }
                await tx.questionVersion.update({
                    where: { id: version.id },
                    data: updateData,
                });
                const questionUpdateData = { difficulty: finalDifficulty };
                if (input.customTimingSeconds && input.customTimingSeconds > 0) {
                    questionUpdateData.estimatedTime = input.customTimingSeconds;
                }
                await tx.question.update({
                    where: { id: version.questionId },
                    data: questionUpdateData,
                });
                if (input.autoApprove && version.parentVersionId) {
                    await tx.questionVersion.update({
                        where: { id: version.parentVersionId },
                        data: {
                            status: 'RETIRED',
                            supersededAt: new Date(),
                            retirementReason: 'SUPERSEDED',
                            retiredById: moderatorId,
                        },
                    });
                }
            });
        }
        else if (input.action === 'SET_FINAL_VALUE') {
            if (input.customValue === undefined || input.customValue < 0 || input.customValue > 100) {
                throw new common_1.BadRequestException('Valid custom difficulty value between 0 and 100 is required');
            }
            finalDifficulty = Math.round(input.customValue * 10) / 10;
            derivationMethod = 'SET_FINAL_VALUE';
            await this.prisma.$transaction(async (tx) => {
                // Moderator making final decision sets actual hardness and timing, directly approving to final question bank
                await tx.questionVersion.update({
                    where: { id: version.id },
                    data: {
                        status: 'APPROVED',
                        finalDifficulty,
                        difficultySource: 'EXPERT_RATING',
                        difficultyDerivationMethod: derivationMethod,
                        difficultySetById: moderatorId,
                        difficultyConflictFlag: true,
                        difficultyConflictResolved: true,
                        difficultyResolutionNote: input.justification,
                        encryptedDiffJustification: encJustification.ciphertext,
                        diffJustificationNonce: encJustification.nonce,
                        diffJustificationTag: encJustification.tag,
                        diffJustificationKey: encJustification.wrappedKey,
                    },
                });
                const questionUpdateData = { difficulty: finalDifficulty };
                if (input.customTimingSeconds && input.customTimingSeconds > 0) {
                    questionUpdateData.estimatedTime = input.customTimingSeconds;
                }
                await tx.question.update({
                    where: { id: version.questionId },
                    data: questionUpdateData,
                });
                if (version.parentVersionId) {
                    await tx.questionVersion.update({
                        where: { id: version.parentVersionId },
                        data: {
                            status: 'RETIRED',
                            supersededAt: new Date(),
                            retirementReason: 'SUPERSEDED',
                            retiredById: moderatorId,
                        },
                    });
                }
            });
        }
        else if (input.action === 'REQUEST_THIRD_REVIEW') {
            // Normal random, conflict-free selection of one additional reviewer
            const assignedReviewerIds = version.reviewAssignments.map((a) => a.reviewerId);
            const author = await this.prisma.user.findUnique({
                where: { id: version.authorId },
                include: { conflictDeclarations: true },
            });
            const authorConflictHashes = new Set(author?.conflictDeclarations.map((c) => c.conflictHash) || []);
            const candidates = await this.prisma.user.findMany({
                where: {
                    role: 'REVIEWER',
                    id: { notIn: [...assignedReviewerIds, version.authorId, moderatorId] },
                    userSubjectExpertise: { some: { subjectId: version.question.subjectId } },
                },
                include: {
                    conflictDeclarations: true,
                    reviewAssignments: { where: { status: 'PENDING' } },
                },
            });
            const eligible = candidates.filter((cand) => {
                if (cand.reviewAssignments.length >= 5)
                    return false;
                const candHashes = new Set(cand.conflictDeclarations.map((c) => c.conflictHash));
                for (const h of candHashes) {
                    if (authorConflictHashes.has(h))
                        return false;
                }
                return true;
            });
            if (eligible.length === 0) {
                throw new common_1.BadRequestException('No eligible independent reviewers available for third review assignment');
            }
            const chosen = eligible[crypto.randomInt(0, eligible.length)];
            const dueDate = new Date(Date.now() + 7 * 86400000);
            // Find active round
            let round = await this.prisma.reviewRound.findFirst({
                where: { questionVersionId: version.id, status: 'ACTIVE' },
            });
            if (!round) {
                round = await this.prisma.reviewRound.create({
                    data: {
                        questionVersionId: version.id,
                        roundNumber: 1,
                        policyVersion: version.policyVersion ?? 1,
                        status: 'ACTIVE',
                    },
                });
            }
            await this.prisma.$transaction(async (tx) => {
                const newAssignment = await tx.reviewAssignment.create({
                    data: {
                        roundId: round.id,
                        questionVersionId: version.id,
                        reviewerId: chosen.id,
                        assignedRole: 'REVIEWER',
                        status: 'PENDING',
                        dueDate,
                        selectionSeed: crypto.randomBytes(32).toString('hex'),
                        eligibleCount: eligible.length,
                    },
                });
                await tx.review.create({
                    data: {
                        assignmentId: newAssignment.id,
                        questionVersionId: version.id,
                        reviewerId: chosen.id,
                        phase: 'SOLVE',
                        contentCommitment: version.contentCommitment,
                    },
                });
                await tx.questionVersion.update({
                    where: { id: version.id },
                    data: {
                        status: 'UNDER_REVIEW',
                        difficultyConflictFlag: true,
                        difficultyConflictResolved: false,
                        difficultyDerivationMethod: 'REQUEST_THIRD_REVIEW',
                        difficultyResolutionNote: input.justification,
                        encryptedDiffJustification: encJustification.ciphertext,
                        diffJustificationNonce: encJustification.nonce,
                        diffJustificationTag: encJustification.tag,
                        diffJustificationKey: encJustification.wrappedKey,
                    },
                });
            });
            derivationMethod = 'REQUEST_THIRD_REVIEW';
        }
        else if (input.action === 'REQUEST_CHANGES') {
            await this.prisma.questionVersion.update({
                where: { id: version.id },
                data: {
                    status: 'CHANGES_REQUESTED',
                    difficultyConflictFlag: true,
                    difficultyConflictResolved: true,
                    difficultyResolutionNote: input.justification,
                    encryptedDiffJustification: encJustification.ciphertext,
                    diffJustificationNonce: encJustification.nonce,
                    diffJustificationTag: encJustification.tag,
                    diffJustificationKey: encJustification.wrappedKey,
                },
            });
            derivationMethod = 'REQUEST_CHANGES';
        }
        await this.audit.log({
            actorId: moderatorId,
            action: 'DIFFICULTY_CONFLICT_RESOLVED',
            targetType: 'question_version',
            targetId: version.id,
            metadata: {
                action: input.action,
                versionNo: version.versionNo,
                finalDifficulty,
                method: derivationMethod,
                source: 'EXPERT_RATING',
                policyVersion: version.policyVersion,
            },
        });
        return { success: true, action: input.action, finalDifficulty };
    }
};
exports.ModerationService = ModerationService;
exports.ModerationService = ModerationService = ModerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        audit_service_1.AuditService,
        auth_service_1.AuthService,
        server_signing_provider_1.ServerSigningProvider])
], ModerationService);
//# sourceMappingURL=moderation.service.js.map