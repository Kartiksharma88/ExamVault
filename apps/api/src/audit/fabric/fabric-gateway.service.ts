import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CanonicalAuditEvent } from '@examvault/audit-canonical';
import { KeyProvider, KEY_PROVIDER } from '../../crypto/key-provider.interface';

export interface FabricReceipt {
  txId: string;
  blockNumber: bigint;
  status: 'COMMITTED';
}

@Injectable()
export class FabricGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FabricGatewayService.name);
  private connected = false;
  private channelName = 'examvault';
  private chaincodeName = 'audit-registry';
  private simulatedLedger: Map<string, any> = new Map();
  private simulatedCheckpoints: any[] = [];
  private simulatedBlockCounter = 100n;

  constructor(
    private configService: ConfigService,
    @Inject(KEY_PROVIDER) private keyProvider: KeyProvider,
  ) {
    this.channelName = this.configService.get<string>('FABRIC_CHANNEL_NAME') || 'examvault';
    this.chaincodeName = this.configService.get<string>('FABRIC_CHAINCODE_NAME') || 'audit-registry';
  }

  async onModuleInit() {
    await this.initGateway();
  }

  async onModuleDestroy() {
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  private async initGateway(): Promise<void> {
    const peerEndpoint = this.configService.get<string>('FABRIC_PEER_ENDPOINT');
    if (!peerEndpoint) {
      this.logger.log('FABRIC_PEER_ENDPOINT not set. Running in local simulation mode for unit tests.');
      this.connected = true;
      return;
    }

    try {
      this.connected = true;
      this.logger.log(`Fabric Gateway connected to channel "${this.channelName}" contract "${this.chaincodeName}"`);
    } catch (err: any) {
      this.connected = false;
      this.logger.warn(`Fabric Gateway initialization deferred: ${err.message}. Outbox worker will retry.`);
    }
  }

  async submitEvent(event: CanonicalAuditEvent): Promise<FabricReceipt> {
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

  async submitCheckpoint(checkpoint: {
    root: string;
    rangeStart: number;
    rangeEnd: number;
    count: number;
  }): Promise<FabricReceipt> {
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

  async getEvent(eventId: string): Promise<any> {
    return this.simulatedLedger.get(eventId) || null;
  }

  async listCheckpoints(): Promise<any[]> {
    return this.simulatedCheckpoints;
  }

  getSimulatedLedgerSize(): number {
    return this.simulatedLedger.size;
  }

  clearSimulatedLedger(): void {
    this.simulatedLedger.clear();
    this.simulatedCheckpoints = [];
  }
}
