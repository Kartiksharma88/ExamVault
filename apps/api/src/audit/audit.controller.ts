import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles, SkipCsrf } from '../auth/auth.guard';
import { AuditService } from './audit.service';
import { AuditDispatcherService } from './audit-dispatcher.service';
import { AuditOutboxWorker } from './outbox/audit-outbox.worker';
import { AuditReconciliationService } from './reconciliation/audit-reconciliation.service';
import { AuditCheckpointService } from './checkpoints/audit-checkpoint.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(
    private auditService: AuditService,
    private auditDispatcher: AuditDispatcherService,
    private outboxWorker: AuditOutboxWorker,
    private reconciliationService: AuditReconciliationService,
    private checkpointService: AuditCheckpointService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'List audit events (ADMIN/AUDITOR only)' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.auditService.findAll({
      action,
      actorId,
      targetType,
      targetId,
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return { success: true, data: result };
  }

  @Get('verify')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Verify audit chain integrity (Design B signed hash chain)' })
  async verify() {
    const result = await this.auditService.verifyChain();
    return { success: true, data: result };
  }

  @Get('verify/:id')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Verify single event across all active sinks' })
  async verifyEvent(@Param('id') id: string) {
    const result = await this.auditDispatcher.verifyAll(id);
    return { success: true, data: result };
  }

  @Get('outbox')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Get audit outbox backlog status' })
  async getOutboxStatus() {
    const pendingCount = await this.prisma.auditOutbox.count({
      where: { status: 'PENDING' },
    });
    const failedCount = await this.prisma.auditOutbox.count({
      where: { status: 'FAILED' },
    });
    const committedCount = await this.prisma.auditOutbox.count({
      where: { status: 'COMMITTED' },
    });
    const oldestPending = await this.prisma.auditOutbox.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    return {
      success: true,
      data: {
        pendingCount,
        failedCount,
        committedCount,
        oldestPendingAt: oldestPending?.createdAt || null,
        backlogAgeSeconds: oldestPending
          ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 1000)
          : 0,
      },
    };
  }

  @Post('outbox/flush')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate flush of pending audit outbox entries' })
  async flushOutbox() {
    const result = await this.outboxWorker.flushOutbox();
    return { success: true, data: result };
  }

  @Get('reconciliation')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Run reconciliation between Postgres events and Fabric records' })
  async runReconciliation() {
    const report = await this.reconciliationService.runReconciliation();
    return { success: true, data: report };
  }

  @Post('checkpoints')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate signed Merkle checkpoint and submit to witness and Fabric' })
  async createCheckpoint(@Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 100;
    const result = await this.checkpointService.createCheckpoint(take);
    return { success: true, data: result };
  }

  @Get('checkpoints')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'List Merkle checkpoints' })
  async listCheckpoints() {
    const checkpoints = await this.prisma.merkleCheckpoint.findMany({
      orderBy: { rangeEnd: 'desc' },
      take: 20,
    });
    return { success: true, data: checkpoints };
  }

  @Get('proof/:eventId')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Get Merkle inclusion proof for an event' })
  async getInclusionProof(@Param('eventId') eventId: string) {
    const proof = await this.checkpointService.getInclusionProof(eventId);
    return { success: true, data: proof };
  }

  @Get('integrity')
  @Roles('ADMIN', 'AUDITOR')
  @SkipCsrf()
  @ApiOperation({ summary: 'Get comprehensive integrity dashboard status' })
  async getIntegritySummary() {
    const chainVerification = await this.auditService.verifyChain();
    const latestCheckpoint = await this.prisma.merkleCheckpoint.findFirst({
      orderBy: { rangeEnd: 'desc' },
    });
    const pendingOutbox = await this.prisma.auditOutbox.count({
      where: { status: 'PENDING' },
    });
    const failedOutbox = await this.prisma.auditOutbox.count({
      where: { status: 'FAILED' },
    });

    return {
      success: true,
      data: {
        designB: {
          status: chainVerification.valid ? 'HEALTHY' : 'COMPROMISED',
          totalEvents: chainVerification.totalEntries,
          verifiedEvents: chainVerification.verifiedEntries,
          firstBrokenEntry: chainVerification.firstBrokenEntry || null,
        },
        designA: {
          status: failedOutbox > 0 ? 'BACKLOG_FAILURES' : pendingOutbox > 0 ? 'PENDING_ANCHOR' : 'SYNCHRONIZED',
          pendingBacklog: pendingOutbox,
          failedBacklog: failedOutbox,
        },
        checkpoints: {
          latestCheckpointId: latestCheckpoint?.id || null,
          latestRootHash: latestCheckpoint?.rootHash || null,
          totalCheckpointedEvents: latestCheckpoint?.rangeEnd || 0,
          witnessSigned: !!latestCheckpoint?.witnessSignature,
        },
      },
    };
  }

  @Get('approvals/verify/:questionId/:versionNo')
  @Roles('ADMIN', 'AUDITOR', 'MODERATOR', 'REVIEWER', 'EXAMINER')
  @SkipCsrf()
  @ApiOperation({ summary: 'Verify all digital approval signatures for a question version (Zero Content)' })
  async verifyApprovals(
    @Param('questionId') questionId: string,
    @Param('versionNo') versionNo: string,
  ) {
    const result = await this.auditService.verifyApprovals(
      questionId,
      parseInt(versionNo, 10),
    );
    return { success: true, data: result };
  }
}

