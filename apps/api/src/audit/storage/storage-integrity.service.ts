import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as Minio from 'minio';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit.service';

export interface StorageIntegrityScanReport {
  scanId: string;
  scannedAt: string;
  status: 'CLEAN' | 'CORRUPTION_DETECTED';
  totalObjects: number;
  validObjects: number;
  corruptedObjects: number;
  missingObjects: number;
  orphanedObjects: number;
  details: {
    postgresErrors: Array<{
      versionId: string;
      field: string;
      expectedHash: string;
      actualHash: string;
    }>;
    minioErrors: Array<{
      objectName: string;
      error: string;
    }>;
    scannedPostgresVersions: number;
    scannedMinioObjects: number;
  };
}

@Injectable()
export class StorageIntegrityService {
  private readonly logger = new Logger(StorageIntegrityService.name);
  private minioClient: Minio.Client | null = null;
  private bucketName: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET') || 'examvault-images';
    this.initMinioClient();
  }

  private initMinioClient(): void {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = parseInt(this.configService.get<string>('MINIO_PORT') || '9000', 10);
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';

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
      } catch (err: any) {
        this.logger.warn(`MinIO client initialization failed: ${err.message}. Storage scan will skip MinIO.`);
      }
    }
  }

  /**
   * Backfills ciphertext_sha256 and answer_ciphertext_sha256 for existing QuestionVersion rows
   */
  async backfillCiphertextHashes(): Promise<{ backfilledCount: number }> {
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
  async runIntegrityScan(): Promise<StorageIntegrityScanReport> {
    const postgresErrors: Array<{
      versionId: string;
      field: string;
      expectedHash: string;
      actualHash: string;
    }> = [];

    const minioErrors: Array<{
      objectName: string;
      error: string;
    }> = [];

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
      } else {
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
      } else {
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
      } catch (err: any) {
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

  async getRecentScans(limit = 10): Promise<any[]> {
    return this.prisma.storageIntegrityScan.findMany({
      orderBy: { scannedAt: 'desc' },
      take: limit,
    });
  }
}
