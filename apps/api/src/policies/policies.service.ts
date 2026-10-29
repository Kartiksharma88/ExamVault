import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProposePolicyInput, ApprovePolicyInput } from '@examvault/shared';

@Injectable()
export class PoliciesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Get default fallback policy or create genesis policy if none exists
   */
  async getOrCreateDefaultPolicy(adminId?: string) {
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
  async proposePolicy(input: ProposePolicyInput, proposerId: string) {
    // Proposer must be ADMIN
    const proposer = await this.prisma.user.findUniqueOrThrow({
      where: { id: proposerId },
    });
    if (proposer.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can propose approval policies');
    }

    // Determine current version number for this scope
    const existingPolicies = await this.prisma.approvalPolicy.findMany({
      where: {
        examId: input.examId || null,
        subjectId: input.subjectId || null,
        questionType: (input.questionType as any) || null,
      },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existingPolicies.length > 0 ? existingPolicies[0].version + 1 : 1;

    const policy = await this.prisma.approvalPolicy.create({
      data: {
        examId: input.examId || null,
        subjectId: input.subjectId || null,
        questionType: (input.questionType as any) || null,
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
        difficultyTolerance: (policy as any).difficultyTolerance,
      },
    });

    return policy;
  }

  /**
   * Approve a proposed policy (Two-Person Rule: approver must be an ADMIN different from proposer)
   */
  async approvePolicy(input: ApprovePolicyInput, approverId: string) {
    const approver = await this.prisma.user.findUniqueOrThrow({
      where: { id: approverId },
    });
    if (approver.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can approve policies');
    }

    const policy = await this.prisma.approvalPolicy.findUnique({
      where: { id: input.policyId },
    });
    if (!policy) {
      throw new NotFoundException('Policy proposal not found');
    }

    if (policy.isActive) {
      throw new BadRequestException('Policy is already active');
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
      throw new ForbiddenException(
        'Dual-control violation: The administrator proposing a policy cannot approve their own proposal.',
      );
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
  async getActivePolicy(subjectId?: string, examId?: string, questionType?: string) {
    // 1. Try Subject + Type
    if (subjectId && questionType) {
      const match = await this.prisma.approvalPolicy.findFirst({
        where: { subjectId, questionType: questionType as any, isActive: true },
        orderBy: { version: 'desc' },
      });
      if (match) return match;
    }

    // 2. Try Subject
    if (subjectId) {
      const match = await this.prisma.approvalPolicy.findFirst({
        where: { subjectId, questionType: null, isActive: true },
        orderBy: { version: 'desc' },
      });
      if (match) return match;
    }

    // 3. Try Exam
    if (examId) {
      const match = await this.prisma.approvalPolicy.findFirst({
        where: { examId, subjectId: null, questionType: null, isActive: true },
        orderBy: { version: 'desc' },
      });
      if (match) return match;
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
}
