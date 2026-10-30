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
var AuditCheckpointService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditCheckpointService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const key_provider_interface_1 = require("../../crypto/key-provider.interface");
const audit_canonical_1 = require("@examvault/audit-canonical");
const fabric_gateway_service_1 = require("../fabric/fabric-gateway.service");
let AuditCheckpointService = AuditCheckpointService_1 = class AuditCheckpointService {
    prisma;
    keyProvider;
    configService;
    fabricGateway;
    logger = new common_1.Logger(AuditCheckpointService_1.name);
    witnessUrl;
    constructor(prisma, keyProvider, configService, fabricGateway) {
        this.prisma = prisma;
        this.keyProvider = keyProvider;
        this.configService = configService;
        this.fabricGateway = fabricGateway;
        this.witnessUrl = this.configService.get('WITNESS_SERVICE_URL') || 'http://localhost:3005';
    }
    getWitnessUrl(path) {
        const base = (process.env.WITNESS_SERVICE_URL ||
            this.configService.get('WITNESS_SERVICE_URL') ||
            this.witnessUrl).replace(/\/$/, '');
        const cleanPath = path.replace(/^\//, '');
        return `${base}/${cleanPath}`;
    }
    /**
     * Builds a Merkle checkpoint over audit events, signs it, and submits to Witness and Fabric
     */
    async createCheckpoint(limit = 100) {
        const lastCheckpoint = await this.prisma.merkleCheckpoint.findFirst({
            orderBy: { rangeEnd: 'desc' },
        });
        const rangeStart = lastCheckpoint ? lastCheckpoint.rangeEnd : 0;
        const events = await this.prisma.auditEvent.findMany({
            orderBy: { timestamp: 'asc' },
            skip: rangeStart,
            take: limit,
        });
        if (events.length === 0) {
            return null;
        }
        const rangeEnd = rangeStart + events.length;
        const treeSize = rangeEnd;
        // Build Merkle Tree using RFC 6962 canonical leaf hashing
        const leafBuffers = events.map((e) => {
            const canonicalObj = {
                schema_version: e.schemaVersion || '1.0.0',
                event_id: e.id,
                event_type: e.action,
                timestamp: e.timestamp.toISOString(),
                actor_pseudonym: e.actorPseudonym,
                subject_type: e.targetType,
                subject_id: e.targetId || '',
                version_no: e.versionNo,
                payload_hash: e.payloadHash || '',
                content_commitment: e.contentCommitment,
                approval_signature: e.approvalSignature,
                prev_event_hash: e.prevHash,
                metadata_hash: e.metadataHash || '',
            };
            return Buffer.from((0, audit_canonical_1.canonicalizeJson)(canonicalObj), 'utf-8');
        });
        const tree = new audit_canonical_1.MerkleTree(leafBuffers);
        const rootHash = tree.getRoot();
        // ExamBody signs rootHash | treeSize | rangeEnd
        const payloadToSign = Buffer.from(`${rootHash.toLowerCase()}|${treeSize}|${rangeEnd}`, 'utf-8');
        const signatureBuffer = await this.keyProvider.sign(payloadToSign);
        const signature = signatureBuffer.toString('base64');
        // Submit to External Witness Service
        let witnessSignature = null;
        let witnessReceipt = null;
        try {
            const res = await fetch(this.getWitnessUrl('checkpoints'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rootHash,
                    rangeStart,
                    rangeEnd,
                    eventCount: events.length,
                    treeSize,
                    authorSignature: signature,
                    timestamp: new Date().toISOString(),
                }),
            });
            if (res.ok) {
                const body = (await res.json());
                witnessReceipt = body.data;
                witnessSignature = witnessReceipt?.witnessSignature || null;
            }
            else {
                const errBody = (await res.json());
                this.logger.warn(`Witness rejected checkpoint (${res.status}): ${errBody.error || res.statusText}`);
            }
        }
        catch (err) {
            this.logger.warn(`Witness service unreachable at ${this.getWitnessUrl('')}: ${err.message}. Checkpoint recorded locally.`);
        }
        // Anchor Checkpoint on Fabric
        let fabricTxId;
        let fabricBlockNo;
        try {
            const fabricReceipt = await this.fabricGateway.submitCheckpoint({
                root: rootHash,
                rangeStart,
                rangeEnd,
                count: events.length,
            });
            fabricTxId = fabricReceipt.txId;
            fabricBlockNo = fabricReceipt.blockNumber.toString();
        }
        catch (err) {
            this.logger.warn(`Fabric checkpoint anchoring deferred: ${err.message}`);
        }
        const checkpoint = await this.prisma.merkleCheckpoint.create({
            data: {
                rootHash,
                rangeStart,
                rangeEnd,
                eventCount: events.length,
                treeSize,
                signature,
                witnessSignature,
                witnessReceipt: witnessReceipt || undefined,
            },
        });
        return {
            checkpointId: checkpoint.id,
            rootHash,
            rangeStart,
            rangeEnd,
            eventCount: events.length,
            treeSize,
            signature,
            witnessSignature,
            witnessReceipt,
            fabricTxId,
            fabricBlockNo,
        };
    }
    /**
     * Generates a Merkle inclusion proof for a given event ID in its checkpoint
     */
    async getInclusionProof(eventId) {
        const event = await this.prisma.auditEvent.findUnique({
            where: { id: eventId },
        });
        if (!event) {
            throw new Error(`Event ${eventId} not found`);
        }
        // Find all events up to the target event to find its sequential index
        const index = await this.prisma.auditEvent.count({
            where: { timestamp: { lte: event.timestamp } },
        });
        const eventIndex = Math.max(0, index - 1);
        // Find the enclosing checkpoint
        const checkpoint = await this.prisma.merkleCheckpoint.findFirst({
            where: {
                rangeStart: { lte: eventIndex },
                rangeEnd: { gt: eventIndex },
            },
        });
        if (!checkpoint) {
            throw new Error(`Event ${eventId} (index ${eventIndex}) is not yet enclosed in a committed checkpoint`);
        }
        // Reconstruct Merkle tree for this checkpoint batch
        const batchEvents = await this.prisma.auditEvent.findMany({
            orderBy: { timestamp: 'asc' },
            skip: checkpoint.rangeStart,
            take: checkpoint.eventCount,
        });
        const leafBuffers = batchEvents.map((e) => {
            const canonicalObj = {
                schema_version: e.schemaVersion || '1.0.0',
                event_id: e.id,
                event_type: e.action,
                timestamp: e.timestamp.toISOString(),
                actor_pseudonym: e.actorPseudonym,
                subject_type: e.targetType,
                subject_id: e.targetId || '',
                version_no: e.versionNo,
                payload_hash: e.payloadHash || '',
                content_commitment: e.contentCommitment,
                approval_signature: e.approvalSignature,
                prev_event_hash: e.prevHash,
                metadata_hash: e.metadataHash || '',
            };
            return Buffer.from((0, audit_canonical_1.canonicalizeJson)(canonicalObj), 'utf-8');
        });
        const tree = new audit_canonical_1.MerkleTree(leafBuffers);
        const leafOffset = eventIndex - checkpoint.rangeStart;
        const proof = tree.getProof(leafOffset);
        const verified = audit_canonical_1.MerkleTree.verifyInclusionProof(proof, checkpoint.rootHash);
        return {
            checkpoint,
            proof,
            verified,
        };
    }
};
exports.AuditCheckpointService = AuditCheckpointService;
exports.AuditCheckpointService = AuditCheckpointService = AuditCheckpointService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        key_provider_interface_1.KeyProvider,
        config_1.ConfigService,
        fabric_gateway_service_1.FabricGatewayService])
], AuditCheckpointService);
//# sourceMappingURL=audit-checkpoint.service.js.map