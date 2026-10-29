export declare const CURRENT_SCHEMA_VERSION = "1.0.0";
export interface CanonicalAuditEvent {
    schema_version: '1.0.0';
    event_id: string;
    event_type: string;
    timestamp: string;
    actor_pseudonym: string | null;
    subject_type: string;
    subject_id: string;
    version_no: number | null;
    payload_hash: string;
    content_commitment: string | null;
    approval_signature: string | null;
    prev_event_hash: string | null;
    metadata_hash: string;
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
/**
 * Validates strict schema requirements, size limits, and cryptographic hash formats.
 */
export declare function validateCanonicalEvent(event: unknown): {
    valid: boolean;
    errors: string[];
};
/**
 * Constructs a fully normalized CanonicalAuditEvent with calculated hashes and pseudonym.
 */
export declare function createCanonicalEvent(params: CreateEventParams): CanonicalAuditEvent;
/**
 * Computes deterministic SHA-256 hash of a CanonicalAuditEvent after RFC 8785 canonicalization.
 */
export declare function computeCanonicalEventHash(event: CanonicalAuditEvent): string;
//# sourceMappingURL=event-model.d.ts.map