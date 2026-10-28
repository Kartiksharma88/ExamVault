import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FabricGatewayService } from '../fabric/fabric-gateway.service';
import { CanonicalAuditEvent } from '@examvault/audit-canonical';

@Injectable()
export class AuditOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditOutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private intervalMs = 5000;

  constructor(
    private prisma: PrismaService,
    private fabricGateway: FabricGatewayService,
  ) {}

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public startWorker(intervalMs = 5000): void {
    if (this.timer) clearInterval(this.timer);
    this.intervalMs = intervalMs;
    this.timer = setInterval(() => {
      this.flushOutbox().catch((err) => {
        this.logger.error(`Error during outbox flush: ${err.message}`);
      });
    }, this.intervalMs);
    this.logger.log(`AuditOutboxWorker started, polling every ${this.intervalMs}ms`);
  }

  /**
   * Flushes pending outbox entries in chronological order with exponential backoff
   */
  public async flushOutbox(batchSize = 25): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isFlushing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isFlushing = true;
    let succeeded = 0;
    let failed = 0;

    try {
      const now = new Date();
      const pendingItems = await this.prisma.auditOutbox.findMany({
        where: {
          sinkType: 'FABRIC',
          status: 'PENDING',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      for (const item of pendingItems) {
        const event = item.payload as unknown as CanonicalAuditEvent;

        try {
          // Submit to Fabric Gateway
          const receipt = await this.fabricGateway.submitEvent(event);

          // Mark COMMITTED atomically
          await this.prisma.auditOutbox.update({
            where: { id: item.id },
            data: {
              status: 'COMMITTED',
              fabricTxId: receipt.txId,
              fabricBlockNo: receipt.blockNumber,
              committedAt: new Date(),
              lastError: null,
            },
          });

          succeeded++;
        } catch (err: any) {
          failed++;
          const nextRetryCount = item.retryCount + 1;
          const isDeadLetter = nextRetryCount >= item.maxRetries;

          // Exponential backoff: base 1s * 2^(retryCount), max 60s
          const backoffDelaySeconds = Math.min(Math.pow(2, nextRetryCount), 60);
          const nextRetryAt = new Date(Date.now() + backoffDelaySeconds * 1000);

          await this.prisma.auditOutbox.update({
            where: { id: item.id },
            data: {
              status: isDeadLetter ? 'FAILED' : 'PENDING',
              retryCount: nextRetryCount,
              nextRetryAt: isDeadLetter ? null : nextRetryAt,
              lastError: err.message,
            },
          });

          this.logger.warn(
            `Outbox event ${item.eventId} anchoring failed (attempt ${nextRetryCount}/${item.maxRetries}): ${err.message}`,
          );
        }
      }

      return {
        processed: pendingItems.length,
        succeeded,
        failed,
      };
    } finally {
      this.isFlushing = false;
    }
  }
}
