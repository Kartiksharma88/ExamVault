import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { ServerSigningProvider } from '../crypto/server-signing-provider';
import {
  ModeratorDecisionInput,
  ReassignReviewerInput,
  RetireQuestionInput,
} from '@examvault/shared';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
    private auth: AuthService,
    private signingProvider: ServerSigningProvider,
  ) {}

  /**
   * Get comprehensive moderator queue across all moderation stages
   */
  async getModeratorQueue(moderatorId?: string) {
    const now = new Date();

    // 1. Duplicate flags
    const duplicateFlags = await this.prisma.questionVersion.findMany({
      where: { status: 'DUPLICATE_FLAGGED' },
      include: {
        question: { include: { subject: true, topic: true, author: { select: { id: true, name: true, email: true } } } },
        originalityReport: { include: { matches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Blind answer disagreements
    const disagreements = await this.prisma.review.findMany({
      where: {
        disagreementFlag: true,
        disagreementResolved: false,
      },
      include: {
        assignment: { include: { reviewer: { select: { id: true, name: true, email: true } } } },
        questionVersion: {
          include: {
            question: { include: { subject: true, topic: true, author: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Ready for final approval (status === MODERATION)
    const readyForApproval = await this.prisma.questionVersion.findMany({
      where: { status: 'MODERATION' },
      include: {
        question: { include: { subject: true, topic: true, author: { select: { id: true, name: true, email: true } } } },
        reviews: {
          include: {
            assignment: { select: { reviewerId: true, assignedRole: true } },
          },
        },
        approvals: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Overdue reviewer assignments
    const overdueAssignments = await this.prisma.reviewAssignment.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: now },
      },
      include: {
        reviewer: { select: { id: true, name: true, email: true, role: true } },
        questionVersion: {
          include: {
            question: { include: { subject: true, topic: true, author: { select: { id: true, name: true, email: true } } } },
          },
        },
        review: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // 5. Staffing warnings (READY_FOR_REVIEW / SUBMITTED questions needing reviewers)
    const staffingWarnings = await this.prisma.questionVersion.findMany({
      where: { status: { in: ['READY_FOR_REVIEW', 'SUBMITTED'] } },
      include: {
        question: { include: { subject: true, topic: true, author: { select: { id: true, name: true, email: true } } } },
        reviewAssignments: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 6. Active In-Review Pipeline (UNDER_REVIEW, READY_FOR_REVIEW, SUBMITTED)
    const activeReviews = await this.prisma.questionVersion.findMany({
      where: {
        status: { in: ['UNDER_REVIEW', 'READY_FOR_REVIEW', 'SUBMITTED'] },
      },
      include: {
        question: {
          include: {
            subject: true,
            topic: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        reviewAssignments: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, role: true } },
            review: {
              select: {
                id: true,
                phase: true,
                decision: true,
                disagreementFlag: true,
              },
            },
          },
        },
        approvals: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 7. My Assigned Reviews (Direct assignments for the logged-in moderator)
    const myAssignedReviews = moderatorId
      ? await this.prisma.reviewAssignment.findMany({
          where: { reviewerId: moderatorId },
          include: {
            questionVersion: {
              include: {
                question: {
                  include: {
                    subject: true,
                    topic: true,
                    author: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
            review: true,
          },
          orderBy: { dueDate: 'asc' },
        })
      : [];

    return {
      duplicateFlags,
      disagreements,
      readyForApproval,
      overdueAssignments,
      staffingWarnings,
      activeReviews,
      myAssignedReviews,
    };
  }

  /**
   * Resolve a blind-answer key disagreement
   */
  async resolveDisagreement(
    reviewId: string,
    resolutionNote: string,
    moderatorId: string,
  ) {
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
      throw new ForbiddenException('A moderator cannot resolve a disagreement on a question they authored');
    }

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        disagreementResolved: true,
        disagreementResolutionNote: resolutionNote,
      },
    });

    await this.audit.log({
      actorId: moderatorId,
      action: 'DISAGREEMENT_RESOLVED',
      targetType: 'review',
      targetId: reviewId,
      metadata: { resolutionNote },
    });

    // Check if question version is now eligible to move from UNDER_REVIEW to MODERATION
    const version = review.questionVersion;
    if (version.status === 'UNDER_REVIEW') {
      const assignments = version.reviewAssignments;
      const allCompleted = assignments.every((a) => a.status === 'COMPLETED');
      const allApproved = assignments.every((a) => a.review?.decision === 'APPROVE');
      const anyUnresolved = assignments.some(
        (a) => a.review?.disagreementFlag && !a.review?.disagreementResolved && a.review.id !== reviewId,
      );

      if (allCompleted && allApproved && !anyUnresolved) {
        await this.prisma.questionVersion.update({
          where: { id: version.id },
          data: { status: 'MODERATION' },
        });
      }
    }

    return { success: true, reviewId, disagreementResolved: true };
  }

  /**
   * Moderator final approval / request-changes / rejection with step-up MFA and Ed25519 signature
   * Handles atomic supersession of parent version when revision is approved
   */
  async submitDecision(
    versionId: string,
    input: ModeratorDecisionInput,
    moderatorId: string,
  ) {
    const version = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        question: true,
        reviewAssignments: true,
        parentVersion: true,
      },
    });

    if (version.status !== 'MODERATION') {
      throw new BadRequestException('Question is not in MODERATION status');
    }

    // SEPARATION OF DUTIES 1: Moderator cannot moderate a question they authored
    if (version.authorId === moderatorId) {
      throw new ForbiddenException('A user cannot moderate a question version they authored');
    }

    // SEPARATION OF DUTIES 2: The same user cannot be both a reviewer and the moderator
    const wasReviewer = version.reviewAssignments.some((a) => a.reviewerId === moderatorId);
    if (wasReviewer) {
      throw new ForbiddenException(
        'Separation of duties violation: You were assigned as a reviewer for this question version and cannot act as its moderator.',
      );
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

    const signature = await this.signingProvider.signApproval(
      approvalPayload,
      signingKey.wrappedPrivateKey,
      signingKey.keyId,
    );

    let nextStatus: any = 'APPROVED';
    if (input.decision === 'REQUEST_CHANGES') nextStatus = 'CHANGES_REQUESTED';
    if (input.decision === 'REJECT') nextStatus = 'REJECTED';

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
  async reassignReviewer(
    input: ReassignReviewerInput,
    moderatorId: string,
  ) {
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
      throw new BadRequestException('Selected user is not an active reviewer');
    }

    if (newReviewer.id === assignment.questionVersion.authorId) {
      throw new ForbiddenException('Cannot reassign question to its author');
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
  async retireQuestion(
    versionId: string,
    input: RetireQuestionInput,
    moderatorId: string,
  ) {
    const version = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { question: true },
    });

    if (version.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED questions can be retired');
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
}
