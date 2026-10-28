/**
 * Classification of Audit Event Types:
 * - CRITICAL: Anchored individually to Hyperledger Fabric & immediate witness checkpoint
 * - BULK: Batched into Merkle trees before checkpoint anchoring
 *
 * Configurable dynamically, with standard defaults.
 */

export type EventClass = 'CRITICAL' | 'BULK';

export const DEFAULT_CRITICAL_EVENT_TYPES = [
  'QUESTION_VERSION_COMMITTED',
  'APPROVAL_SIGNED',
  'REVIEW_DECISION',
  'MODERATOR_DECISION',
  'QUESTION_CREATE',
  'QUESTION_EDIT',
  'QUESTION_SUBMIT',
  'VERSION_RETIRED',
  'VERSION_SUPERSEDED',
  'POLICY_APPROVED',
  'USER_ROLE_CHANGED',
  // Reserved for Steps 4 - 6
  'PAPER_GENERATED',
  'PAPER_HASH_COMMITTED',
  'KEY_SHARE_SUBMITTED',
  'PAPER_RELEASED',
] as const;

export const DEFAULT_BULK_EVENT_TYPES = [
  'CONTENT_READ',
  'USER_LOGIN',
  'USER_FAILED_LOGIN',
  'MFA_STEPUP_VERIFIED',
  'STORAGE_SCAN_COMPLETED',
  'STORAGE_CORRUPTION_DETECTED',
  'CONFLICT_DECLARED',
  'ASSIGNMENT_CREATED',
] as const;

export type CriticalEventType = (typeof DEFAULT_CRITICAL_EVENT_TYPES)[number];
export type BulkEventType = (typeof DEFAULT_BULK_EVENT_TYPES)[number];
export type StandardEventType = CriticalEventType | BulkEventType | string;

export class EventClassifier {
  private criticalSet: Set<string>;
  private bulkSet: Set<string>;

  constructor(
    customCritical?: string[],
    customBulk?: string[],
  ) {
    this.criticalSet = new Set(customCritical || DEFAULT_CRITICAL_EVENT_TYPES);
    this.bulkSet = new Set(customBulk || DEFAULT_BULK_EVENT_TYPES);
  }

  public classify(eventType: string): EventClass {
    if (this.criticalSet.has(eventType)) {
      return 'CRITICAL';
    }
    if (this.bulkSet.has(eventType)) {
      return 'BULK';
    }
    // Default unconfigured event types to CRITICAL for conservative security
    return 'CRITICAL';
  }

  public setEventClass(eventType: string, eventClass: EventClass): void {
    if (eventClass === 'CRITICAL') {
      this.bulkSet.delete(eventType);
      this.criticalSet.add(eventType);
    } else {
      this.criticalSet.delete(eventType);
      this.bulkSet.add(eventType);
    }
  }

  public getCriticalTypes(): string[] {
    return Array.from(this.criticalSet);
  }

  public getBulkTypes(): string[] {
    return Array.from(this.bulkSet);
  }
}

export function isCriticalEvent(eventType: string): boolean {
  return new EventClassifier().classify(eventType) === 'CRITICAL';
}
