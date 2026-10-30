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
var AuditReconciliationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const fabric_gateway_service_1 = require("../fabric/fabric-gateway.service");
let AuditReconciliationService = AuditReconciliationService_1 = class AuditReconciliationService {
    prisma;
    fabricGateway;
    logger = new common_1.Logger(AuditReconciliationService_1.name);
    constructor(prisma, fabricGateway) {
        this.prisma = prisma;
        this.fabricGateway = fabricGateway;
    }
    /**
     * Compares all Postgres audit events against Fabric ledger records
     */
    async runReconciliation() {
        const postgresEvents = await this.prisma.auditEvent.findMany({
            orderBy: { timestamp: 'asc' },
            select: {
                id: true,
                action: true,
                timestamp: true,
                payloadHash: true,
                entryHash: true,
            },
        });
        const missingOnFabric = [];
        const mismatchedHashes = [];
        let totalFabricAnchored = 0;
        for (const event of postgresEvents) {
            const ledgerRecord = await this.fabricGateway.getEvent(event.id);
            if (!ledgerRecord) {
                missingOnFabric.push({
                    eventId: event.id,
                    eventType: event.action,
                    timestamp: event.timestamp.toISOString(),
                });
            }
            else {
                totalFabricAnchored++;
                const expectedHash = event.payloadHash || event.entryHash;
                if (ledgerRecord.eventHash !== expectedHash) {
                    mismatchedHashes.push({
                        eventId: event.id,
                        postgresHash: expectedHash,
                        fabricHash: ledgerRecord.eventHash,
                    });
                }
            }
        }
        const hasDiscrepancy = missingOnFabric.length > 0 || mismatchedHashes.length > 0;
        return {
            status: hasDiscrepancy ? 'DISCREPANCY_DETECTED' : 'CLEAN',
            checkedAt: new Date().toISOString(),
            totalPostgresEvents: postgresEvents.length,
            totalFabricAnchored,
            missingOnFabric,
            mismatchedHashes,
        };
    }
};
exports.AuditReconciliationService = AuditReconciliationService;
exports.AuditReconciliationService = AuditReconciliationService = AuditReconciliationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fabric_gateway_service_1.FabricGatewayService])
], AuditReconciliationService);
//# sourceMappingURL=audit-reconciliation.service.js.map