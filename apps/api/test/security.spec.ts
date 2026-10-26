import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

jest.mock('sanitize-html', () => {
  return jest.fn((text: string) => text);
});
import { QuestionsService } from '../src/questions/questions.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoService } from '../src/crypto/crypto.service';
import { LocalKeyProvider } from '../src/crypto/local-key-provider';
import { KEY_PROVIDER } from '../src/crypto/key-provider.interface';
import { ConfigService } from '@nestjs/config';

describe('Security & Authorization Controls (Acceptance Criteria)', () => {
  let questionsService: QuestionsService;
  let auditService: AuditService;
  let prisma: PrismaService;
  let cryptoService: CryptoService;

  const mockPrisma = {
    question: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    questionVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'MASTER_KEY') {
        return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      }
      if (key === 'AUDIT_SIGNING_KEY') {
        return 'MC4CAQAwBQYDK2VwBCIEINXgqVzX7uF9xL6WJ6+Gv3P4J2yW8x9Q/bM1t9q7Yv3F';
      }
      return null;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'MASTER_KEY') {
        return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      }
      if (key === 'AUDIT_SIGNING_KEY') {
        return 'MC4CAQAwBQYDK2VwBCIEINXgqVzX7uF9xL6WJ6+Gv3P4J2yW8x9Q/bM1t9q7Yv3F';
      }
      return 'mock-value';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        AuditService,
        CryptoService,
        {
          provide: KEY_PROVIDER,
          useClass: LocalKeyProvider,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    questionsService = module.get<QuestionsService>(QuestionsService);
    auditService = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  describe('Content Isolation: ADMIN & AUDITOR get 403 on content endpoints', () => {
    const questionId = 'question-uuid-1';
    const authorId = 'examiner-uuid-1';

    beforeEach(() => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValue({
        id: questionId,
        authorId,
        currentVersion: 1,
        versions: [
          {
            versionNo: 1,
            status: 'SUBMITTED',
            encryptedContent: Buffer.from('cipher'),
            contentNonce: Buffer.from('nonce1234567'),
            contentTag: Buffer.from('tag1234567890123'),
            encryptedContentKey: Buffer.from('key'),
            encryptedAnswer: Buffer.from('ans'),
            answerNonce: Buffer.from('nonceans1234'),
            answerTag: Buffer.from('tagans123456789'),
            encryptedAnswerKey: Buffer.from('keyans'),
            keyId: 'dev-master-key',
          },
        ],
      });
    });

    it('should reject ADMIN with 403 Forbidden on getContent', async () => {
      await expect(
        questionsService.getContent(questionId, 'admin-uuid-99', 'ADMIN'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject AUDITOR with 403 Forbidden on getContent', async () => {
      await expect(
        questionsService.getContent(questionId, 'auditor-uuid-99', 'AUDITOR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject an EXAMINER attempting to read another examiners question', async () => {
      const otherExaminerId = 'examiner-uuid-2';
      await expect(
        questionsService.getContent(questionId, otherExaminerId, 'EXAMINER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Version Immutability: Editing a SUBMITTED question creates a new version', () => {
    const questionId = 'question-uuid-1';
    const authorId = 'examiner-uuid-1';

    it('should create version 2 when editing a SUBMITTED version 1 question', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValue({
        id: questionId,
        authorId,
        currentVersion: 1,
        versions: [
          {
            versionNo: 1,
            status: 'SUBMITTED',
          },
        ],
      });

      mockPrisma.questionVersion.create.mockResolvedValue({
        id: 'new-version-uuid',
        questionId,
        versionNo: 2,
        status: 'DRAFT',
      });

      mockPrisma.question.update.mockResolvedValue({
        id: questionId,
        currentVersion: 2,
      });

      const updateInput = {
        content: {
          type: 'MCQ_SINGLE',
          stem: 'Updated stem for question',
          options: [
            { label: 'A', text: 'Opt A' },
            { label: 'B', text: 'Opt B' },
          ],
          language: 'EN',
        },
        answerKey: {
          type: 'MCQ_SINGLE',
          correct: 'A',
        },
        metadata: {
          subjectId: 'subject-uuid-1',
          type: 'MCQ_SINGLE',
          difficulty: 0.6,
          cognitiveLevel: 'APPLY',
          marks: 4,
          negativeMarks: 1,
          estimatedTimeSeconds: 120,
          language: 'EN',
        },
      };

      await questionsService.update(questionId, updateInput as any, authorId);

      // Verify questionVersion.create was called with versionNo: 2 and status: DRAFT
      expect(mockPrisma.questionVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionId,
            versionNo: 2,
            status: 'DRAFT',
          }),
        }),
      );

      // Verify question.currentVersion was bumped to 2
      expect(mockPrisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: questionId },
          data: expect.objectContaining({
            currentVersion: 2,
          }),
        }),
      );
    });
  });

  describe('Tamper-Evident Audit Verification', () => {
    it('should verify an intact hash chain', async () => {
      const ts1 = new Date('2026-10-26T12:00:00.000Z');
      const event1Canonical = JSON.stringify({
        timestamp: ts1.toISOString(),
        actorId: 'u1',
        action: 'LOGIN_SUCCESS',
        targetType: 'user',
        targetId: 'u1',
        metadata: null,
      });
      const prev0 = '0000000000000000000000000000000000000000000000000000000000000000';
      const hash1 = cryptoService.computeAuditHash(prev0, event1Canonical);
      const sig1 = await cryptoService.sign(Buffer.from(hash1, 'hex'));

      const ts2 = new Date('2026-10-26T12:05:00.000Z');
      const event2Canonical = JSON.stringify({
        timestamp: ts2.toISOString(),
        actorId: 'u1',
        action: 'QUESTION_CREATE',
        targetType: 'question',
        targetId: 'q1',
        metadata: null,
      });
      const hash2 = cryptoService.computeAuditHash(hash1, event2Canonical);
      const sig2 = await cryptoService.sign(Buffer.from(hash2, 'hex'));

      mockPrisma.auditEvent.findMany.mockResolvedValue([
        {
          id: 'e1',
          timestamp: ts1,
          actorId: 'u1',
          action: 'LOGIN_SUCCESS',
          targetType: 'user',
          targetId: 'u1',
          metadata: null,
          prevHash: prev0,
          entryHash: hash1,
          signature: sig1.toString('base64'),
        },
        {
          id: 'e2',
          timestamp: ts2,
          actorId: 'u1',
          action: 'QUESTION_CREATE',
          targetType: 'question',
          targetId: 'q1',
          metadata: null,
          prevHash: hash1,
          entryHash: hash2,
          signature: sig2.toString('base64'),
        },
      ]);

      const result = await auditService.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(2);
      expect(result.verifiedEntries).toBe(2);
    });

    it('should detect tampering if an entry hash or metadata is modified', async () => {
      const prev0 = '0000000000000000000000000000000000000000000000000000000000000000';
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        {
          id: 'tampered-event-1',
          timestamp: new Date('2026-10-26T12:00:00.000Z'),
          actorId: 'u1',
          action: 'LOGIN_SUCCESS',
          targetType: 'user',
          targetId: 'u1',
          metadata: { tampered: true }, // TAMPERED!
          prevHash: prev0,
          entryHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          signature: 'invalidsig==',
        },
      ]);

      const result = await auditService.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.firstBrokenEntry).toBeDefined();
      expect(result.firstBrokenEntry?.id).toBe('tampered-event-1');
    });
  });
});
