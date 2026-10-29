"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bank_buckets_1 = require("../bank-buckets");
describe('Bank Overview State-to-Bucket Mapping (Section 5.A & Acceptance Criteria)', () => {
    it('covers all 12 QuestionStatusEnum states exhaustively', () => {
        expect(bank_buckets_1.ALL_QUESTION_STATUSES.length).toBe(12);
    });
    it('maps DRAFT and CHANGES_REQUESTED to PENDING_EXAMINER', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'DRAFT' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_EXAMINER);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'CHANGES_REQUESTED' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_EXAMINER);
    });
    it('maps SUBMITTED, SCREENING, READY_FOR_REVIEW, UNDER_REVIEW to PENDING_REVIEWER', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'SUBMITTED' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_REVIEWER);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'SCREENING' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_REVIEWER);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'READY_FOR_REVIEW' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_REVIEWER);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'UNDER_REVIEW' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_REVIEWER);
    });
    it('maps MODERATION and DUPLICATE_FLAGGED with pending moderator action to PENDING_MODERATOR', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'MODERATION' })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_MODERATOR);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'DUPLICATE_FLAGGED', hasPendingModeratorAction: true })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_MODERATOR);
    });
    it('maps DUPLICATE_FLAGGED in screening review queue to PENDING_REVIEWER if awaiting screening resolution', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'DUPLICATE_FLAGGED', hasPendingModeratorAction: false })).toBe(bank_buckets_1.BankOverviewBucket.PENDING_REVIEWER);
    });
    it('maps APPROVED with isEligible=true to ELIGIBLE bucket', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'APPROVED', isEligible: true })).toBe(bank_buckets_1.BankOverviewBucket.ELIGIBLE);
    });
    it('explicitly excludes APPROVED (not eligible), REJECTED, WITHDRAWN, RETIRED', () => {
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'APPROVED', isEligible: false })).toBe(bank_buckets_1.BankOverviewBucket.EXCLUDED);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'REJECTED' })).toBe(bank_buckets_1.BankOverviewBucket.EXCLUDED);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'WITHDRAWN' })).toBe(bank_buckets_1.BankOverviewBucket.EXCLUDED);
        expect((0, bank_buckets_1.classifyQuestionState)({ status: 'RETIRED' })).toBe(bank_buckets_1.BankOverviewBucket.EXCLUDED);
    });
    it('every possible status maps to exactly one bucket or EXCLUDED (never undefined)', () => {
        for (const status of bank_buckets_1.ALL_QUESTION_STATUSES) {
            const result = (0, bank_buckets_1.classifyQuestionState)({ status });
            expect(Object.values(bank_buckets_1.BankOverviewBucket)).toContain(result);
        }
    });
});
//# sourceMappingURL=bank-buckets.spec.js.map