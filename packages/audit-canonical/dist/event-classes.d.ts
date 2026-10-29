/**
 * Classification of Audit Event Types:
 * - CRITICAL: Anchored individually to Hyperledger Fabric & immediate witness checkpoint
 * - BULK: Batched into Merkle trees before checkpoint anchoring
 *
 * Configurable dynamically, with standard defaults.
 */
export type EventClass = 'CRITICAL' | 'BULK';
export declare const DEFAULT_CRITICAL_EVENT_TYPES: readonly ["QUESTION_VERSION_COMMITTED", "APPROVAL_SIGNED", "REVIEW_DECISION", "MODERATOR_DECISION", "QUESTION_CREATE", "QUESTION_EDIT", "QUESTION_SUBMIT", "VERSION_RETIRED", "VERSION_SUPERSEDED", "POLICY_APPROVED", "USER_ROLE_CHANGED", "PAPER_GENERATED", "PAPER_HASH_COMMITTED", "KEY_SHARE_SUBMITTED", "PAPER_RELEASED"];
export declare const DEFAULT_BULK_EVENT_TYPES: readonly ["CONTENT_READ", "USER_LOGIN", "USER_FAILED_LOGIN", "MFA_STEPUP_VERIFIED", "STORAGE_SCAN_COMPLETED", "STORAGE_CORRUPTION_DETECTED", "CONFLICT_DECLARED", "ASSIGNMENT_CREATED"];
export type CriticalEventType = (typeof DEFAULT_CRITICAL_EVENT_TYPES)[number];
export type BulkEventType = (typeof DEFAULT_BULK_EVENT_TYPES)[number];
export type StandardEventType = CriticalEventType | BulkEventType | string;
export declare class EventClassifier {
    private criticalSet;
    private bulkSet;
    constructor(customCritical?: string[], customBulk?: string[]);
    classify(eventType: string): EventClass;
    setEventClass(eventType: string, eventClass: EventClass): void;
    getCriticalTypes(): string[];
    getBulkTypes(): string[];
}
export declare function isCriticalEvent(eventType: string): boolean;
//# sourceMappingURL=event-classes.d.ts.map