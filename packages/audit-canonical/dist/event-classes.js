"use strict";
/**
 * Classification of Audit Event Types:
 * - CRITICAL: Anchored individually to Hyperledger Fabric & immediate witness checkpoint
 * - BULK: Batched into Merkle trees before checkpoint anchoring
 *
 * Configurable dynamically, with standard defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventClassifier = exports.DEFAULT_BULK_EVENT_TYPES = exports.DEFAULT_CRITICAL_EVENT_TYPES = void 0;
exports.isCriticalEvent = isCriticalEvent;
exports.DEFAULT_CRITICAL_EVENT_TYPES = [
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
];
exports.DEFAULT_BULK_EVENT_TYPES = [
    'CONTENT_READ',
    'USER_LOGIN',
    'USER_FAILED_LOGIN',
    'MFA_STEPUP_VERIFIED',
    'STORAGE_SCAN_COMPLETED',
    'STORAGE_CORRUPTION_DETECTED',
    'CONFLICT_DECLARED',
    'ASSIGNMENT_CREATED',
];
class EventClassifier {
    criticalSet;
    bulkSet;
    constructor(customCritical, customBulk) {
        this.criticalSet = new Set(customCritical || exports.DEFAULT_CRITICAL_EVENT_TYPES);
        this.bulkSet = new Set(customBulk || exports.DEFAULT_BULK_EVENT_TYPES);
    }
    classify(eventType) {
        if (this.criticalSet.has(eventType)) {
            return 'CRITICAL';
        }
        if (this.bulkSet.has(eventType)) {
            return 'BULK';
        }
        // Default unconfigured event types to CRITICAL for conservative security
        return 'CRITICAL';
    }
    setEventClass(eventType, eventClass) {
        if (eventClass === 'CRITICAL') {
            this.bulkSet.delete(eventType);
            this.criticalSet.add(eventType);
        }
        else {
            this.criticalSet.delete(eventType);
            this.bulkSet.add(eventType);
        }
    }
    getCriticalTypes() {
        return Array.from(this.criticalSet);
    }
    getBulkTypes() {
        return Array.from(this.bulkSet);
    }
}
exports.EventClassifier = EventClassifier;
function isCriticalEvent(eventType) {
    return new EventClassifier().classify(eventType) === 'CRITICAL';
}
//# sourceMappingURL=event-classes.js.map