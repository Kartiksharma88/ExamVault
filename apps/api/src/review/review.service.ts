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
import { PoliciesService } from '../policies/policies.service';
import { ServerSigningProvider } from '../crypto/server-signing-provider';
import { BlindAnswerSubmitInput, ReviewSubmitInput } from '@examvault/shared';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
    private auth: AuthService,
    private policies: PoliciesService,
    private signingProvider: ServerSigningProvider,
  ) {}

  /**
   * Assign reviewers when a question reaches READY_FOR_REVIEW
   * Random cryptographic selection among eligible reviewers respecting conflicts & workload
   */
  async assignReviewers(versionId: string): Promise<any> {
    const version = await this.prisma.questionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { question: true },
    });

    if (version.status !== 'READY_FOR_REVIEW') {
      this.logger.warn(`Version ${versionId} is in status ${version.status}, cannot assign reviewers`);
      return { assigned: false, status: version.status };
    }

    const policy = await this.policies.getActivePolicy(
      version.question.subjectId,
      undefined,
      version.question.type,
    );

    const requiredReviewers = policy?.requiredReviewers ?? 2;
    const maxReviewDays = policy?.maxReviewDays ?? 7;

    // Fetch author conflict hashes
    const authorConflicts = await this.prisma.conflictDeclaration.findMany({
      where: { userId: version.authorId },
      select: { conflictHash: true },
    });
    const authorConflictHashes = new Set(authorConflicts.map((c) => c.conflictHash));

    // Find eligible candidates:
    // 1. Role REVIEWER
    // 2. Active
    // 3. Not author
    // 4. Has subject expertise
    const candidates = await this.prisma.user.findMany({
      where: {
        role: 'REVIEWER',
        isActive: true,
        id: { not: version.authorId },
        userSubjectExpertise: {
          some: { subjectId: version.question.subjectId },
        },
      },
      include: {
        conflictDeclarations: { select: { conflictHash: true } },
        reviewAssignments: {
          where: { status: { in: ['PENDING', 'SOLVED'] } },
          select: { id: true },
        },
      },
    });

    // Filter candidates by conflict of interest and workload cap (max 5 active)
    const eligibleReviewers = candidates.filter((cand) => {
      // Workload cap: max 5 active assignments
      if (cand.reviewAssignments.length >= 5) {
        return false;
      }

      // Check conflict overlap
      const candHashes = new Set(cand.conflictDeclarations.map((c) => c.conflictHash));
      for (const h of candHashes) {
        if (authorConflictHashes.has(h)) return false;
      }

      return true;
    });

    // Commit cryptographic selection seed
    const selectionSeed = crypto.randomBytes(32).toString('hex');

    // Check staffing availability
    if (eligibleReviewers.length < requiredReviewers) {
      this.logger.warn(
        `Staffing warning: Question ${version.question.humanId} needs ${requiredReviewers} reviewers, only ${eligibleReviewers.length} eligible.`,
      );

      // Create notification for moderators
      const moderators = await this.prisma.user.findMany({ where: { role: 'MODERATOR' } });
      for (const mod of moderators) {
        await this.prisma.notification.create({
          data: {
            userId: mod.id,
            type: 'STAFFING_WARNING',
            title: 'Review Staffing Warning',
            message: `Question ${version.question.humanId} requires ${requiredReviewers} reviewers but only ${eligibleReviewers.length} are available.`,
            link: `/moderation/queue`,
          },
        });
      }

      return {
        assigned: false,
        reason: 'insufficient_reviewers',
        requiredReviewers,
        eligibleCount: eligibleReviewers.length,
      };
    }

    // Cryptographically secure random selection (Node crypto)
    const selectedReviewers: any[] = [];
    const pool = [...eligibleReviewers];

    for (let i = 0; i < requiredReviewers; i++) {
      const idx = crypto.randomInt(0, pool.length);
      selectedReviewers.push(pool[idx]);
      pool.splice(idx, 1);
    }

    const dueDate = new Date(Date.now() + maxReviewDays * 86400000);

    // Create review round and assignments in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create ReviewRound
      const round = await tx.reviewRound.create({
        data: {
          questionVersionId: version.id,
          roundNumber: 1,
          policyVersion: policy?.version ?? 1,
          policyId: policy?.id,
          status: 'ACTIVE',
        },
      });

      // Create ReviewAssignment and initial Review for each reviewer
      const assignments = [];
      for (const rev of selectedReviewers) {
        const assignment = await tx.reviewAssignment.create({
          data: {
            roundId: round.id,
            questionVersionId: version.id,
            reviewerId: rev.id,
            assignedRole: 'REVIEWER',
            status: 'PENDING',
            dueDate,
            selectionSeed,
            eligibleCount: eligibleReviewers.length,
          },
        });

        // Initialize review record in SOLVE phase
        await tx.review.create({
          data: {
            assignmentId: assignment.id,
            questionVersionId: version.id,
            reviewerId: rev.id,
            phase: 'SOLVE',
            contentCommitment: version.contentCommitment,
          },
        });

        // Notify reviewer (IDs only, NO question text!)
        await tx.notification.create({
          data: {
            userId: rev.id,
            type: 'REVIEW_ASSIGNED',
            title: 'New Blind Review Assigned',
            message: `You have been assigned to review question ${version.question.humanId}. Due on ${dueDate.toLocaleDateString()}.`,
            link: `/review/workspace/${assignment.id}`,
          },
        });

        assignments.push(assignment);
      }

      // Transition question version to UNDER_REVIEW
      await tx.questionVersion.update({
        where: { id: version.id },
        data: { status: 'UNDER_REVIEW' },
      });

      return { round, assignments };
    });

    await this.audit.log({
      actorId: undefined,
      action: 'REVIEWER_ASSIGNMENT',
      targetType: 'question_version',
      targetId: version.id,
      metadata: {
        versionNo: version.versionNo,
        requiredReviewers,
        eligibleCount: eligibleReviewers.length,
        selectionSeed,
        assignedCount: selectedReviewers.length,
      },
    });

    return {
      assigned: true,
      roundId: result.round.id,
      assignedCount: selectedReviewers.length,
    };
  }

  /**
   * List reviewer assignments for current reviewer (anonymized)
   */
  async getReviewerQueue(reviewerId: string) {
    const assignments = await this.prisma.reviewAssignment.findMany({
      where: { reviewerId },
      include: {
        questionVersion: {
          select: {
            id: true,
            versionNo: true,
            status: true,
            contentCommitment: true,
            parentVersionId: true,
            changeJustification: true,
            question: {
              select: {
                id: true,
                humanId: true,
                type: true,
                difficulty: true,
                cognitiveLevel: true,
                marks: true,
                negativeMarks: true,
                language: true,
                subject: { select: { id: true, name: true, code: true } },
                topic: { select: { id: true, name: true } },
              },
            },
          },
        },
        review: {
          select: {
            id: true,
            phase: true,
            blindAnswerMatchesKey: true,
            disagreementFlag: true,
            decision: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }],
    });

    return assignments.map((a) => {
      const q = a.questionVersion?.question;
      return {
        ...a,
        humanId: q?.humanId,
        versionNo: a.questionVersion?.versionNo,
        subjectName: q?.subject?.name,
        subjectCode: q?.subject?.code,
        topicName: q?.topic?.name,
        type: q?.type,
        difficulty: q?.difficulty,
        cognitiveLevel: q?.cognitiveLevel,
        marks: q?.marks,
        negativeMarks: q?.negativeMarks,
        language: q?.language,
      };
    });
  }

  /**
   * Get assignment workspace details (server-enforced blind solve barrier)
   */
  async getAssignmentWorkspace(assignmentId: string, reviewerId: string) {
    const assignment = await this.prisma.reviewAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        questionVersion: {
          include: {
            question: {
              include: {
                subject: true,
                topic: true,
              },
            },
            parentVersion: true,
          },
        },
        review: true,
      },
    });

    if (assignment.reviewerId !== reviewerId) {
      throw new ForbiddenException('You can only access assignments assigned to you');
    }

    if (assignment.questionVersion.authorId === reviewerId) {
      throw new ForbiddenException('A user can never review a question version they authored');
    }

    const version = assignment.questionVersion;
    let review = assignment.review;
    if (!review) {
      review = await this.prisma.review.create({
        data: {
          assignmentId: assignment.id,
          questionVersionId: version.id,
          reviewerId: assignment.reviewerId,
          phase: 'SOLVE',
          contentCommitment: version.contentCommitment,
        },
      });
    }
    const isSolvePhase = review.phase === 'SOLVE';

    // Decrypt content inside API
    const associatedData = `${version.questionId}:${version.versionNo}`;
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
    const content = JSON.parse(contentStr);
    delete content._commitmentSalt;

    let answerKey: any = null;
    let parentDiff: any = null;

    // SERVER-ENFORCED BLIND BARRIER:
    // If in SOLVE phase: Solution and Answer Key are NEVER revealed!
    if (isSolvePhase) {
      delete content.solution; // Omit solution in blind solve phase
    } else {
      // In EVALUATE phase: reveal answer key and solution
      const answerStr = await this.crypto.decrypt(
        {
          ciphertext: version.encryptedAnswer,
          nonce: version.answerNonce,
          tag: version.answerTag,
          wrappedKey: version.encryptedAnswerKey,
          keyId: version.keyId,
        },
        associatedData,
      );
      answerKey = JSON.parse(answerStr);
    }

    // If revision, provide parent question content for diffing
    if (version.parentVersionId && version.parentVersion) {
      try {
        const parentData = `${version.questionId}:${version.parentVersion.versionNo}`;
        const parentContentStr = await this.crypto.decrypt(
          {
            ciphertext: version.parentVersion.encryptedContent,
            nonce: version.parentVersion.contentNonce,
            tag: version.parentVersion.contentTag,
            wrappedKey: version.parentVersion.encryptedContentKey,
            keyId: version.parentVersion.keyId,
          },
          parentData,
        );
        const parentContent = JSON.parse(parentContentStr);
        delete parentContent._commitmentSalt;
        if (isSolvePhase) delete parentContent.solution;

        parentDiff = {
          parentVersionNo: version.parentVersion.versionNo,
          changeJustification: version.changeJustification,
          parentContent,
        };
      } catch (err) {}
    }

    // Log content read
    await this.audit.log({
      actorId: reviewerId,
      action: 'QUESTION_CONTENT_READ',
      targetType: 'review_assignment',
      targetId: assignmentId,
      metadata: { phase: review?.phase ?? 'SOLVE', versionNo: version.versionNo },
    });

    const existingReview = review
      ? {
          blindAnswer: review.encryptedBlindAnswer ? 'SUBMITTED' : null,
          timeTakenSeconds: review.timeTakenSeconds,
          difficultyRating: review.difficultyRating,
          blindAnswerMatchesKey: review.blindAnswerMatchesKey,
          disagreementFlag: review.disagreementFlag,
          decision: review.decision,
          checklist: review.checklist,
          comments: null,
        }
      : null;

    return {
      assignmentId: assignment.id,
      questionId: version.questionId,
      humanId: version.question.humanId,
      versionNo: version.versionNo,
      status: version.status,
      phase: review?.phase ?? 'SOLVE',
      dueDate: assignment.dueDate,
      content,
      stem: content.stem,
      options: content.options || [],
      solution: content.solution,
      answerKey, // null if SOLVE phase!
      parentDiff,
      subject: version.question.subject,
      topic: version.question.topic,
      difficulty: version.question.difficulty,
      cognitiveLevel: version.question.cognitiveLevel,
      marks: version.question.marks,
      negativeMarks: version.question.negativeMarks,
      language: version.question.language,
      existingReview,
      review: review
        ? {
            id: review.id,
            phase: review.phase,
            timeTakenSeconds: review.timeTakenSeconds,
            difficultyRating: review.difficultyRating,
            blindAnswerMatchesKey: review.blindAnswerMatchesKey,
            disagreementFlag: review.disagreementFlag,
            decision: review.decision,
            checklist: review.checklist,
          }
        : null,
      metadata: {
        subject: version.question.subject,
        topic: version.question.topic,
        type: version.question.type,
        difficulty: version.question.difficulty,
        cognitiveLevel: version.question.cognitiveLevel,
        marks: version.question.marks,
        negativeMarks: version.question.negativeMarks,
        language: version.question.language,
      },
    };
  }

  /**
   * Phase 1: Submit blind solve answer
   * Encrypts blind answer, compares with answer key, flags disagreement if mismatched
   */
  async submitBlindAnswer(
    assignmentId: string,
    input: BlindAnswerSubmitInput,
    reviewerId: string,
  ) {
    const assignment = await this.prisma.reviewAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        questionVersion: true,
        review: true,
      },
    });

    if (assignment.reviewerId !== reviewerId) {
      throw new ForbiddenException('You can only submit reviews for your own assignments');
    }

    if (assignment.questionVersion.authorId === reviewerId) {
      throw new ForbiddenException('A user can never review a question version they authored');
    }

    let review = assignment.review;
    if (!review) {
      review = await this.prisma.review.create({
        data: {
          assignmentId: assignment.id,
          questionVersionId: assignment.questionVersion.id,
          reviewerId: assignment.reviewerId,
          phase: 'SOLVE',
          contentCommitment: assignment.questionVersion.contentCommitment,
        },
      });
    }

    if (review.phase !== 'SOLVE') {
      throw new BadRequestException('Blind answer has already been submitted for this review');
    }

    const version = assignment.questionVersion;

    // Encrypt blind answer with envelope encryption
    const associatedData = `review_blind:${review.id}:${version.id}`;
    const encBlind = await this.crypto.encrypt(
      JSON.stringify(input.blindAnswer),
      associatedData,
    );

    // Decrypt actual answer key to compute blind_answer_matches_key
    const keyData = `${version.questionId}:${version.versionNo}`;
    const answerStr = await this.crypto.decrypt(
      {
        ciphertext: version.encryptedAnswer,
        nonce: version.answerNonce,
        tag: version.answerTag,
        wrappedKey: version.encryptedAnswerKey,
        keyId: version.keyId,
      },
      keyData,
    );
    const actualAnswer = JSON.parse(answerStr);

    // Compute match
    const isMatch = this.checkAnswerMatch(input.blindAnswer, actualAnswer);

    // Update review record: unlock EVALUATE phase
    await this.prisma.review.update({
      where: { id: review.id },
      data: {
        phase: 'EVALUATE',
        encryptedBlindAnswer: encBlind.ciphertext,
        blindAnswerNonce: encBlind.nonce,
        blindAnswerTag: encBlind.tag,
        encryptedSolveKey: encBlind.wrappedKey,
        timeTakenSeconds: input.timeTakenSeconds,
        difficultyRating: input.difficultyRating,
        blindAnswerMatchesKey: isMatch,
        disagreementFlag: !isMatch, // Raise flag on mismatch
      },
    });

    await this.audit.log({
      actorId: reviewerId,
      action: 'BLIND_ANSWER_SUBMIT',
      targetType: 'review',
      targetId: review.id,
      metadata: {
        timeTakenSeconds: input.timeTakenSeconds,
        difficultyRating: input.difficultyRating,
        matchesKey: isMatch,
      },
    });

    await this.audit.log({
      actorId: reviewerId,
      action: 'KEY_REVEAL',
      targetType: 'review',
      targetId: review.id,
      metadata: { unlockedPhase: 'EVALUATE' },
    });

    if (!isMatch) {
      await this.audit.log({
        actorId: reviewerId,
        action: 'DISAGREEMENT_RAISED',
        targetType: 'review',
        targetId: review.id,
        metadata: {
          reason: 'blind_answer_key_mismatch',
          flaggedToModerator: true,
        },
      });
    }

    return {
      success: true,
      phase: 'EVALUATE',
      blindAnswerMatchesKey: isMatch,
      disagreementFlag: !isMatch,
    };
  }

  /**
   * Phase 2: Submit final evaluation and decision with step-up MFA and Ed25519 signature
   */
  async submitEvaluation(
    assignmentId: string,
    input: ReviewSubmitInput,
    reviewerId: string,
  ) {
    const assignment = await this.prisma.reviewAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        questionVersion: { include: { question: true } },
        review: true,
        round: true,
      },
    });

    if (assignment.reviewerId !== reviewerId) {
      throw new ForbiddenException('You can only submit reviews for your own assignments');
    }

    if (assignment.questionVersion.authorId === reviewerId) {
      throw new ForbiddenException('A user can never review a question version they authored');
    }

    const review = assignment.review;
    if (!review || review.phase !== 'EVALUATE') {
      throw new BadRequestException('You must complete the blind solve phase before submitting an evaluation');
    }

    const version = assignment.questionVersion;

    // 1. Verify content commitment: review applies strictly to this exact content commitment hash
    if (review.contentCommitment !== version.contentCommitment) {
      throw new BadRequestException('Content commitment mismatch. The question has changed since assignment.');
    }

    // 2. Fresh step-up MFA verification
    await this.auth.verifyStepUpTotp(reviewerId, input.totpToken);

    // 3. Envelope-encrypt comments
    const commentData = `${review.id}:${version.questionId}:${version.versionNo}`;
    const encComments = await this.crypto.encrypt(input.comments, commentData);

    // 4. Ensure reviewer has Ed25519 signing key
    const signingKey = await this.auth.ensureUserSigningKey(reviewerId);

    // 5. Generate signed approval record
    const approvalId = crypto.randomUUID();
    const timestamp = new Date();

    const approvalPayload = {
      approvalId,
      questionId: version.questionId,
      versionNo: version.versionNo,
      contentCommitment: version.contentCommitment,
      decision: input.decision,
      role: 'REVIEWER',
      approverId: reviewerId,
      reviewRound: assignment.round.roundNumber,
      policyVersion: assignment.round.policyVersion,
      timestamp,
    };

    const signature = await this.signingProvider.signApproval(
      approvalPayload,
      signingKey.wrappedPrivateKey,
      signingKey.keyId,
    );

    // Execute review completion in database transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create append-only approval record
      const approval = await tx.approval.create({
        data: {
          id: approvalId,
          questionId: version.questionId,
          versionNo: version.versionNo,
          contentCommitment: version.contentCommitment,
          decision: input.decision,
          role: 'REVIEWER',
          approverId: reviewerId,
          reviewRound: assignment.round.roundNumber,
          policyVersion: assignment.round.policyVersion,
          timestamp,
          signature,
        },
      });

      // Update review record
      await tx.review.update({
        where: { id: review.id },
        data: {
          phase: 'SUBMITTED',
          checklist: input.checklist as any,
          decision: input.decision,
          encryptedComments: encComments.ciphertext,
          commentsNonce: encComments.nonce,
          commentsTag: encComments.tag,
          encryptedCommentsKey: encComments.wrappedKey,
          keyId: encComments.keyId,
          submittedAt: timestamp,
        },
      });

      // Update assignment status
      await tx.reviewAssignment.update({
        where: { id: assignment.id },
        data: { status: 'COMPLETED' },
      });

      // Check all assignments in current round
      const roundAssignments = await tx.reviewAssignment.findMany({
        where: { roundId: assignment.roundId },
        include: { review: true },
      });

      const allCompleted = roundAssignments.every((a) => a.status === 'COMPLETED');
      const anyChangesRequested = roundAssignments.some(
        (a) => a.review?.decision === 'REQUEST_CHANGES',
      );
      const anyRejected = roundAssignments.some((a) => a.review?.decision === 'REJECT');
      const anyUnresolvedDisagreement = roundAssignments.some(
        (a) => a.review?.disagreementFlag === true && a.review?.disagreementResolved === false,
      );

      let nextStatus = version.status;

      if (input.decision === 'REQUEST_CHANGES' || anyChangesRequested) {
        nextStatus = 'CHANGES_REQUESTED';
        await tx.questionVersion.update({
          where: { id: version.id },
          data: { status: 'CHANGES_REQUESTED' },
        });
      } else if (input.decision === 'REJECT' || anyRejected) {
        nextStatus = 'REJECTED';
        await tx.questionVersion.update({
          where: { id: version.id },
          data: { status: 'REJECTED' },
        });
      } else if (allCompleted) {
        // If all approved and no blocking disagreement, move to MODERATION
        if (!anyUnresolvedDisagreement) {
          nextStatus = 'MODERATION';
          await tx.questionVersion.update({
            where: { id: version.id },
            data: { status: 'MODERATION' },
          });
        }
      }

      return { approval, nextStatus, allCompleted };
    });

    await this.audit.log({
      actorId: reviewerId,
      action: 'APPROVAL_SIGNED',
      targetType: 'approval',
      targetId: approvalId,
      metadata: {
        role: 'REVIEWER',
        decision: input.decision,
        versionNo: version.versionNo,
      },
    });

    await this.audit.log({
      actorId: reviewerId,
      action: 'REVIEW_DECISION',
      targetType: 'review',
      targetId: review.id,
      metadata: {
        decision: input.decision,
        nextQuestionStatus: result.nextStatus,
      },
    });

    return {
      success: true,
      approvalId: result.approval.id,
      decision: input.decision,
      questionStatus: result.nextStatus,
    };
  }

  private checkAnswerMatch(submitted: any, actual: any): boolean {
    if (!actual || actual.correct === undefined) return false;

    // Single choice string
    if (typeof actual.correct === 'string') {
      return String(submitted).trim().toUpperCase() === actual.correct.trim().toUpperCase();
    }

    // Multi choice array
    if (Array.isArray(actual.correct)) {
      if (!Array.isArray(submitted)) return false;
      const s = submitted.map((x: any) => String(x).trim().toUpperCase()).sort();
      const a = (actual.correct as any[]).map((x: any) => String(x).trim().toUpperCase()).sort();
      return JSON.stringify(s) === JSON.stringify(a);
    }

    // Integer / Numerical with tolerance
    if (typeof actual.correct === 'number') {
      const subNum = Number(submitted);
      if (isNaN(subNum)) return false;
      const tolerance = actual.tolerance ?? 0;
      return Math.abs(subNum - actual.correct) <= tolerance;
    }

    return false;
  }
}
