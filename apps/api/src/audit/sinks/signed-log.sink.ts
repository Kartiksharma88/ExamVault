import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { KeyProvider, KEY_PROVIDER } from '../../crypto/key-provider.interface';
import { CanonicalAuditEvent, canonicalizeJson } from '@examvault/audit-canonical';
import { AuditSink, AuditReceipt, AuditVerifyResult, SinkType } from './audit-sink.interface';

@Injectable()
export class SignedLogSink implements AuditSink {
  public readonly sinkType: SinkType = 'SIGNED_LOG';
  private readonly logger = new Logger(SignedLogSink.name);
  public static readonly GENESIS_HASH = '0'.repeat(64);

  constructor(
    private prisma: PrismaService,
    @Inject(KEY_PROVIDER) private keyProvider: KeyProvider,
  ) {}

  async append(event: CanonicalAuditEvent, tx?: any): Promise<AuditReceipt> {
    const client = tx || this.prisma;

    const lastEvent = await client.auditEvent.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { entryHash: true },
    });
    const prevHash = lastEvent?.entryHash || SignedLogSink.GENESIS_HASH;

    const enrichedEvent: CanonicalAuditEvent = {
      ...event,
      prev_event_hash: prevHash,
    };

    const canonicalEvent = canonicalizeJson(enrichedEvent);

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

  async verify(eventId: string, expectedHash?: string): Promise<AuditVerifyResult> {
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

    const canonicalObj: CanonicalAuditEvent = {
      schema_version: (event.schemaVersion as any) || '1.0.0',
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

    const canonicalJson = canonicalizeJson(canonicalObj);
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
      signatureValid = await this.keyProvider.verify(
        Buffer.from(event.entryHash, 'hex'),
        Buffer.from(event.signature, 'base64'),
      );
    } catch {
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
}
