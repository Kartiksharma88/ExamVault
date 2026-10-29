"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_QUESTION_STATUSES = exports.BankOverviewBucket = void 0;
exports.classifyQuestionState = classifyQuestionState;
var BankOverviewBucket;
(function (BankOverviewBucket) {
    BankOverviewBucket["ELIGIBLE"] = "ELIGIBLE";
    BankOverviewBucket["PENDING_REVIEWER"] = "PENDING_REVIEWER";
    BankOverviewBucket["PENDING_MODERATOR"] = "PENDING_MODERATOR";
    BankOverviewBucket["PENDING_EXAMINER"] = "PENDING_EXAMINER";
    BankOverviewBucket["EXCLUDED"] = "EXCLUDED";
})(BankOverviewBucket || (exports.BankOverviewBucket = BankOverviewBucket = {}));
exports.ALL_QUESTION_STATUSES = [
    'DRAFT',
    'SUBMITTED',
    'SCREENING',
    'DUPLICATE_FLAGGED',
    'READY_FOR_REVIEW',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'MODERATION',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
    'RETIRED',
];
/**
 * Classifies a question version into one of the 4 Bank Overview buckets or marks it explicitly EXCLUDED.
 *
 * Requirements:
 * 1. Question bank (eligible): versions in eligible_question_versions.
 * 2. Pending reviewer review: SUBMITTED, SCREENING, READY_FOR_REVIEW, UNDER_REVIEW, DUPLICATE_FLAGGED (awaiting screening/review).
 * 3. Pending moderator review: MODERATION or DUPLICATE_FLAGGED awaiting a moderator decision.
 * 4. Pending examiner submission: DRAFT or CHANGES_REQUESTED.
 *
 * Explicitly excluded: APPROVED but not eligible, REJECTED, WITHDRAWN, RETIRED.
 */
function classifyQuestionState(input) {
    const { status, isEligible = false, hasPendingModeratorAction = false } = input;
    switch (status) {
        case 'APPROVED':
            return isEligible ? BankOverviewBucket.ELIGIBLE : BankOverviewBucket.EXCLUDED;
        case 'DRAFT':
        case 'CHANGES_REQUESTED':
            return BankOverviewBucket.PENDING_EXAMINER;
        case 'MODERATION':
            return BankOverviewBucket.PENDING_MODERATOR;
        case 'DUPLICATE_FLAGGED':
            return hasPendingModeratorAction
                ? BankOverviewBucket.PENDING_MODERATOR
                : BankOverviewBucket.PENDING_REVIEWER;
        case 'SUBMITTED':
        case 'SCREENING':
        case 'READY_FOR_REVIEW':
        case 'UNDER_REVIEW':
            return BankOverviewBucket.PENDING_REVIEWER;
        case 'REJECTED':
        case 'WITHDRAWN':
        case 'RETIRED':
            return BankOverviewBucket.EXCLUDED;
        default:
            return BankOverviewBucket.EXCLUDED;
    }
}
//# sourceMappingURL=bank-buckets.js.map