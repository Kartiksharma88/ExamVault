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
var AuditOutboxWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditOutboxWorker = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const fabric_gateway_service_1 = require("../fabric/fabric-gateway.service");
let AuditOutboxWorker = AuditOutboxWorker_1 = class AuditOutboxWorker {
    prisma;
    fabricGateway;
    logger = new common_1.Logger(AuditOutboxWorker_1.name);
    timer = null;
    isFlushing = false;
    intervalMs = 5000;
    constructor(prisma, fabricGateway) {
        this.prisma = prisma;
        this.fabricGateway = fabricGateway;
    }
    onModuleInit() {
        if (process.env.VERCEL) {
            this.logger.log('Vercel serverless environment: skipping background outbox worker');
            return;
        }
        this.startWorker();
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    startWorker(intervalMs = 5000) {
        if (this.timer)
            clearInterval(this.timer);
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
    async flushOutbox(batchSize = 25) {
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
                const event = item.payload;
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
                }
                catch (err) {
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
                    this.logger.warn(`Outbox event ${item.eventId} anchoring failed (attempt ${nextRetryCount}/${item.maxRetries}): ${err.message}`);
                }
            }
            return {
                processed: pendingItems.length,
                succeeded,
                failed,
            };
        }
        finally {
            this.isFlushing = false;
        }
    }
};
exports.AuditOutboxWorker = AuditOutboxWorker;
exports.AuditOutboxWorker = AuditOutboxWorker = AuditOutboxWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fabric_gateway_service_1.FabricGatewayService])
], AuditOutboxWorker);
//# sourceMappingURL=audit-outbox.worker.js.map