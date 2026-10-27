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
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
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
    auditEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
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
        reviewRounds: [],
      });

      await expect(
        moderationService.submitDecision(
          versionId,
          { decision: 'APPROVE', comments: 'Self approval', totpToken: '123456' } as any,
          authorId,
        ),
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
});
