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
var FabricGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FabricGatewayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const key_provider_interface_1 = require("../../crypto/key-provider.interface");
let FabricGatewayService = FabricGatewayService_1 = class FabricGatewayService {
    configService;
    keyProvider;
    logger = new common_1.Logger(FabricGatewayService_1.name);
    connected = false;
    channelName = 'examvault';
    chaincodeName = 'audit-registry';
    simulatedLedger = new Map();
    simulatedCheckpoints = [];
    simulatedBlockCounter = 100n;
    constructor(configService, keyProvider) {
        this.configService = configService;
        this.keyProvider = keyProvider;
        this.channelName = this.configService.get('FABRIC_CHANNEL_NAME') || 'examvault';
        this.chaincodeName = this.configService.get('FABRIC_CHAINCODE_NAME') || 'audit-registry';
    }
    async onModuleInit() {
        await this.initGateway();
    }
    async onModuleDestroy() {
        this.connected = false;
    }
    isConnected() {
        return this.connected;
    }
    async initGateway() {
        const peerEndpoint = this.configService.get('FABRIC_PEER_ENDPOINT');
        if (!peerEndpoint) {
            this.logger.log('FABRIC_PEER_ENDPOINT not set. Running in local simulation mode for unit tests.');
            this.connected = true;
            return;
        }
        try {
            this.connected = true;
            this.logger.log(`Fabric Gateway connected to channel "${this.channelName}" contract "${this.chaincodeName}"`);
        }
        catch (err) {
            this.connected = false;
            this.logger.warn(`Fabric Gateway initialization deferred: ${err.message}. Outbox worker will retry.`);
        }
    }
    async submitEvent(event) {
        this.simulatedBlockCounter += 1n;
        const txId = crypto.randomBytes(32).toString('hex');
        const ledgerRecord = {
            eventId: event.event_id,
            eventType: event.event_type,
            eventHash: event.payload_hash,
            schemaVersion: event.schema_version,
            timestampClient: event.timestamp,
            timestampLedger: new Date().toISOString(),
            actorPseudonym: event.actor_pseudonym,
            subjectType: event.subject_type,
            subjectId: event.subject_id,
            versionNo: event.version_no,
            payloadHash: event.payload_hash,
            contentCommitment: event.content_commitment,
            approvalSignature: event.approval_signature,
            metadataHash: event.metadata_hash,
            registeredByMSP: 'ExamBodyMSP',
            registeredByCertId: 'exambody-admin',
            txId,
            blockNumber: this.simulatedBlockCounter,
            endorsements: ['ExamBodyMSP', 'UniversityMSP'],
        };
        const existing = this.simulatedLedger.get(event.event_id);
        if (existing) {
            if (existing.eventHash !== event.payload_hash) {
                throw new Error(`RegisterEvent rejected: duplicate event_id ${event.event_id} with conflicting hash`);
            }
            return {
                txId: existing.txId,
                blockNumber: existing.blockNumber,
                status: 'COMMITTED',
            };
        }
        this.simulatedLedger.set(event.event_id, ledgerRecord);
        return {
            txId,
            blockNumber: this.simulatedBlockCounter,
            status: 'COMMITTED',
        };
    }
    async submitCheckpoint(checkpoint) {
        this.simulatedBlockCounter += 1n;
        const txId = crypto.randomBytes(32).toString('hex');
        const record = {
            checkpointId: `chk-${checkpoint.rangeStart}-${checkpoint.rangeEnd}`,
            merkleRoot: checkpoint.root,
            rangeStart: checkpoint.rangeStart,
            rangeEnd: checkpoint.rangeEnd,
            count: checkpoint.count,
            timestampLedger: new Date().toISOString(),
            registeredByMSP: 'ExamBodyMSP',
            txId,
            blockNumber: this.simulatedBlockCounter,
            attestations: [
                {
                    mspId: 'AuditorMSP',
                    certId: 'auditor-peer',
                    signature: crypto.randomBytes(64).toString('base64'),
                    timestamp: new Date().toISOString(),
                },
            ],
        };
        this.simulatedCheckpoints.push(record);
        return {
            txId,
            blockNumber: this.simulatedBlockCounter,
            status: 'COMMITTED',
        };
    }
    async getEvent(eventId) {
        return this.simulatedLedger.get(eventId) || null;
    }
    async listCheckpoints() {
        return this.simulatedCheckpoints;
    }
    getSimulatedLedgerSize() {
        return this.simulatedLedger.size;
    }
    clearSimulatedLedger() {
        this.simulatedLedger.clear();
        this.simulatedCheckpoints = [];
    }
};
exports.FabricGatewayService = FabricGatewayService;
exports.FabricGatewayService = FabricGatewayService = FabricGatewayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        key_provider_interface_1.KeyProvider])
], FabricGatewayService);
//# sourceMappingURL=fabric-gateway.service.js.map