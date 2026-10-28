import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import {
  CanonicalAuditEvent,
  validateCanonicalEvent,
} from '@examvault/audit-canonical';

export interface LedgerEventRecord {
  eventId: string;
  eventType: string;
  eventHash: string;
  schemaVersion: string;
  timestampClient: string;
  timestampLedger: string;
  timestampDriftSeconds: number;
  actorPseudonym: string | null;
  subjectType: string;
  subjectId: string;
  versionNo: number | null;
  payloadHash: string;
  contentCommitment: string | null;
  approvalSignature: string | null;
  metadataHash: string;
  registeredByMSP: string;
  txId: string;
  blockTimestamp: string;
}

export interface CheckpointAttestation {
  mspId: string;
  signature: string;
  timestamp: string;
}

export interface LedgerCheckpointRecord {
  checkpointId: string;
  merkleRoot: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  timestampLedger: string;
  registeredByMSP: string;
  txId: string;
  attestations: CheckpointAttestation[];
}

@Info({ title: 'AuditRegistryContract', description: 'ExamVault Tamper-Evident Distributed Audit Ledger' })
export class AuditRegistryContract extends Contract {
  constructor() {
    super('AuditRegistryContract');
  }

  /**
   * Register a single security-relevant event
   * Access Control: Only ExamBodyMSP may anchor primary events
   */
  @Transaction(true)
  public async RegisterEvent(ctx: Context, eventJson: string): Promise<string> {
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (callerMSP !== 'ExamBodyMSP') {
      throw new Error(`Unauthorized: only ExamBodyMSP is authorized to call RegisterEvent. Caller was ${callerMSP}`);
    }

    let event: CanonicalAuditEvent;
    try {
      event = JSON.parse(eventJson);
    } catch {
      throw new Error('RegisterEvent payload must be valid JSON');
    }

    const validation = validateCanonicalEvent(event);
    if (!validation.valid) {
      throw new Error(`RegisterEvent rejected: schema validation failure: ${validation.errors.join('; ')}`);
    }

    const eventKey = `EVENT_${event.event_id}`;
    const existingBytes = await ctx.stub.getState(eventKey);

    if (existingBytes && existingBytes.length > 0) {
      const existing: LedgerEventRecord = JSON.parse(existingBytes.toString());
      if (existing.eventHash === event.payload_hash) {
        // Idempotent retry: return existing record
        return JSON.stringify(existing);
      }
      throw new Error(`RegisterEvent conflict: event_id ${event.event_id} already registered with different hash`);
    }

    // Ledger timestamp from block environment
    const txTimestamp = ctx.stub.getTxTimestamp();
    const ledgerTimestampMs = txTimestamp.seconds.low * 1000 + Math.floor(txTimestamp.nanos / 1000000);
    const ledgerTimeIso = new Date(ledgerTimestampMs).toISOString();

    const clientTimestampMs = Date.parse(event.timestamp);
    const driftSeconds = Math.abs(Math.round((ledgerTimestampMs - clientTimestampMs) / 1000));

    const record: LedgerEventRecord = {
      eventId: event.event_id,
      eventType: event.event_type,
      eventHash: event.payload_hash,
      schemaVersion: event.schema_version,
      timestampClient: event.timestamp,
      timestampLedger: ledgerTimeIso,
      timestampDriftSeconds: driftSeconds,
      actorPseudonym: event.actor_pseudonym,
      subjectType: event.subject_type,
      subjectId: event.subject_id,
      versionNo: event.version_no,
      payloadHash: event.payload_hash,
      contentCommitment: event.content_commitment,
      approvalSignature: event.approval_signature,
      metadataHash: event.metadata_hash,
      registeredByMSP: callerMSP,
      txId: ctx.stub.getTxID(),
      blockTimestamp: ledgerTimeIso,
    };

    const recordBytes = Buffer.from(JSON.stringify(record));
    await ctx.stub.putState(eventKey, recordBytes);

    // Secondary index for subject history
    const indexKey = `SUBJ_${event.subject_type}_${event.subject_id}_${event.event_id}`;
    await ctx.stub.putState(indexKey, Buffer.from(event.event_id));

    // Emit event for listeners
    ctx.stub.setEvent(
      'EventRegistered',
      Buffer.from(
        JSON.stringify({
          eventId: event.event_id,
          eventType: event.event_type,
          txId: record.txId,
          hash: event.payload_hash,
        }),
      ),
    );

    return JSON.stringify(record);
  }

