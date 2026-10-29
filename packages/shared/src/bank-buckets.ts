import { QuestionStatus } from './schemas';

export enum BankOverviewBucket {
  ELIGIBLE = 'ELIGIBLE',
  PENDING_REVIEWER = 'PENDING_REVIEWER',
  PENDING_MODERATOR = 'PENDING_MODERATOR',
  PENDING_EXAMINER = 'PENDING_EXAMINER',
  EXCLUDED = 'EXCLUDED',
}

export const ALL_QUESTION_STATUSES = [
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
] as const;

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
export function classifyQuestionState(input: ClassifyQuestionInput): BankOverviewBucket {
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
