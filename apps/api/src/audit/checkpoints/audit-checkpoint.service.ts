import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { KeyProvider, KEY_PROVIDER } from '../../crypto/key-provider.interface';
import { MerkleTree, MerkleInclusionProof, CanonicalAuditEvent, canonicalizeJson } from '@examvault/audit-canonical';
import { FabricGatewayService } from '../fabric/fabric-gateway.service';

export interface CheckpointResult {
  checkpointId: string;
  rootHash: string;
  rangeStart: number;
  rangeEnd: number;
  eventCount: number;
  treeSize: number;
  signature: string;
  witnessSignature?: string | null;
  witnessReceipt?: any;
  fabricTxId?: string;
  fabricBlockNo?: string;
}

@Injectable()
export class AuditCheckpointService {
  private readonly logger = new Logger(AuditCheckpointService.name);
  private witnessUrl: string;

  constructor(
    private prisma: PrismaService,
    @Inject(KEY_PROVIDER) private keyProvider: KeyProvider,
    private configService: ConfigService,
    private fabricGateway: FabricGatewayService,
  ) {
    this.witnessUrl = this.configService.get<string>('WITNESS_SERVICE_URL') || 'http://localhost:3005';
  }

  private getWitnessUrl(path: string): string {
    const base = (
      process.env.WITNESS_SERVICE_URL ||
      this.configService.get<string>('WITNESS_SERVICE_URL') ||
      this.witnessUrl
    ).replace(/\/$/, '');
    const cleanPath = path.replace(/^\//, '');
    return `${base}/${cleanPath}`;
  }

  /**
   * Builds a Merkle checkpoint over audit events, signs it, and submits to Witness and Fabric
   */
  async createCheckpoint(limit = 100): Promise<CheckpointResult | null> {
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
      const canonicalObj: CanonicalAuditEvent = {
        schema_version: (e.schemaVersion as any) || '1.0.0',
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
      return Buffer.from(canonicalizeJson(canonicalObj), 'utf-8');
    });

    const tree = new MerkleTree(leafBuffers);
    const rootHash = tree.getRoot();

    // ExamBody signs rootHash | treeSize | rangeEnd
    const payloadToSign = Buffer.from(`${rootHash.toLowerCase()}|${treeSize}|${rangeEnd}`, 'utf-8');
    const signatureBuffer = await this.keyProvider.sign(payloadToSign);
    const signature = signatureBuffer.toString('base64');

    // Submit to External Witness Service
    let witnessSignature: string | null = null;
    let witnessReceipt: any = null;

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
        const body = (await res.json()) as any;
        witnessReceipt = body.data;
        witnessSignature = witnessReceipt?.witnessSignature || null;
      } else {
        const errBody = (await res.json()) as any;
        this.logger.warn(`Witness rejected checkpoint (${res.status}): ${errBody.error || res.statusText}`);
      }
    } catch (err: any) {
      this.logger.warn(`Witness service unreachable at ${this.getWitnessUrl('')}: ${err.message}. Checkpoint recorded locally.`);
    }

    // Anchor Checkpoint on Fabric
    let fabricTxId: string | undefined;
    let fabricBlockNo: string | undefined;

    try {
      const fabricReceipt = await this.fabricGateway.submitCheckpoint({
        root: rootHash,
        rangeStart,
        rangeEnd,
        count: events.length,
      });
      fabricTxId = fabricReceipt.txId;
      fabricBlockNo = fabricReceipt.blockNumber.toString();
    } catch (err: any) {
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
  async getInclusionProof(eventId: string): Promise<{
    checkpoint: any;
    proof: MerkleInclusionProof;
    verified: boolean;
  }> {
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
      const canonicalObj: CanonicalAuditEvent = {
        schema_version: (e.schemaVersion as any) || '1.0.0',
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
      return Buffer.from(canonicalizeJson(canonicalObj), 'utf-8');
    });

    const tree = new MerkleTree(leafBuffers);
    const leafOffset = eventIndex - checkpoint.rangeStart;
    const proof = tree.getProof(leafOffset);
    const verified = MerkleTree.verifyInclusionProof(proof, checkpoint.rootHash);

    return {
      checkpoint,
      proof,
      verified,
    };
  }
}
