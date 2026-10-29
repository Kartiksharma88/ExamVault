"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_SCHEMA_VERSION = void 0;
exports.validateCanonicalEvent = validateCanonicalEvent;
exports.createCanonicalEvent = createCanonicalEvent;
exports.computeCanonicalEventHash = computeCanonicalEventHash;
const canonicalize_js_1 = require("./canonicalize.js");
const hash_js_1 = require("./hash.js");
exports.CURRENT_SCHEMA_VERSION = '1.0.0';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_REGEX = /^[0-9a-f]{64}$/;
/**
 * Validates strict schema requirements, size limits, and cryptographic hash formats.
 */
function validateCanonicalEvent(event) {
    const errors = [];
    if (!event || typeof event !== 'object') {
        return { valid: false, errors: ['Event must be a non-null object'] };
    }
    const e = event;
    if (e.schema_version !== exports.CURRENT_SCHEMA_VERSION) {
        errors.push(`schema_version must be "${exports.CURRENT_SCHEMA_VERSION}", received "${e.schema_version}"`);
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
function createCanonicalEvent(params) {
    const ts = params.timestamp
        ? typeof params.timestamp === 'string'
            ? new Date(params.timestamp).toISOString()
            : params.timestamp.toISOString()
        : new Date().toISOString();
    let pseudonym = null;
    if (params.actorPseudonym !== undefined) {
        pseudonym = params.actorPseudonym;
    }
    else if (params.actorId && params.pseudonymSecretKey) {
        pseudonym = (0, hash_js_1.computeActorPseudonym)(params.actorId, params.pseudonymSecretKey);
    }
    const payloadHash = params.payloadHash
        ? params.payloadHash
        : params.payload
            ? (0, hash_js_1.hashCanonicalObject)(params.payload)
            : (0, hash_js_1.sha256Hex)(Buffer.from('{}', 'utf-8'));
    const metadataHash = params.metadataHash
        ? params.metadataHash
        : params.metadata
            ? (0, hash_js_1.hashCanonicalObject)(params.metadata)
            : (0, hash_js_1.sha256Hex)(Buffer.from('{}', 'utf-8'));
    const event = {
        schema_version: exports.CURRENT_SCHEMA_VERSION,
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
function computeCanonicalEventHash(event) {
    const canonicalBytes = Buffer.from((0, canonicalize_js_1.canonicalizeJson)(event), 'utf-8');
    return (0, hash_js_1.sha256Hex)(canonicalBytes);
}
//# sourceMappingURL=event-model.js.map