  /**
   * Register a Merkle root checkpoint for batched BULK events
   * Access Control: Only ExamBodyMSP
   */
  @Transaction(true)
  public async RegisterCheckpoint(
    ctx: Context,
    root: string,
    rangeStart: number,
    rangeEnd: number,
    count: number,
  ): Promise<string> {
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (callerMSP !== 'ExamBodyMSP') {
      throw new Error(`Unauthorized: only ExamBodyMSP may register checkpoints. Caller: ${callerMSP}`);
    }

    if (!/^[0-9a-f]{64}$/i.test(root)) {
      throw new Error('Merkle root must be a 64-character hex string');
    }

    const checkpointId = `CHK_${rangeStart}_${rangeEnd}`;
    const txTimestamp = ctx.stub.getTxTimestamp();
    const ledgerTimestampMs = txTimestamp.seconds.low * 1000 + Math.floor(txTimestamp.nanos / 1000000);

    const record: LedgerCheckpointRecord = {
      checkpointId,
      merkleRoot: root.toLowerCase(),
      rangeStart: Number(rangeStart),
      rangeEnd: Number(rangeEnd),
      count: Number(count),
      timestampLedger: new Date(ledgerTimestampMs).toISOString(),
      registeredByMSP: callerMSP,
      txId: ctx.stub.getTxID(),
      attestations: [],
    };

    await ctx.stub.putState(checkpointId, Buffer.from(JSON.stringify(record)));

    ctx.stub.setEvent(
      'CheckpointRegistered',
      Buffer.from(JSON.stringify({ checkpointId, root: record.merkleRoot, count })),
    );

    return JSON.stringify(record);
  }

  /**
   * Attest to a checkpoint by recording a countersignature from an independent organization
   * Access Control: UniversityMSP or AuditorMSP only (ExamBody cannot countersign its own checkpoint)
   */
  @Transaction(true)
  public async AttestCheckpoint(
    ctx: Context,
    rangeStart: number,
    rangeEnd: number,
    signature: string,
  ): Promise<string> {
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (callerMSP !== 'UniversityMSP' && callerMSP !== 'AuditorMSP') {
      throw new Error(`Unauthorized: only UniversityMSP or AuditorMSP may attest checkpoints. Caller: ${callerMSP}`);
    }

    const checkpointId = `CHK_${rangeStart}_${rangeEnd}`;
    const bytes = await ctx.stub.getState(checkpointId);
    if (!bytes || bytes.length === 0) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const checkpoint: LedgerCheckpointRecord = JSON.parse(bytes.toString());

    // Check if org already attested
    if (checkpoint.attestations.some((a) => a.mspId === callerMSP)) {
      throw new Error(`Organization ${callerMSP} has already attested checkpoint ${checkpointId}`);
    }

    const txTimestamp = ctx.stub.getTxTimestamp();
    const ledgerTimestampMs = txTimestamp.seconds.low * 1000 + Math.floor(txTimestamp.nanos / 1000000);

    checkpoint.attestations.push({
      mspId: callerMSP,
      signature,
      timestamp: new Date(ledgerTimestampMs).toISOString(),
    });

    await ctx.stub.putState(checkpointId, Buffer.from(JSON.stringify(checkpoint)));

    ctx.stub.setEvent(
      'CheckpointAttested',
      Buffer.from(JSON.stringify({ checkpointId, attestedBy: callerMSP })),
    );

    return JSON.stringify(checkpoint);
  }

  /**
   * Read-only Query: GetEvent
   */
  @Transaction(false)
  @Returns('string')
  public async GetEvent(ctx: Context, eventId: string): Promise<string> {
    const bytes = await ctx.stub.getState(`EVENT_${eventId}`);
    if (!bytes || bytes.length === 0) {
      throw new Error(`Event ${eventId} not found on ledger`);
    }
    return bytes.toString();
  }

  /**
   * Read-only Query: VerifyEvent
   */
  @Transaction(false)
  @Returns('string')
  public async VerifyEvent(ctx: Context, eventId: string, expectedHash: string): Promise<string> {
    const bytes = await ctx.stub.getState(`EVENT_${eventId}`);
    if (!bytes || bytes.length === 0) {
      return JSON.stringify({ valid: false, reason: 'NOT_FOUND' });
    }

    const record: LedgerEventRecord = JSON.parse(bytes.toString());
    const match = record.eventHash === expectedHash.toLowerCase();

    return JSON.stringify({
      valid: match,
      storedHash: record.eventHash,
      expectedHash: expectedHash.toLowerCase(),
      txId: record.txId,
      timestampLedger: record.timestampLedger,
      registeredByMSP: record.registeredByMSP,
    });
  }

  /**
   * Read-only Query: ListCheckpoints
   */
  @Transaction(false)
  @Returns('string')
  public async ListCheckpoints(ctx: Context): Promise<string> {
    const iterator = await ctx.stub.getStateByRange('CHK_', 'CHK_\uffff');
    const checkpoints: LedgerCheckpointRecord[] = [];

    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value) {
        try {
          const raw = Buffer.from(result.value.value).toString('utf8');
          if (raw) {
            checkpoints.push(JSON.parse(raw));
          }
        } catch {}
      }
      result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(checkpoints);
  }
}
