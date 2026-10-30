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
var FabricSink_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FabricSink = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const fabric_gateway_service_1 = require("../fabric/fabric-gateway.service");
let FabricSink = FabricSink_1 = class FabricSink {
    prisma;
    fabricGateway;
    sinkType = 'FABRIC';
    logger = new common_1.Logger(FabricSink_1.name);
    constructor(prisma, fabricGateway) {
        this.prisma = prisma;
        this.fabricGateway = fabricGateway;
    }
    async append(event, tx) {
        const client = tx || this.prisma;
        const outbox = await client.auditOutbox.create({
            data: {
                eventId: event.event_id,
                sinkType: 'FABRIC',
                status: 'PENDING',
                payload: event,
                retryCount: 0,
            },
        });
        return {
            sinkType: 'FABRIC',
            receiptId: outbox.id,
            timestamp: new Date().toISOString(),
            details: {
                outboxId: outbox.id,
                status: 'QUEUED_FOR_ANCHORING',
            },
        };
    }
    async verify(eventId, expectedHash) {
        if (!this.fabricGateway || !this.fabricGateway.isConnected()) {
            const outbox = await this.prisma.auditOutbox.findFirst({
                where: { eventId, sinkType: 'FABRIC' },
            });
            return {
                valid: outbox?.status === 'COMMITTED',
                sinkType: 'FABRIC',
                checkedAt: new Date().toISOString(),
                details: {
                    outboxStatus: outbox?.status || 'NOT_FOUND',
                    fabricTxId: outbox?.fabricTxId,
                    fabricBlockNo: outbox?.fabricBlockNo ? outbox.fabricBlockNo.toString() : null,
                    gatewayConnected: false,
                    note: 'Fabric peer gateway disconnected or simulated. Verifying against recorded outbox commit status.',
                },
                discrepancy: outbox?.status === 'COMMITTED'
                    ? undefined
                    : `Event ${eventId} is ${outbox?.status || 'missing from outbox'} on Fabric`,
            };
        }
        try {
            const ledgerRecord = await this.fabricGateway.getEvent(eventId);
            if (!ledgerRecord) {
                return {
                    valid: false,
                    sinkType: 'FABRIC',
                    checkedAt: new Date().toISOString(),
                    details: { gatewayConnected: true },
                    discrepancy: `Event ${eventId} not found on Fabric ledger`,
                };
            }
            if (expectedHash && ledgerRecord.eventHash !== expectedHash) {
                return {
                    valid: false,
                    sinkType: 'FABRIC',
                    checkedAt: new Date().toISOString(),
                    details: {
                        storedLedgerHash: ledgerRecord.eventHash,
                        expectedHash,
                        txId: ledgerRecord.txId,
                    },
                    discrepancy: `Ledger hash mismatch: expected ${expectedHash}, found ${ledgerRecord.eventHash}`,
                };
            }
            return {
                valid: true,
                sinkType: 'FABRIC',
                checkedAt: new Date().toISOString(),
                details: {
                    ledgerRecord,
                    txId: ledgerRecord.txId,
                    blockNumber: ledgerRecord.blockNumber,
                    registeredByMSP: ledgerRecord.registeredByMSP,
                    endorsements: ledgerRecord.endorsements,
                },
            };
        }
        catch (err) {
            return {
                valid: false,
                sinkType: 'FABRIC',
                checkedAt: new Date().toISOString(),
                details: { error: err.message },
                discrepancy: `Fabric verification query failed: ${err.message}`,
            };
        }
    }
};
exports.FabricSink = FabricSink;
exports.FabricSink = FabricSink = FabricSink_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fabric_gateway_service_1.FabricGatewayService])
], FabricSink);
//# sourceMappingURL=fabric.sink.js.map