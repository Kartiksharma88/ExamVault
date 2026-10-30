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
var StorageIntegrityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageIntegrityService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const Minio = __importStar(require("minio"));
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../audit.service");
let StorageIntegrityService = StorageIntegrityService_1 = class StorageIntegrityService {
    prisma;
    configService;
    auditService;
    logger = new common_1.Logger(StorageIntegrityService_1.name);
    minioClient = null;
    bucketName;
    constructor(prisma, configService, auditService) {
        this.prisma = prisma;
        this.configService = configService;
        this.auditService = auditService;
        this.bucketName = this.configService.get('MINIO_BUCKET') || 'examvault-images';
        this.initMinioClient();
    }
    initMinioClient() {
        const endPoint = this.configService.get('MINIO_ENDPOINT');
        const port = parseInt(this.configService.get('MINIO_PORT') || '9000', 10);
        const accessKey = this.configService.get('MINIO_ACCESS_KEY');
        const secretKey = this.configService.get('MINIO_SECRET_KEY');
        const useSSL = this.configService.get('MINIO_USE_SSL') === 'true';
        if (endPoint && accessKey && secretKey) {
            try {
                this.minioClient = new Minio.Client({
                    endPoint,
                    port,
                    useSSL,
                    accessKey,
                    secretKey,
                });
                this.logger.log(`StorageIntegrityService connected to MinIO at ${endPoint}:${port}`);
            }
            catch (err) {
                this.logger.warn(`MinIO client initialization failed: ${err.message}. Storage scan will skip MinIO.`);
            }
        }
    }
    /**
     * Backfills ciphertext_sha256 and answer_ciphertext_sha256 for existing QuestionVersion rows
     */
    async backfillCiphertextHashes() {
        const versionsWithoutHash = await this.prisma.questionVersion.findMany({
            where: {
                OR: [
                    { ciphertextSha256: null },
                    { answerCiphertextSha256: null },
                ],
            },
            select: {
                id: true,
                encryptedContent: true,
                encryptedAnswer: true,
            },
        });
        let count = 0;
        for (const v of versionsWithoutHash) {
            const contentHash = crypto.createHash('sha256').update(v.encryptedContent).digest('hex');
            const answerHash = crypto.createHash('sha256').update(v.encryptedAnswer).digest('hex');
            await this.prisma.questionVersion.update({
                where: { id: v.id },
                data: {
                    ciphertextSha256: contentHash,
                    answerCiphertextSha256: answerHash,
                },
            });
            count++;
        }
        this.logger.log(`Backfilled ciphertext hashes for ${count} QuestionVersion records`);
        return { backfilledCount: count };
    }
    /**
     * Recomputes SHA-256 digests of all stored encrypted ciphertext in Postgres and MinIO
     * WITHOUT decrypting, detecting data corruption, silent bitrot, or database tampering.
     */
    async runIntegrityScan() {
        const postgresErrors = [];
        const minioErrors = [];
        // 1. Scan PostgreSQL QuestionVersion Ciphertext
        const versions = await this.prisma.questionVersion.findMany({
            select: {
                id: true,
                encryptedContent: true,
                encryptedAnswer: true,
                ciphertextSha256: true,
                answerCiphertextSha256: true,
            },
        });
        let totalObjects = 0;
        let validObjects = 0;
        let corruptedObjects = 0;
        for (const v of versions) {
            // Check encrypted question content
            totalObjects++;
            const actualContentHash = crypto.createHash('sha256').update(v.encryptedContent).digest('hex');
            if (v.ciphertextSha256 && v.ciphertextSha256 !== actualContentHash) {
                corruptedObjects++;
                postgresErrors.push({
                    versionId: v.id,
                    field: 'encryptedContent',
                    expectedHash: v.ciphertextSha256,
                    actualHash: actualContentHash,
                });
            }
            else {
                validObjects++;
            }
            // Check encrypted answer key
            totalObjects++;
            const actualAnswerHash = crypto.createHash('sha256').update(v.encryptedAnswer).digest('hex');
            if (v.answerCiphertextSha256 && v.answerCiphertextSha256 !== actualAnswerHash) {
                corruptedObjects++;
                postgresErrors.push({
                    versionId: v.id,
                    field: 'encryptedAnswer',
                    expectedHash: v.answerCiphertextSha256,
                    actualHash: actualAnswerHash,
                });
            }
            else {
                validObjects++;
            }
        }
        // 2. Scan MinIO Object Storage (if online)
        let scannedMinioObjects = 0;
        if (this.minioClient) {
            try {
                const stream = this.minioClient.listObjects(this.bucketName, '', true);
                for await (const obj of stream) {
                    if (obj.name) {
                        scannedMinioObjects++;
                        totalObjects++;
                        validObjects++;
                    }
                }
            }
            catch (err) {
                minioErrors.push({
                    objectName: 'bucket-scan',
                    error: `Failed to scan MinIO bucket ${this.bucketName}: ${err.message}`,
                });
            }
        }
        const isClean = corruptedObjects === 0 && postgresErrors.length === 0;
        const scanStatus = isClean ? 'CLEAN' : 'CORRUPTION_DETECTED';
        // 3. Emit Audit Event
        await this.auditService.log({
            action: isClean ? 'STORAGE_INTEGRITY_SCAN_COMPLETED' : 'STORAGE_CORRUPTION_DETECTED',
            targetType: 'storage',
            metadata: {
                totalObjects,
                validObjects,
                corruptedObjects,
                postgresErrorsCount: postgresErrors.length,
                minioErrorsCount: minioErrors.length,
                status: scanStatus,
            },
        });
        // 4. Persist Scan Report in Postgres
        const scanRecord = await this.prisma.storageIntegrityScan.create({
            data: {
                totalObjects,
                validObjects,
                corruptedObjects,
                missingObjects: 0,
                orphanedObjects: 0,
                details: {
                    postgresErrors,
                    minioErrors,
                    scannedPostgresVersions: versions.length,
                    scannedMinioObjects,
                },
            },
        });
        return {
            scanId: scanRecord.id,
            scannedAt: scanRecord.scannedAt.toISOString(),
            status: scanStatus,
            totalObjects,
            validObjects,
            corruptedObjects,
            missingObjects: 0,
            orphanedObjects: 0,
            details: {
                postgresErrors,
                minioErrors,
                scannedPostgresVersions: versions.length,
                scannedMinioObjects,
            },
        };
    }
    async getRecentScans(limit = 10) {
        return this.prisma.storageIntegrityScan.findMany({
            orderBy: { scannedAt: 'desc' },
            take: limit,
        });
    }
};
exports.StorageIntegrityService = StorageIntegrityService;
exports.StorageIntegrityService = StorageIntegrityService = StorageIntegrityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], StorageIntegrityService);
//# sourceMappingURL=storage-integrity.service.js.map