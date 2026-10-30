"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoliciesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let PoliciesService = class PoliciesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    /**
     * Get default fallback policy or create genesis policy if none exists
     */
    async getOrCreateDefaultPolicy(adminId) {
        let defaultPolicy = await this.prisma.approvalPolicy.findFirst({
            where: {
                examId: null,
                subjectId: null,
                questionType: null,
                isActive: true,
            },
            orderBy: { version: 'desc' },
        });
        if (!defaultPolicy) {
            // Find system admin or first admin
            const admin = adminId
                ? await this.prisma.user.findUnique({ where: { id: adminId } })
                : await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) {
                defaultPolicy = await this.prisma.approvalPolicy.create({
                    data: {
                        version: 1,
                        requiredReviewers: 2,
                        requireBlindSolve: true,
                        requireModerator: true,
                        requireLanguageReview: true,
                        maxReviewDays: 7,
                        exactMatchThreshold: 1.0,
                        highSimilarityThreshold: 0.85,
                        mediumSimilarityThreshold: 0.60,
                        effectiveFrom: new Date(),
                        proposedById: admin.id,
                        approvedById: admin.id, // Genesis bootstrap approval
                        isActive: true,
                    },
                });
            }
        }
        return defaultPolicy;
    }
    /**
     * Propose a new approval policy (requires two-person rule: proposer != approver)
     */
    async proposePolicy(input, proposerId) {
        // Proposer must be ADMIN
        const proposer = await this.prisma.user.findUniqueOrThrow({
            where: { id: proposerId },
        });
        if (proposer.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Only administrators can propose approval policies');
        }
        // Determine current version number for this scope
        const existingPolicies = await this.prisma.approvalPolicy.findMany({
            where: {
                examId: input.examId || null,
                subjectId: input.subjectId || null,
                questionType: input.questionType || null,
            },
            orderBy: { version: 'desc' },
            take: 1,
        });
        const nextVersion = existingPolicies.length > 0 ? existingPolicies[0].version + 1 : 1;
        const policy = await this.prisma.approvalPolicy.create({
            data: {
                examId: input.examId || null,
                subjectId: input.subjectId || null,
                questionType: input.questionType || null,
                version: nextVersion,
                requiredReviewers: input.requiredReviewers ?? 2,
                difficultyTolerance: input.difficultyTolerance ?? 20,
                requireBlindSolve: input.requireBlindSolve ?? true,
                requireModerator: input.requireModerator ?? true,
                requireLanguageReview: input.requireLanguageReview ?? true,
                maxReviewDays: input.maxReviewDays ?? 7,
                exactMatchThreshold: input.exactMatchThreshold ?? 1.0,
                highSimilarityThreshold: input.highSimilarityThreshold ?? 0.85,
                mediumSimilarityThreshold: input.mediumSimilarityThreshold ?? 0.60,
                proposedById: proposerId,
                approvedById: null,
                isActive: false, // Inactive until dual-admin approved
            },
        });
        await this.audit.log({
            actorId: proposerId,
            action: 'POLICY_PROPOSE',
            targetType: 'approval_policy',
            targetId: policy.id,
            metadata: {
                version: policy.version,
                subjectId: policy.subjectId,
                examId: policy.examId,
                requiredReviewers: policy.requiredReviewers,
                difficultyTolerance: policy.difficultyTolerance,
            },
        });
        return policy;
    }
    /**
     * Approve a proposed policy (Two-Person Rule: approver must be an ADMIN different from proposer)
     */
    async approvePolicy(input, approverId) {
        const approver = await this.prisma.user.findUniqueOrThrow({
            where: { id: approverId },
        });
        if (approver.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Only administrators can approve policies');
        }
        const policy = await this.prisma.approvalPolicy.findUnique({
            where: { id: input.policyId },
        });
        if (!policy) {
            throw new common_1.NotFoundException('Policy proposal not found');
        }
        if (policy.isActive) {
            throw new common_1.BadRequestException('Policy is already active');
        }
        // STRICT TWO-PERSON RULE: Approver cannot be the proposer!
        if (policy.proposedById === approverId) {
            await this.audit.log({
                actorId: approverId,
                action: 'ACCESS_DENIED',
                targetType: 'approval_policy',
                targetId: policy.id,
                metadata: { reason: 'two_person_rule_violation', proposedById: policy.proposedById },
            });
            throw new common_1.ForbiddenException('Dual-control violation: The administrator proposing a policy cannot approve their own proposal.');
        }
        // Deactivate previous active policy for this exact scope
        await this.prisma.approvalPolicy.updateMany({
            where: {
                examId: policy.examId,
                subjectId: policy.subjectId,
                questionType: policy.questionType,
                isActive: true,
            },
            data: { isActive: false },
        });
        // Activate the new policy
        const activatedPolicy = await this.prisma.approvalPolicy.update({
            where: { id: policy.id },
            data: {
                isActive: true,
                approvedById: approverId,
                effectiveFrom: new Date(),
            },
            include: {
                proposedBy: { select: { id: true, name: true, email: true } },
                approvedBy: { select: { id: true, name: true, email: true } },
            },
        });
        await this.audit.log({
            actorId: approverId,
            action: 'POLICY_APPROVE',
            targetType: 'approval_policy',
            targetId: policy.id,
            metadata: {
                version: policy.version,
                proposedBy: policy.proposedById,
                approvedBy: approverId,
            },
        });
        return activatedPolicy;
    }
    /**
     * Find the active policy in effect for a given scope (hierarchical fallback)
     */
    async getActivePolicy(subjectId, examId, questionType) {
        // 1. Try Subject + Type
        if (subjectId && questionType) {
            const match = await this.prisma.approvalPolicy.findFirst({
                where: { subjectId, questionType: questionType, isActive: true },
                orderBy: { version: 'desc' },
            });
            if (match)
                return match;
        }
        // 2. Try Subject
        if (subjectId) {
            const match = await this.prisma.approvalPolicy.findFirst({
                where: { subjectId, questionType: null, isActive: true },
                orderBy: { version: 'desc' },
            });
            if (match)
                return match;
        }
        // 3. Try Exam
        if (examId) {
            const match = await this.prisma.approvalPolicy.findFirst({
                where: { examId, subjectId: null, questionType: null, isActive: true },
                orderBy: { version: 'desc' },
            });
            if (match)
                return match;
        }
        // 4. Default global policy
        return this.getOrCreateDefaultPolicy();
    }
    /**
     * List all policies
     */
    async listPolicies() {
        await this.getOrCreateDefaultPolicy();
        return this.prisma.approvalPolicy.findMany({
            orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
            include: {
                proposedBy: { select: { id: true, name: true, email: true } },
                approvedBy: { select: { id: true, name: true, email: true } },
                subject: { select: { id: true, name: true, code: true } },
                exam: { select: { id: true, name: true } },
            },
        });
    }
};
exports.PoliciesService = PoliciesService;
exports.PoliciesService = PoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PoliciesService);
//# sourceMappingURL=policies.service.js.map