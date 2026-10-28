import { canonicalizeJson } from './canonicalize.js';
import { sha256Hex, hashCanonicalObject, computeActorPseudonym } from './hash.js';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export interface CanonicalAuditEvent {
  schema_version: '1.0.0';
  event_id: string; // UUID v4
  event_type: string;
  timestamp: string; // ISO 8601 UTC (e.g. 2026-10-28T12:00:00.000Z)
  actor_pseudonym: string | null; // 64-character lowercase hex string or null
  subject_type: string; // e.g. QUESTION_VERSION, APPROVAL, POLICY, USER
  subject_id: string; // Entity ID (UUID or identifier)
  version_no: number | null;
  payload_hash: string; // 64-character lowercase hex SHA-256
  content_commitment: string | null; // 64-character lowercase hex SHA-256 or null
  approval_signature: string | null; // Base64 Ed25519 signature or null
  prev_event_hash: string | null; // 64-character lowercase hex SHA-256 for Design B, or null
  metadata_hash: string; // 64-character lowercase hex SHA-256
}

export interface CreateEventParams {
  eventId: string;
  eventType: string;
  timestamp?: string | Date;
  actorId?: string | null;
  pseudonymSecretKey?: Buffer | string;
  actorPseudonym?: string | null;
  subjectType: string;
  subjectId: string;
  versionNo?: number | null;
  payload?: Record<string, unknown> | null;
  payloadHash?: string | null;
  contentCommitment?: string | null;
  approvalSignature?: string | null;
  prevEventHash?: string | null;
  metadata?: Record<string, unknown> | null;
  metadataHash?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_REGEX = /^[0-9a-f]{64}$/;

/**
 * Validates strict schema requirements, size limits, and cryptographic hash formats.
 */
export function validateCanonicalEvent(event: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Event must be a non-null object'] };
  }

  const e = event as Partial<CanonicalAuditEvent>;

  if (e.schema_version !== CURRENT_SCHEMA_VERSION) {
    errors.push(`schema_version must be "${CURRENT_SCHEMA_VERSION}", received "${e.schema_version}"`);
  }

  if (!e.event_id || !UUID_REGEX.test(e.event_id)) {
    errors.push(`event_id must be a valid UUID v4, received "${e.event_id}"`);
  }

  if (!e.event_type || typeof e.event_type !== 'string' || e.event_type.length > 64) {
    errors.push('event_type must be a string between 1 and 64 characters');
  }

  if (!e.timestamp || typeof e.timestamp !== 'string' || isNaN(Date.parse(e.timestamp))) {
    errors.push(`timestamp must be a valid ISO 8601 date string, received "${e.timestamp}"`);
  }

  if (e.actor_pseudonym !== null && (typeof e.actor_pseudonym !== 'string' || !HEX_64_REGEX.test(e.actor_pseudonym))) {
    errors.push('actor_pseudonym must be null or a 64-character lowercase hex string');
  }

  if (!e.subject_type || typeof e.subject_type !== 'string' || e.subject_type.length > 64) {
    errors.push('subject_type must be a string between 1 and 64 characters');
  }

  if (!e.subject_id || typeof e.subject_id !== 'string' || e.subject_id.length > 255) {
    errors.push('subject_id must be a string between 1 and 255 characters');
  }

  if (e.version_no !== null && (typeof e.version_no !== 'number' || !Number.isInteger(e.version_no) || e.version_no < 0)) {
    errors.push('version_no must be null or a non-negative integer');
  }

  if (!e.payload_hash || typeof e.payload_hash !== 'string' || !HEX_64_REGEX.test(e.payload_hash)) {
    errors.push('payload_hash must be a 64-character lowercase hex string');
  }

  if (e.content_commitment !== null && (typeof e.content_commitment !== 'string' || !HEX_64_REGEX.test(e.content_commitment))) {
    errors.push('content_commitment must be null or a 64-character lowercase hex string');
  }

  if (e.approval_signature !== null && (typeof e.approval_signature !== 'string' || e.approval_signature.length > 512)) {
    errors.push('approval_signature must be null or a base64 string under 512 characters');
  }

  if (e.prev_event_hash !== null && (typeof e.prev_event_hash !== 'string' || !HEX_64_REGEX.test(e.prev_event_hash))) {
    errors.push('prev_event_hash must be null or a 64-character lowercase hex string');
  }

  if (!e.metadata_hash || typeof e.metadata_hash !== 'string' || !HEX_64_REGEX.test(e.metadata_hash)) {
    errors.push('metadata_hash must be a 64-character lowercase hex string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constructs a fully normalized CanonicalAuditEvent with calculated hashes and pseudonym.
 */
export function createCanonicalEvent(params: CreateEventParams): CanonicalAuditEvent {
  const ts = params.timestamp
    ? typeof params.timestamp === 'string'
      ? new Date(params.timestamp).toISOString()
      : params.timestamp.toISOString()
    : new Date().toISOString();

  let pseudonym: string | null = null;
  if (params.actorPseudonym !== undefined) {
    pseudonym = params.actorPseudonym;
  } else if (params.actorId && params.pseudonymSecretKey) {
    pseudonym = computeActorPseudonym(params.actorId, params.pseudonymSecretKey);
  }

  const payloadHash = params.payloadHash
    ? params.payloadHash
    : params.payload
    ? hashCanonicalObject(params.payload)
    : sha256Hex(Buffer.from('{}', 'utf-8'));

  const metadataHash = params.metadataHash
    ? params.metadataHash
    : params.metadata
    ? hashCanonicalObject(params.metadata)
    : sha256Hex(Buffer.from('{}', 'utf-8'));

  const event: CanonicalAuditEvent = {
    schema_version: CURRENT_SCHEMA_VERSION,
    event_id: params.eventId,
    event_type: params.eventType,
    timestamp: ts,
    actor_pseudonym: pseudonym,
    subject_type: params.subjectType,
    subject_id: params.subjectId,
    version_no: params.versionNo ?? null,
    payload_hash: payloadHash.toLowerCase(),
    content_commitment: params.contentCommitment ? params.contentCommitment.toLowerCase() : null,
    approval_signature: params.approvalSignature || null,
    prev_event_hash: params.prevEventHash ? params.prevEventHash.toLowerCase() : null,
    metadata_hash: metadataHash.toLowerCase(),
  };

  const validation = validateCanonicalEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid canonical event: ${validation.errors.join('; ')}`);
  }

  return event;
}

/**
 * Computes deterministic SHA-256 hash of a CanonicalAuditEvent after RFC 8785 canonicalization.
 */
export function computeCanonicalEventHash(event: CanonicalAuditEvent): string {
  const canonicalBytes = Buffer.from(canonicalizeJson(event), 'utf-8');
  return sha256Hex(canonicalBytes);
}
