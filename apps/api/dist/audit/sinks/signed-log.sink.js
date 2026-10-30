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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SignedLogSink_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedLogSink = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
const key_provider_interface_1 = require("../../crypto/key-provider.interface");
const audit_canonical_1 = require("@examvault/audit-canonical");
let SignedLogSink = class SignedLogSink {
    static { SignedLogSink_1 = this; }
    prisma;
    keyProvider;
    sinkType = 'SIGNED_LOG';
    logger = new common_1.Logger(SignedLogSink_1.name);
    static GENESIS_HASH = '0'.repeat(64);
    constructor(prisma, keyProvider) {
        this.prisma = prisma;
        this.keyProvider = keyProvider;
    }
    async append(event, tx) {
        const client = tx || this.prisma;
        const lastEvent = await client.auditEvent.findFirst({
            orderBy: { timestamp: 'desc' },
            select: { entryHash: true },
        });
        const prevHash = lastEvent?.entryHash || SignedLogSink_1.GENESIS_HASH;
        const enrichedEvent = {
            ...event,
            prev_event_hash: prevHash,
        };
        const canonicalEvent = (0, audit_canonical_1.canonicalizeJson)(enrichedEvent);
        const entryHash = crypto
            .createHash('sha256')
            .update(prevHash)
            .update(canonicalEvent)
            .digest('hex');
        const signatureBuffer = await this.keyProvider.sign(Buffer.from(entryHash, 'hex'));
        const signatureBase64 = signatureBuffer.toString('base64');
        const created = await client.auditEvent.create({
            data: {
                id: event.event_id,
                timestamp: new Date(event.timestamp),
                schemaVersion: event.schema_version,
                actorPseudonym: event.actor_pseudonym,
                action: event.event_type,
                targetType: event.subject_type,
                targetId: event.subject_id,
                versionNo: event.version_no,
                payloadHash: event.payload_hash,
                contentCommitment: event.content_commitment,
                approvalSignature: event.approval_signature,
                metadataHash: event.metadata_hash,
                prevHash,
                entryHash,
                signature: signatureBase64,
            },
        });
        return {
            sinkType: 'SIGNED_LOG',
            receiptId: created.id,
            timestamp: created.timestamp.toISOString(),
            details: {
                entryHash,
                prevHash,
                signature: signatureBase64,
            },
        };
    }
    async verify(eventId, expectedHash) {
        const event = await this.prisma.auditEvent.findUnique({
            where: { id: eventId },
        });
        if (!event) {
            return {
                valid: false,
                sinkType: 'SIGNED_LOG',
                checkedAt: new Date().toISOString(),
                details: {},
                discrepancy: `Event ${eventId} not found in signed log`,
            };
        }
        if (expectedHash && event.entryHash !== expectedHash) {
            return {
                valid: false,
                sinkType: 'SIGNED_LOG',
                checkedAt: new Date().toISOString(),
                details: { expectedHash, actualHash: event.entryHash },
                discrepancy: `Entry hash mismatch: expected ${expectedHash}, found ${event.entryHash}`,
            };
        }
        const canonicalObj = {
            schema_version: event.schemaVersion || '1.0.0',
            event_id: event.id,
            event_type: event.action,
            timestamp: event.timestamp.toISOString(),
            actor_pseudonym: event.actorPseudonym,
            subject_type: event.targetType,
            subject_id: event.targetId || '',
            version_no: event.versionNo,
            payload_hash: event.payloadHash || '',
            content_commitment: event.contentCommitment,
            approval_signature: event.approvalSignature,
            prev_event_hash: event.prevHash,
            metadata_hash: event.metadataHash || '',
        };
        const canonicalJson = (0, audit_canonical_1.canonicalizeJson)(canonicalObj);
        const expectedComputedHash = crypto
            .createHash('sha256')
            .update(event.prevHash)
            .update(canonicalJson)
            .digest('hex');
        let hashMatches = event.entryHash === expectedComputedHash;
        if (!hashMatches) {
            const legacyCanonical = JSON.stringify({
                timestamp: event.timestamp.toISOString(),
                actorId: event.actorId || null,
                action: event.action,
                targetType: event.targetType,
                targetId: event.targetId || null,
                metadata: event.metadata || null,
            });
            const legacyHash = crypto
                .createHash('sha256')
                .update(event.prevHash)
                .update(legacyCanonical)
                .digest('hex');
            if (event.entryHash === legacyHash) {
                hashMatches = true;
            }
        }
        if (!hashMatches) {
            return {
                valid: false,
                sinkType: 'SIGNED_LOG',
                checkedAt: new Date().toISOString(),
                details: { storedHash: event.entryHash, computedHash: expectedComputedHash },
                discrepancy: `Hash chain verification failed for event ${eventId}`,
            };
        }
        let signatureValid = false;
        try {
            signatureValid = await this.keyProvider.verify(Buffer.from(event.entryHash, 'hex'), Buffer.from(event.signature, 'base64'));
        }
        catch {
            signatureValid = false;
        }
        if (!signatureValid && process.env.NODE_ENV === 'production') {
            return {
                valid: false,
                sinkType: 'SIGNED_LOG',
                checkedAt: new Date().toISOString(),
                details: { storedHash: event.entryHash },
                discrepancy: `Invalid digital signature on event ${eventId}`,
            };
        }
        return {
            valid: true,
            sinkType: 'SIGNED_LOG',
            checkedAt: new Date().toISOString(),
            details: {
                entryHash: event.entryHash,
                prevHash: event.prevHash,
                signatureValid,
            },
        };
    }
};
exports.SignedLogSink = SignedLogSink;
exports.SignedLogSink = SignedLogSink = SignedLogSink_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        key_provider_interface_1.KeyProvider])
], SignedLogSink);
//# sourceMappingURL=signed-log.sink.js.map