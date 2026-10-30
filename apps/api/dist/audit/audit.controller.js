"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const audit_service_1 = require("./audit.service");
const audit_dispatcher_service_1 = require("./audit-dispatcher.service");
const audit_outbox_worker_1 = require("./outbox/audit-outbox.worker");
const audit_reconciliation_service_1 = require("./reconciliation/audit-reconciliation.service");
const audit_checkpoint_service_1 = require("./checkpoints/audit-checkpoint.service");
const storage_integrity_service_1 = require("./storage/storage-integrity.service");
const prisma_service_1 = require("../prisma/prisma.service");
let AuditController = class AuditController {
    auditService;
    auditDispatcher;
    outboxWorker;
    reconciliationService;
    checkpointService;
    storageIntegrityService;
    prisma;
    constructor(auditService, auditDispatcher, outboxWorker, reconciliationService, checkpointService, storageIntegrityService, prisma) {
        this.auditService = auditService;
        this.auditDispatcher = auditDispatcher;
        this.outboxWorker = outboxWorker;
        this.reconciliationService = reconciliationService;
        this.checkpointService = checkpointService;
        this.storageIntegrityService = storageIntegrityService;
        this.prisma = prisma;
    }
    async findAll(action, actorId, targetType, targetId, from, to, page, limit) {
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
    async verify() {
        const result = await this.auditService.verifyChain();
        return { success: true, data: result };
    }
    async verifyEvent(id) {
        const result = await this.auditDispatcher.verifyAll(id);
        return { success: true, data: result };
    }
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
    async flushOutbox() {
        const result = await this.outboxWorker.flushOutbox();
        return { success: true, data: result };
    }
    async runReconciliation() {
        const report = await this.reconciliationService.runReconciliation();
        return { success: true, data: report };
    }
    async createCheckpoint(limit) {
        const take = limit ? parseInt(limit, 10) : 100;
        const result = await this.checkpointService.createCheckpoint(take);
        return { success: true, data: result };
    }
    async listCheckpoints() {
        const checkpoints = await this.prisma.merkleCheckpoint.findMany({
            orderBy: { rangeEnd: 'desc' },
            take: 20,
        });
        return { success: true, data: checkpoints };
    }
    async getInclusionProof(eventId) {
        const proof = await this.checkpointService.getInclusionProof(eventId);
        return { success: true, data: proof };
    }
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
    async triggerStorageScan() {
        const report = await this.storageIntegrityService.runIntegrityScan();
        return { success: true, data: report };
    }
    async listStorageScans(limit) {
        const take = limit ? parseInt(limit, 10) : 10;
        const scans = await this.storageIntegrityService.getRecentScans(take);
        return { success: true, data: scans };
    }
    async backfillStorageHashes() {
        const result = await this.storageIntegrityService.backfillCiphertextHashes();
        return { success: true, data: result };
    }
    async verifyApprovals(questionId, versionNo) {
        const result = await this.auditService.verifyApprovals(questionId, parseInt(versionNo, 10));
        return { success: true, data: result };
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'List audit events (ADMIN/AUDITOR only)' }),
    (0, swagger_1.ApiQuery)({ name: 'action', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'actorId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'targetType', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'targetId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Query)('action')),
    __param(1, (0, common_1.Query)('actorId')),
    __param(2, (0, common_1.Query)('targetType')),
    __param(3, (0, common_1.Query)('targetId')),
    __param(4, (0, common_1.Query)('from')),
    __param(5, (0, common_1.Query)('to')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('verify'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify audit chain integrity (Design B signed hash chain)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "verify", null);
__decorate([
    (0, common_1.Get)('verify/:id'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify single event across all active sinks' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "verifyEvent", null);
__decorate([
    (0, common_1.Get)('outbox'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get audit outbox backlog status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "getOutboxStatus", null);
__decorate([
    (0, common_1.Post)('outbox/flush'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger immediate flush of pending audit outbox entries' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "flushOutbox", null);
__decorate([
    (0, common_1.Get)('reconciliation'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Run reconciliation between Postgres events and Fabric records' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "runReconciliation", null);
__decorate([
    (0, common_1.Post)('checkpoints'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Generate signed Merkle checkpoint and submit to witness and Fabric' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "createCheckpoint", null);
__decorate([
    (0, common_1.Get)('checkpoints'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'List Merkle checkpoints' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "listCheckpoints", null);
__decorate([
    (0, common_1.Get)('proof/:eventId'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get Merkle inclusion proof for an event' }),
    __param(0, (0, common_1.Param)('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "getInclusionProof", null);
__decorate([
    (0, common_1.Get)('integrity'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get comprehensive integrity dashboard status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "getIntegritySummary", null);
__decorate([
    (0, common_1.Post)('storage/scan'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger on-demand ciphertext storage integrity scan (Postgres & MinIO)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "triggerStorageScan", null);
__decorate([
    (0, common_1.Get)('storage/scans'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'List recent storage integrity scan reports' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "listStorageScans", null);
__decorate([
    (0, common_1.Post)('storage/backfill'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Backfill ciphertext hashes for legacy QuestionVersion rows' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "backfillStorageHashes", null);
__decorate([
    (0, common_1.Get)('approvals/verify/:questionId/:versionNo'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR', 'MODERATOR', 'REVIEWER', 'EXAMINER'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify all digital approval signatures for a question version (Zero Content)' }),
    __param(0, (0, common_1.Param)('questionId')),
    __param(1, (0, common_1.Param)('versionNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "verifyApprovals", null);
exports.AuditController = AuditController = __decorate([
    (0, swagger_1.ApiTags)('Audit'),
    (0, common_1.Controller)('audit'),
    __metadata("design:paramtypes", [audit_service_1.AuditService,
        audit_dispatcher_service_1.AuditDispatcherService,
        audit_outbox_worker_1.AuditOutboxWorker,
        audit_reconciliation_service_1.AuditReconciliationService,
        audit_checkpoint_service_1.AuditCheckpointService,
        storage_integrity_service_1.StorageIntegrityService,
        prisma_service_1.PrismaService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map