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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlainLogSink = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let PlainLogSink = class PlainLogSink {
    prisma;
    sinkType = 'PLAIN_LOG';
    constructor(prisma) {
        this.prisma = prisma;
    }
    async append(event, tx) {
        const client = tx || this.prisma;
        const created = await client.plainAuditLog.create({
            data: {
                id: event.event_id,
                timestamp: new Date(event.timestamp),
                eventType: event.event_type,
                subjectType: event.subject_type,
                subjectId: event.subject_id,
                payload: event,
            },
        });
        return {
            sinkType: 'PLAIN_LOG',
            receiptId: created.id,
            timestamp: created.timestamp.toISOString(),
        };
    }
    async verify(eventId) {
        const record = await this.prisma.plainAuditLog.findUnique({
            where: { id: eventId },
        });
        if (!record) {
            return {
                valid: false,
                sinkType: 'PLAIN_LOG',
                checkedAt: new Date().toISOString(),
                details: {},
                discrepancy: `Plain log record ${eventId} not found`,
            };
        }
        return {
            valid: true,
            sinkType: 'PLAIN_LOG',
            checkedAt: new Date().toISOString(),
            details: {
                note: 'Baseline unchained, unsigned log — cannot detect database tampering',
            },
        };
    }
};
exports.PlainLogSink = PlainLogSink;
exports.PlainLogSink = PlainLogSink = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlainLogSink);
//# sourceMappingURL=plain-log.sink.js.map