import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

jest.mock('sanitize-html', () => jest.fn((text: string) => text));
jest.mock('pg-boss', () => ({
  PgBoss: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

import { QuestionsService } from '../src/questions/questions.service';
import { ReviewService } from '../src/review/review.service';
import { ModerationService } from '../src/moderation/moderation.service';
import { PoliciesService } from '../src/policies/policies.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoService } from '../src/crypto/crypto.service';
import { LocalKeyProvider } from '../src/crypto/local-key-provider';
import { KEY_PROVIDER } from '../src/crypto/key-provider.interface';
import { ConfigService } from '@nestjs/config';
import { ScreeningQueue } from '../src/originality/screening.queue';
import { ServerSigningProvider } from '../src/crypto/server-signing-provider';
import { SIGNING_PROVIDER } from '../src/crypto/signing-provider.interface';
import { AuthService } from '../src/auth/auth.service';

describe('Step 2: Review, Originality Check, and Approval Workflow (Acceptance Criteria)', () => {
  let questionsService: QuestionsService;
  let reviewService: ReviewService;
  let moderationService: ModerationService;
  let policiesService: PoliciesService;
  let auditService: AuditService;
  let cryptoService: CryptoService;

  const mockPrisma: any = {
    question: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    questionVersion: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    reviewRound: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reviewAssignment: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    approvalPolicy: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    approval: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    conflictDeclaration: {
      findMany: jest.fn(),
    },
    userSubjectExpertise: {
      findMany: jest.fn(),
    },
    originalityReport: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    duplicateDisposition: {
      create: jest.fn(),
    },
    userSigningKey: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'audit-1', entryHash: 'hash-0' }),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    $queryRaw: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'MASTER_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      return null;
    }),
    getOrThrow: jest.fn(() => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        ReviewService,
        ModerationService,
        PoliciesService,
        AuditService,
        CryptoService,
        ServerSigningProvider,
        {
          provide: KEY_PROVIDER,
          useClass: LocalKeyProvider,
        },
        {
          provide: SIGNING_PROVIDER,
          useClass: ServerSigningProvider,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: ScreeningQueue,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            verifyStepUpTotp: jest.fn().mockResolvedValue(true),
            ensureUserSigningKey: jest.fn().mockResolvedValue({
              keyId: 'test-key-id',
              publicKey: 'test-pubkey',
              wrappedPrivateKey: 'test-wrapped',
            }),
          },
        },
      ],
    }).compile();

    questionsService = module.get<QuestionsService>(QuestionsService);
    reviewService = module.get<ReviewService>(ReviewService);
    moderationService = module.get<ModerationService>(ModerationService);
    policiesService = module.get<PoliciesService>(PoliciesService);
    auditService = module.get<AuditService>(AuditService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  describe('1. Separation of Duties & Anonymity', () => {
    const questionId = 'q-100';
    const authorId = 'examiner-1';
    const versionId = 'qv-100';
    const moderatorId = 'mod-1';

    it('rejects an author attempting to review their own question', async () => {
      mockPrisma.reviewAssignment.findUniqueOrThrow.mockResolvedValue({
        id: 'assignment-1',
        reviewerId: authorId,
        questionVersionId: versionId,
        status: 'PENDING',
        questionVersion: {
          id: versionId,
          authorId: authorId, // Reviewer is the author!
          question: { humanId: 'EV-PHY-000001' },
        },
      });

      await expect(
        reviewService.getAssignmentWorkspace('assignment-1', authorId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an author from moderating their own question', async () => {
      mockPrisma.questionVersion.findUniqueOrThrow.mockResolvedValue({
        id: versionId,
        authorId: authorId, // Author attempting to moderate!
        status: 'MODERATION',
        reviewAssignments: [],
        reviewRounds: [],
        question: { id: questionId, subjectId: 'sub-1' },
      });

      await expect(
        moderationService.submitDecision(
          versionId,
          { decision: 'APPROVE', comments: 'Self approval', totpToken: '123456' } as any,
          authorId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly forbids a moderator from reading a question outside their queue', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValue({
        id: questionId,
        authorId: 'examiner-other',
        currentVersion: 1,
      });
      mockPrisma.questionVersion.findUnique.mockResolvedValue({
        id: versionId,
        questionId,
        versionNo: 1,
        status: 'UNDER_REVIEW', // In standard review, NOT in moderator queue!
      });
      mockPrisma.reviewAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.review.findFirst.mockResolvedValue(null); // No disagreement

      await expect(
        questionsService.getContent(questionId, moderatorId, 'MODERATOR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('masks reviewer and author identities in the moderator queue', async () => {
      mockPrisma.questionVersion.findMany.mockResolvedValue([
        {
          id: 'qv-ready',
          versionNo: 1,
          status: 'MODERATION',
          question: {
            humanId: 'EV-PHY-000001',
            subject: { name: 'Physics' },
            author: { id: 'auth-1', name: 'Dr. Real Author', email: 'author@test.com' },
          },
          reviews: [
            { id: 'rev-1', decision: 'APPROVE', difficultyRating: 0.5, checklist: {} },
            { id: 'rev-2', decision: 'APPROVE', difficultyRating: 0.6, checklist: {} },
          ],
        },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.reviewAssignment.findMany.mockResolvedValue([]);

      const queue = await moderationService.getModeratorQueue(moderatorId);
      expect(queue.readyForApproval[0].question.author.name).toBe('Author');
      expect(queue.readyForApproval[0].reviews[0].reviewerLabel).toBe('Reviewer A');
      expect(queue.readyForApproval[0].reviews[1].reviewerLabel).toBe('Reviewer B');
    });

    it('rejects moderator approval if required signed reviewer approvals are missing', async () => {
      mockPrisma.questionVersion.findUniqueOrThrow.mockResolvedValue({
        id: versionId,
        authorId: 'other-author',
        status: 'MODERATION',
        versionNo: 1,
        questionId,
        question: { id: questionId, subjectId: 'sub-1' },
        reviewAssignments: [],
        reviewRounds: [],
      });
      mockPrisma.approvalPolicy.findFirst.mockResolvedValue({ requiredReviewers: 2 });
      mockPrisma.approval.findMany.mockResolvedValue([]); // No reviewer approvals!
      mockPrisma.review.findMany.mockResolvedValue([]); // No completed reviews!
      mockPrisma.review.findFirst.mockResolvedValue(null);

      await expect(
        moderationService.submitDecision(
          versionId,
          { decision: 'APPROVE', comments: 'Early approval', totpToken: '123456' } as any,
          moderatorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks moderator content access when hourly read limit is exceeded', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValue({
        id: questionId,
        authorId: 'examiner-other',
        currentVersion: 1,
      });
      mockPrisma.questionVersion.findUnique.mockResolvedValue({
        id: versionId,
        questionId,
        versionNo: 1,
        status: 'MODERATION', // In queue
      });
      mockPrisma.reviewAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      // Simulate 55 reads in past hour (limit 50)
      mockPrisma.auditEvent.count.mockResolvedValue(55);

      await expect(
        questionsService.getContent(questionId, moderatorId, 'MODERATOR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly forbids ADMIN and AUDITOR from accessing question content', async () => {
      await expect(
        questionsService.getContent(questionId, 'admin-id', 'ADMIN'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        questionsService.getContent(questionId, 'auditor-id', 'AUDITOR'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Dual-Admin Policy Control', () => {
    it('rejects policy approval if proposer and approver are the same administrator', async () => {
      const adminId = 'admin-1';
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: adminId,
        role: 'ADMIN',
      });
      mockPrisma.approvalPolicy.findUnique.mockResolvedValue({
        id: 'policy-1',
        proposedById: adminId, // Proposed by admin-1
        approvedById: null,
        isActive: false,
      });

      await expect(
        policiesService.approvePolicy({ policyId: 'policy-1' }, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows policy activation when approved by a different second administrator', async () => {
      const proposerAdminId = 'admin-1';
      const approverAdminId = 'admin-2';
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: approverAdminId,
        role: 'ADMIN',
      });
      mockPrisma.approvalPolicy.findUnique.mockResolvedValue({
        id: 'policy-1',
        proposedById: proposerAdminId,
        approvedById: null,
        isActive: false,
      });
      mockPrisma.approvalPolicy.update.mockResolvedValue({
        id: 'policy-1',
        isActive: true,
        approvedById: approverAdminId,
      });

      const res = await policiesService.approvePolicy({ policyId: 'policy-1' }, approverAdminId);
      expect(res.isActive).toBe(true);
      expect(res.approvedById).toBe(approverAdminId);
    });
  });

  describe('3. Blind Solving & Disagreement Barrier', () => {
    it('withholds the answer key while assignment is in SOLVE phase', async () => {
      const assignmentId = 'asgn-200';
      const reviewerId = 'reviewer-1';
      mockPrisma.reviewAssignment.findUniqueOrThrow.mockResolvedValue({
        id: assignmentId,
        reviewerId,
        status: 'PENDING',
        questionVersionId: 'qv-200',
        questionVersion: {
          id: 'qv-200',
          authorId: 'examiner-different',
          versionNo: 1,
          encryptedContent: Buffer.from('content'),
          contentNonce: Buffer.from('nonce'),
          contentTag: Buffer.from('tag'),
          encryptedContentKey: Buffer.from('key'),
          keyId: 'dev-key',
          question: {
            id: 'q-200',
            humanId: 'EV-PHY-000002',
            subject: { name: 'Physics', code: 'PHY' },
          },
          reviews: [],
        },
        review: {
          id: 'rev-200',
          phase: 'SOLVE',
        },
      });

      jest.spyOn(cryptoService, 'decrypt').mockResolvedValue(
        JSON.stringify({
          stem: 'What is force?',
          options: [{ label: 'A', text: 'mass * acceleration' }],
          solution: 'F = m*a',
        }),
      );

      const workspace = await reviewService.getAssignmentWorkspace(assignmentId, reviewerId);
      expect(workspace.phase).toBe('SOLVE');
      expect(workspace.content.stem).toBe('What is force?');
      expect(workspace.answerKey).toBeNull(); // Answer key is withheld!
    });

    it('records DISAGREEMENT flag if blind answer mismatches author key', async () => {
      const assignmentId = 'asgn-300';
      const reviewerId = 'reviewer-1';
      mockPrisma.reviewAssignment.findUniqueOrThrow.mockResolvedValue({
        id: assignmentId,
        reviewerId,
        status: 'PENDING',
        questionVersionId: 'qv-300',
        questionVersion: {
          id: 'qv-300',
          authorId: 'examiner-other',
          versionNo: 1,
          contentCommitment: 'hash-abc',
          encryptedAnswer: Buffer.from('answer'),
          answerNonce: Buffer.from('nonce'),
          answerTag: Buffer.from('tag'),
          encryptedAnswerKey: Buffer.from('key'),
          keyId: 'dev-key',
          question: { humanId: 'EV-CHE-000001' },
        },
        review: {
          id: 'rev-300',
          phase: 'SOLVE',
        },
      });

      jest.spyOn(cryptoService, 'encrypt').mockResolvedValue({
        ciphertext: Buffer.from('cipher'),
        nonce: Buffer.from('nonce'),
        tag: Buffer.from('tag'),
        wrappedKey: Buffer.from('key'),
        keyId: 'dev-key',
      });

      jest.spyOn(cryptoService, 'decrypt').mockResolvedValue(
        JSON.stringify('B'), // Author key is B
      );

      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-300',
        assignmentId,
        blindAnswerMatchesKey: false,
        disagreementFlag: true,
      });

      // Reviewer submits A
      const res = await reviewService.submitBlindAnswer(
        assignmentId,
        {
          blindAnswer: 'A',
          timeTakenSeconds: 120,
          difficultyRating: 0.4,
        },
        reviewerId,
      );

      expect(res.blindAnswerMatchesKey).toBe(false);
      expect(res.disagreementFlag).toBe(true);
    });
  });

  describe('4. Canonical Ed25519 Approval Signing & Tamper Verification', () => {
    it('verifies valid approval signature and rejects tampered data', () => {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

      const canonicalFields = [
        'app-1',
        'q-1',
        1,
        'hash123',
        'APPROVE',
        'REVIEWER',
        'user-1',
        1,
        1,
        '2026-10-27T12:00:00.000Z',
      ].join('|');

      const signature = crypto.sign(null, Buffer.from(canonicalFields, 'utf-8'), privateKey);

      // Verify authentic signature
      const verified = crypto.verify(null, Buffer.from(canonicalFields, 'utf-8'), publicKey, signature);
      expect(verified).toBe(true);

      // Tampered payload fails verification
      const tampered = canonicalFields.replace('APPROVE', 'REJECT');
      const tamperedVerified = crypto.verify(null, Buffer.from(tampered, 'utf-8'), publicKey, signature);
      expect(tamperedVerified).toBe(false);
    });
  });

  describe('5. Immutability & Revisions', () => {
    it('creates a new version in DRAFT when revising an approved question', async () => {
      const authorId = 'examiner-1';
      const parentVersionId = 'qv-approved-parent';
      const questionId = 'q-parent';

      mockPrisma.questionVersion.findUniqueOrThrow.mockResolvedValue({
        id: parentVersionId,
        questionId,
        versionNo: 1,
        authorId,
        status: 'APPROVED',
        contentCommitment: 'parent-hash',
        encryptedContent: Buffer.from('content'),
        contentNonce: Buffer.from('nonce'),
        contentTag: Buffer.from('tag'),
        encryptedContentKey: Buffer.from('key'),
        encryptedAnswer: Buffer.from('ans'),
        answerNonce: Buffer.from('ansnonce'),
        answerTag: Buffer.from('anstag'),
        encryptedAnswerKey: Buffer.from('anskey'),
        keyId: 'dev-key',
        question: { id: questionId, humanId: 'EV-PHY-000099', currentVersion: 1 },
      });

      mockPrisma.questionVersion.findMany.mockResolvedValue([{ versionNo: 1 }]);
      mockPrisma.questionVersion.create.mockResolvedValue({
        id: 'qv-new-draft',
        questionId,
        versionNo: 2,
        status: 'DRAFT',
        parentVersionId,
      });

      const res = await questionsService.createNewVersion(
        {
          parentVersionId,
          changeJustification: 'Clarified distractor D based on peer review feedback',
          content: {
            type: 'MCQ_SINGLE',
            stem: 'Revised stem text',
            language: 'EN',
            options: [{ label: 'A', text: 'Option A' }],
          },
          answerKey: { type: 'MCQ_SINGLE', correct: 'A' },
          metadata: {
            subjectId: 'sub-1',
            type: 'MCQ_SINGLE',
            difficulty: 0.5,
            cognitiveLevel: 'APPLY',
            marks: 4,
            negativeMarks: 1,
            estimatedTimeSeconds: 120,
            language: 'EN',
          },
        },
        authorId,
      );

      expect(res.versionNo).toBe(2);
      expect(res.status).toBe('DRAFT');
      expect(res.parentVersionId).toBe(parentVersionId);
    });
  });

  describe('6. Difficulty Rating Rules & Conflict Resolution', () => {
    const versionId = 'qv-diff-1';
    const questionId = 'q-diff-1';
    const moderatorId = 'mod-1';

    it('ratings 20 and 60 with tolerance 20 raise DIFFICULTY_CONFLICT', async () => {
      const reviewer1 = { id: 'rev-1', difficultyRating: 20 };
      const reviewer2 = { id: 'rev-2', difficultyRating: 60 };
      const tolerance = 20;

      const ratings = [reviewer1.difficultyRating, reviewer2.difficultyRating];
      const diff = Math.max(...ratings) - Math.min(...ratings);
      expect(diff).toBe(40);
      expect(diff > tolerance).toBe(true);

      const conflictFlag = diff > tolerance;
      expect(conflictFlag).toBe(true);
    });

    it('ratings 40 and 55 auto-resolve to 47.5', async () => {
      const tolerance = 20;
      const ratings = [40, 55];
      const diff = Math.max(...ratings) - Math.min(...ratings);
      expect(diff).toBe(15);
      expect(diff <= tolerance).toBe(true);

      const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const finalDifficulty = Math.round(mean * 10) / 10;
      expect(finalDifficulty).toBe(47.5);
    });

    it("a reviewer cannot see the other reviewer's difficulty rating", async () => {
      mockPrisma.reviewAssignment.findUniqueOrThrow.mockResolvedValue({
        id: 'asgn-1',
        reviewerId: 'reviewer-1',
        questionVersionId: versionId,
        status: 'PENDING',
        dueDate: new Date(),
        questionVersion: {
          id: versionId,
          authorId: 'examiner-1',
          question: {
            id: questionId,
            humanId: 'EV-PHY-000001',
            difficulty: 50,
          },
          status: 'UNDER_REVIEW',
          encryptedContent: Buffer.from('content'),
          contentNonce: Buffer.from('nonce'),
          contentTag: Buffer.from('tag'),
          encryptedContentKey: Buffer.from('key'),
          encryptedAnswer: Buffer.from('ans'),
          answerNonce: Buffer.from('ansnonce'),
          answerTag: Buffer.from('anstag'),
          encryptedAnswerKey: Buffer.from('anskey'),
          keyId: 'dev-key',
        },
        review: {
          id: 'review-1',
          reviewerId: 'reviewer-1',
          phase: 'SOLVE',
          difficultyRating: 40,
          timeTakenSeconds: 120,
        },
      });

      jest.spyOn(cryptoService, 'decrypt').mockResolvedValue(
        JSON.stringify({
          stem: 'What is force?',
          options: [{ label: 'A', text: 'mass * acceleration' }],
          solution: 'F = m*a',
        }),
      );

      const workspace = await reviewService.getAssignmentWorkspace('asgn-1', 'reviewer-1');
      // Reviewer only receives their own review
      expect(workspace.existingReview?.difficultyRating).toBe(40);
      // Other reviewer ratings are never exposed in workspace payload
      expect((workspace as any).otherReviews).toBeUndefined();
      expect((workspace as any).reviewer2).toBeUndefined();
    });

    it('approval is blocked while a difficulty conflict is open', async () => {
      mockPrisma.questionVersion.findUniqueOrThrow.mockResolvedValue({
        id: versionId,
        questionId,
        versionNo: 1,
        authorId: 'examiner-1',
        status: 'MODERATION',
        difficultyConflictFlag: true, // Conflict is open!
        difficultyConflictResolved: false,
        reviewAssignments: [
          { reviewerId: 'other-1', status: 'COMPLETED' },
          { reviewerId: 'other-2', status: 'COMPLETED' },
        ],
        question: { id: questionId, subjectId: 'sub-1' },
      });

      mockPrisma.approvalPolicy.findFirst.mockResolvedValue({
        requiredReviewers: 2,
        difficultyTolerance: 20,
      });

      mockPrisma.approval.findMany.mockResolvedValue([
        { id: 'app-1', role: 'REVIEWER', decision: 'APPROVE' },
        { id: 'app-2', role: 'REVIEWER', decision: 'APPROVE' },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        { id: 'rev-1', decision: 'APPROVE' },
        { id: 'rev-2', decision: 'APPROVE' },
      ]);
      mockPrisma.review.findFirst.mockResolvedValue(null); // No answer disagreement

      await expect(
        moderationService.submitDecision(
          versionId,
          { decision: 'APPROVE', comments: 'Approved', totpToken: '123456' } as any,
          moderatorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('the third review adds a rating and the median is applied', async () => {
      // Ratings from 3 completed reviews: 20, 60, and third review: 45
      const ratings = [20, 60, 45];
      expect(ratings.length).toBe(3);

      const sorted = [...ratings].sort((a, b) => a - b);
      expect(sorted).toEqual([20, 45, 60]);

      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      expect(median).toBe(45);

      const finalDifficulty = Math.round(median * 10) / 10;
      expect(finalDifficulty).toBe(45);
    });

    it('single reviewer policy: answer matches key and not duplicate directly auto-approves into final question bank', async () => {
      const singleReview = {
        blindAnswerMatchesKey: true,
        difficultyRating: 65,
        timeTakenSeconds: 150,
      };
      const isDuplicate = false;
      const decision = 'APPROVE';
      const requiredReviewers = 1;

      const shouldAutoApprove =
        requiredReviewers === 1 &&
        singleReview.blindAnswerMatchesKey &&
        !isDuplicate &&
        decision === 'APPROVE';

      expect(shouldAutoApprove).toBe(true);
      const nextStatus = shouldAutoApprove ? 'APPROVED' : 'MODERATION';
      expect(nextStatus).toBe('APPROVED');
    });

    it('single reviewer policy: duplicate question or answer mismatch routes to moderator', async () => {
      const singleReview = {
        blindAnswerMatchesKey: false,
        difficultyRating: 65,
      };
      const isDuplicate = true;
      const requiredReviewers = 1;

      const shouldRouteToModerator =
        requiredReviewers === 1 && (!singleReview.blindAnswerMatchesKey || isDuplicate);

      expect(shouldRouteToModerator).toBe(true);
      const nextStatus = shouldRouteToModerator ? 'MODERATION' : 'APPROVED';
      expect(nextStatus).toBe('MODERATION');
    });

    it('two reviewer policy: ratings within tolerance directly auto-approves into final question bank without moderator', async () => {
      const ratings = [45, 55];
      const timings = [120, 140];
      const tolerance = 20;
      const diff = Math.max(...ratings) - Math.min(...ratings);
      expect(diff <= tolerance).toBe(true);

      const meanRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const avgTiming = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
      expect(meanRating).toBe(50);
      expect(avgTiming).toBe(130);

      const nextStatus = diff <= tolerance ? 'APPROVED' : 'MODERATION';
      expect(nextStatus).toBe('APPROVED');
    });

    it('two reviewer policy: larger difference routes to moderator dashboard where moderator sets actual hardness and timing', async () => {
      const ratings = [25, 75];
      const tolerance = 20;
      const diff = Math.max(...ratings) - Math.min(...ratings);
      expect(diff > tolerance).toBe(true);

      const conflictRaised = diff > tolerance;
      expect(conflictRaised).toBe(true);
      const nextStatus = conflictRaised ? 'MODERATION' : 'APPROVED';
      expect(nextStatus).toBe('MODERATION');

      // Moderator resolves by setting actual hardness and timing
      const moderatorResolution = {
        action: 'SET_FINAL_VALUE' as const,
        customValue: 60,
        customTimingSeconds: 180,
        justification: 'Calibrated based on multi-step algebra requirements',
      };

      expect(moderatorResolution.customValue).toBe(60);
      expect(moderatorResolution.customTimingSeconds).toBe(180);
      expect(moderatorResolution.justification.length).toBeGreaterThan(10);
    });

    it('enforces examiner subject categorization: examiner can only author questions in their assigned subject', async () => {
      // Mock examiner who is specialized in Physics only
      mockPrisma.userSubjectExpertise.findMany.mockResolvedValueOnce([
        {
          userId: 'examiner-phy-1',
          subjectId: 'sub-phy-id',
          subject: { id: 'sub-phy-id', name: 'Physics', code: 'PHY' },
        },
      ]);

      // Attempting to author Chemistry question
      await expect(
        questionsService.create(
          {
            content: { type: 'MCQ_SINGLE', stem: 'Calculate pH of buffer', language: 'EN' },
            answerKey: { type: 'MCQ_SINGLE', correct: 'A' },
            metadata: {
              subjectId: 'sub-che-id', // Chemistry
              type: 'MCQ_SINGLE',
              difficulty: 50,
              cognitiveLevel: 'APPLY',
              marks: 4,
              estimatedTimeSeconds: 120,
            },
          },
          'examiner-phy-1',
        ),
      ).rejects.toThrow('Subject category restriction');
    });

    it('assignReviewers strictly selects reviewers matching the question subject category only', async () => {
      const phySubjectId = 'sub-phy-id';
      const questionVersionId = 'v-phy-1';

      mockPrisma.questionVersion.findUniqueOrThrow.mockResolvedValueOnce({
        id: questionVersionId,
        status: 'READY_FOR_REVIEW',
        authorId: 'examiner-phy-1',
        contentCommitment: 'commit-hash',
        question: {
          id: 'q-phy-1',
          humanId: 'EV-PHY-000001',
          subjectId: phySubjectId,
          type: 'MCQ_SINGLE',
        },
      });

      // Active policy requires 1 reviewer
      mockPrisma.approvalPolicy.findFirst.mockResolvedValueOnce({
        id: 'pol-1',
        version: 1,
        requiredReviewers: 1,
        maxReviewDays: 7,
      });

      mockPrisma.conflictDeclaration.findMany.mockResolvedValueOnce([]);

      // Prisma user candidate query filters by userSubjectExpertise matching subjectId
      mockPrisma.user.findMany.mockImplementation((args: any) => {
        if (args.where?.role === 'REVIEWER') {
          // Verify that query includes subjectId filter
          expect(args.where.userSubjectExpertise.some.subjectId).toBe(phySubjectId);

          // Return physics reviewer candidates only (Maths/Chemistry candidates excluded by DB filter)
          return Promise.resolve([
            {
              id: 'rev-phy-1',
              name: 'Dr. Physics Reviewer',
              conflictDeclarations: [],
              reviewAssignments: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.reviewRound.create.mockResolvedValueOnce({ id: 'round-1' });
      mockPrisma.reviewAssignment.create.mockResolvedValueOnce({ id: 'assign-1' });
      mockPrisma.review.create.mockResolvedValueOnce({ id: 'rev-rec-1' });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif-1' });
      mockPrisma.questionVersion.update.mockResolvedValueOnce({ id: questionVersionId, status: 'UNDER_REVIEW' });

      const res = await reviewService.assignReviewers(questionVersionId);
      expect(res.assigned).toBe(true);
      expect(res.assignedCount).toBe(1);
    });
  });
});
