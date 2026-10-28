import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { StorageIntegrityService } from './storage-integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit.service';

describe('StorageIntegrityService', () => {
  let service: StorageIntegrityService;
  let prismaMock: any;
  let auditMock: any;

  const sampleContent = Buffer.from('encrypted_binary_content_aes_gcm');
  const sampleAnswer = Buffer.from('encrypted_binary_answer_aes_gcm');
  const contentHash = crypto.createHash('sha256').update(sampleContent).digest('hex');
  const answerHash = crypto.createHash('sha256').update(sampleAnswer).digest('hex');

  beforeEach(async () => {
    prismaMock = {
      questionVersion: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      storageIntegrityScan: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'scan-uuid-1',
          scannedAt: new Date(),
          ...args.data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageIntegrityService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<StorageIntegrityService>(StorageIntegrityService);
  });

  it('backfills missing ciphertext hashes for legacy records', async () => {
    prismaMock.questionVersion.findMany.mockResolvedValue([
      {
        id: 'qv-1',
        encryptedContent: sampleContent,
        encryptedAnswer: sampleAnswer,
      },
    ]);
    prismaMock.questionVersion.update.mockResolvedValue({});

    const result = await service.backfillCiphertextHashes();
    expect(result.backfilledCount).toBe(1);
    expect(prismaMock.questionVersion.update).toHaveBeenCalledWith({
      where: { id: 'qv-1' },
      data: {
        ciphertextSha256: contentHash,
        answerCiphertextSha256: answerHash,
      },
    });
  });

  it('reports CLEAN when ciphertext SHA-256 matches perfectly without decrypting', async () => {
    prismaMock.questionVersion.findMany.mockResolvedValue([
      {
        id: 'qv-1',
        encryptedContent: sampleContent,
        encryptedAnswer: sampleAnswer,
        ciphertextSha256: contentHash,
        answerCiphertextSha256: answerHash,
      },
    ]);

    const report = await service.runIntegrityScan();

    expect(report.status).toBe('CLEAN');
    expect(report.corruptedObjects).toBe(0);
    expect(report.validObjects).toBe(2);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STORAGE_INTEGRITY_SCAN_COMPLETED',
      }),
    );
  });

  it('detects tampered/corrupted ciphertext without decryption and logs security audit event', async () => {
    const corruptedContent = Buffer.from('corrupted_encrypted_content_tampered');

    prismaMock.questionVersion.findMany.mockResolvedValue([
      {
        id: 'qv-tampered',
        encryptedContent: corruptedContent,
        encryptedAnswer: sampleAnswer,
        ciphertextSha256: contentHash, // expected original hash
        answerCiphertextSha256: answerHash,
      },
    ]);

    const report = await service.runIntegrityScan();

    expect(report.status).toBe('CORRUPTION_DETECTED');
    expect(report.corruptedObjects).toBe(1);
    expect(report.details.postgresErrors.length).toBe(1);
    expect(report.details.postgresErrors[0].versionId).toBe('qv-tampered');
    expect(report.details.postgresErrors[0].field).toBe('encryptedContent');

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STORAGE_CORRUPTION_DETECTED',
        targetType: 'storage',
      }),
    );
  });
});
