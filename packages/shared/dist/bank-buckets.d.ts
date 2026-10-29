import { QuestionStatus } from './schemas';
export declare enum BankOverviewBucket {
    ELIGIBLE = "ELIGIBLE",
    PENDING_REVIEWER = "PENDING_REVIEWER",
    PENDING_MODERATOR = "PENDING_MODERATOR",
    PENDING_EXAMINER = "PENDING_EXAMINER",
    EXCLUDED = "EXCLUDED"
}
export declare const ALL_QUESTION_STATUSES: readonly ["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"];
export interface ClassifyQuestionInput {
    status: QuestionStatus | string;
    isEligible?: boolean;
    hasPendingModeratorAction?: boolean;
}
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
export declare function classifyQuestionState(input: ClassifyQuestionInput): BankOverviewBucket;
//# sourceMappingURL=bank-buckets.d.ts.map