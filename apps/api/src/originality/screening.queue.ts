import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OriginalityService } from './originality.service';
import { PrismaService } from '../prisma/prisma.service';

const { PgBoss } = require('pg-boss');

@Injectable()
export class ScreeningQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScreeningQueue.name);
  private boss: any = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private originalityService: OriginalityService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const dbUrl = this.config.get<string>('DATABASE_URL_UNPOOLED') || this.config.get<string>('DATABASE_URL');
    if (dbUrl) {
      try {
        this.boss = new PgBoss({
          connectionString: dbUrl,
          schema: 'pgboss',
          application_name: 'examvault_screening_worker',
          max: 4,
        });

        this.boss.on('error', (err: any) => {
          this.logger.warn(`PgBoss error (using internal runner): ${err.message}`);
        });

        await this.boss.start();
        try {
          await this.boss.createQueue('screen-question');
        } catch (e) {}
        await this.boss.work('screen-question', async (job: any) => {
          const { versionId } = job.data;
          this.logger.log(`Processing screening job for version: ${versionId}`);
          await this.originalityService.screenQuestion(versionId);
        });
        this.logger.log('PgBoss screening worker active and listening on queue "screen-question"');
      } catch (err: any) {
        this.logger.warn(`PgBoss start deferred (${err.message}). Starting robust internal polling worker.`);
        this.startInternalRunner();
      }
    } else {
      this.startInternalRunner();
    }
  }

  async onModuleDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.boss) {
      try {
        await this.boss.stop();
      } catch (e) {}
    }
  }

  /**
   * Enqueue a screening job for a newly submitted question version
   */
  async enqueue(versionId: string) {
    if (this.boss) {
      try {
        await this.boss.send('screen-question', { versionId }, { retryLimit: 3, retryDelay: 10 });
        return;
      } catch (e: any) {
        this.logger.warn(`PgBoss send failed (${e.message}), executing screening directly.`);
      }
    }
    // Async direct execution fallback
    setImmediate(() => {
      this.originalityService.screenQuestion(versionId).catch((err) => {
        this.logger.error(`Direct screening failed for ${versionId}: ${err.message}`);
      });
    });
  }

  /**
   * Robust background fallback runner that picks up uncompleted screening tasks
   */
  private startInternalRunner() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        // Look for any versions stuck in SUBMITTED or SCREENING for > 15 seconds
        const pending = await this.prisma.questionVersion.findMany({
          where: {
            status: { in: ['SUBMITTED', 'SCREENING'] },
          },
          take: 3,
        });

        for (const v of pending) {
          try {
            await this.originalityService.screenQuestion(v.id);
          } catch (e: any) {
            this.logger.warn(`Worker screening attempt failed for ${v.id}: ${e.message}`);
          }
        }
      } catch (err) {}
      finally {
        this.isProcessing = false;
      }
    }, 10000);
  }
}
