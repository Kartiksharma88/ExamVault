import {
  classifyQuestionState,
  BankOverviewBucket,
  ALL_QUESTION_STATUSES,
} from '../bank-buckets';

describe('Bank Overview State-to-Bucket Mapping (Section 5.A & Acceptance Criteria)', () => {
  it('covers all 12 QuestionStatusEnum states exhaustively', () => {
    expect(ALL_QUESTION_STATUSES.length).toBe(12);
  });

  it('maps DRAFT and CHANGES_REQUESTED to PENDING_EXAMINER', () => {
    expect(classifyQuestionState({ status: 'DRAFT' })).toBe(BankOverviewBucket.PENDING_EXAMINER);
    expect(classifyQuestionState({ status: 'CHANGES_REQUESTED' })).toBe(BankOverviewBucket.PENDING_EXAMINER);
  });

  it('maps SUBMITTED, SCREENING, READY_FOR_REVIEW, UNDER_REVIEW to PENDING_REVIEWER', () => {
    expect(classifyQuestionState({ status: 'SUBMITTED' })).toBe(BankOverviewBucket.PENDING_REVIEWER);
    expect(classifyQuestionState({ status: 'SCREENING' })).toBe(BankOverviewBucket.PENDING_REVIEWER);
    expect(classifyQuestionState({ status: 'READY_FOR_REVIEW' })).toBe(BankOverviewBucket.PENDING_REVIEWER);
    expect(classifyQuestionState({ status: 'UNDER_REVIEW' })).toBe(BankOverviewBucket.PENDING_REVIEWER);
  });

  it('maps MODERATION and DUPLICATE_FLAGGED with pending moderator action to PENDING_MODERATOR', () => {
    expect(classifyQuestionState({ status: 'MODERATION' })).toBe(BankOverviewBucket.PENDING_MODERATOR);
    expect(classifyQuestionState({ status: 'DUPLICATE_FLAGGED', hasPendingModeratorAction: true })).toBe(
      BankOverviewBucket.PENDING_MODERATOR,
    );
  });

  it('maps DUPLICATE_FLAGGED in screening review queue to PENDING_REVIEWER if awaiting screening resolution', () => {
    expect(classifyQuestionState({ status: 'DUPLICATE_FLAGGED', hasPendingModeratorAction: false })).toBe(
      BankOverviewBucket.PENDING_REVIEWER,
    );
  });

  it('maps APPROVED with isEligible=true to ELIGIBLE bucket', () => {
    expect(classifyQuestionState({ status: 'APPROVED', isEligible: true })).toBe(BankOverviewBucket.ELIGIBLE);
  });

  it('explicitly excludes APPROVED (not eligible), REJECTED, WITHDRAWN, RETIRED', () => {
    expect(classifyQuestionState({ status: 'APPROVED', isEligible: false })).toBe(BankOverviewBucket.EXCLUDED);
    expect(classifyQuestionState({ status: 'REJECTED' })).toBe(BankOverviewBucket.EXCLUDED);
    expect(classifyQuestionState({ status: 'WITHDRAWN' })).toBe(BankOverviewBucket.EXCLUDED);
    expect(classifyQuestionState({ status: 'RETIRED' })).toBe(BankOverviewBucket.EXCLUDED);
  });

  it('every possible status maps to exactly one bucket or EXCLUDED (never undefined)', () => {
    for (const status of ALL_QUESTION_STATUSES) {
      const result = classifyQuestionState({ status });
      expect(Object.values(BankOverviewBucket)).toContain(result);
    }
  });
});

