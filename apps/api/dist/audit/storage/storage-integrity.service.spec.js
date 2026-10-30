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
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const storage_integrity_service_1 = require("./storage-integrity.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../audit.service");
describe('StorageIntegrityService', () => {
    let service;
    let prismaMock;
    let auditMock;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                storage_integrity_service_1.StorageIntegrityService,
                { provide: prisma_service_1.PrismaService, useValue: prismaMock },
                { provide: audit_service_1.AuditService, useValue: auditMock },
                {
                    provide: config_1.ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue(null),
                    },
                },
            ],
        }).compile();
        service = module.get(storage_integrity_service_1.StorageIntegrityService);
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
        expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({
            action: 'STORAGE_INTEGRITY_SCAN_COMPLETED',
        }));
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
        expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({
            action: 'STORAGE_CORRUPTION_DETECTED',
            targetType: 'storage',
        }));
    });
});
//# sourceMappingURL=storage-integrity.service.spec.js.map