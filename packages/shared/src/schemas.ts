import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────
export const UserRole = z.enum(['ADMIN', 'EXAMINER', 'REVIEWER', 'AUDITOR', 'MODERATOR', 'CUSTODIAN']);
export type UserRole = z.infer<typeof UserRole>;

export const QuestionType = z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER']);
export type QuestionType = z.infer<typeof QuestionType>;

export const QuestionStatus = z.enum([
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
]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const DuplicateDisposition = z.enum([
  'CONFIRMED_DUPLICATE',
  'NOT_DUPLICATE',
  'SIMILAR_ALLOWED',
]);
export type DuplicateDisposition = z.infer<typeof DuplicateDisposition>;

export const ReviewDecision = z.enum([
  'APPROVE',
  'REQUEST_CHANGES',
  'REJECT',
]);
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const OriginalityRiskLevel = z.enum([
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'EXACT',
]);
export type OriginalityRiskLevel = z.infer<typeof OriginalityRiskLevel>;

export const OriginalitySourceType = z.enum([
  'BANK',
  'PAST_PAPER',
  'PUBLIC',
]);
export type OriginalitySourceType = z.infer<typeof OriginalitySourceType>;

export const RetirementReason = z.enum([
  'SUPERSEDED',
  'OUTDATED_SYLLABUS',
  'ERRONEOUS_CONTENT',
  'OTHER',
]);
export type RetirementReason = z.infer<typeof RetirementReason>;

export const CognitiveLevel = z.enum([
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYZE',
  'EVALUATE',
  'CREATE',
]);
export type CognitiveLevel = z.infer<typeof CognitiveLevel>;

export const Language = z.enum(['EN', 'HI', 'BILINGUAL']);
export type Language = z.infer<typeof Language>;

export const AuditAction = z.enum([
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'MFA_SETUP',
  'MFA_VERIFY',
  'MFA_FAILURE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'ROLE_CHANGE',
  'SYLLABUS_CREATE',
  'SYLLABUS_UPDATE',
  'SYLLABUS_DELETE',
  'QUESTION_CREATE',
  'QUESTION_EDIT',
  'QUESTION_SUBMIT',
  'QUESTION_WITHDRAW',
  'QUESTION_READ',
  'QUESTION_CONTENT_READ',
  'IMPORT_START',
  'IMPORT_SUCCESS',
  'IMPORT_FAILURE',
  'ACCESS_DENIED',
  // Step 2 actions:
  'SCREENING_START',
  'SCREENING_COMPLETE',
  'DUPLICATE_FLAGGED',
  'DUPLICATE_DISPOSITION',
  'REVIEWER_ASSIGNMENT',
  'BLIND_ANSWER_SUBMIT',
  'KEY_REVEAL',
  'REVIEW_DECISION',
  'DISAGREEMENT_RAISED',
  'DISAGREEMENT_RESOLVED',
  'MODERATOR_DECISION',
  'APPROVAL_SIGNED',
  'NEW_VERSION_CREATE',
  'VERSION_SUPERSEDED',
  'VERSION_RETIRED',
  'POLICY_PROPOSE',
  'POLICY_APPROVE',
  'CONFLICT_UPDATE',
  'STEP_UP_MFA_SUCCESS',
  'STEP_UP_MFA_FAILURE',
  'ORIGINALITY_SERVICE_FAILURE',
  'REVIEW_COMMENT_READ',
  'REVIEW_REASSIGN',
  // Step 3+ placeholders:
  'QUESTION_REVIEW_START',
  'QUESTION_APPROVE',
  'QUESTION_REJECT',
  'PAPER_GENERATE',
  'KEY_RELEASE',
]);
export type AuditAction = z.infer<typeof AuditAction>;

// ── User Schemas ───────────────────────────────────────────────────
export const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  role: UserRole,
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Password must contain uppercase, lowercase, digit, and special character'
    ),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: UserRole.optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const MfaVerifySchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/),
});
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

// ── User Response ──────────────────────────────────────────────────
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRole,
  mfaEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

// ── Syllabus Schemas ───────────────────────────────────────────────
export const CreateExamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});
export type CreateExamInput = z.infer<typeof CreateExamSchema>;

export const CreateSubjectSchema = z.object({
  examId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z]{2,10}$/, 'Code must be 2-10 uppercase letters'),
});
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;

export const CreateTopicSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().min(1).max(255),
});
export type CreateTopicInput = z.infer<typeof CreateTopicSchema>;

export const CreateSubtopicSchema = z.object({
  topicId: z.string().uuid(),
  name: z.string().min(1).max(255),
});
export type CreateSubtopicInput = z.infer<typeof CreateSubtopicSchema>;

// ── Question Option Schema ─────────────────────────────────────────
export const QuestionOptionSchema = z.object({
  label: z.string().min(1).max(1), // A, B, C, D, etc.
  text: z.string().min(1).max(5000), // Markdown + LaTeX
  imageId: z.string().uuid().optional(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

// ── Question Content (encrypted at rest) ───────────────────────────
export const QuestionContentSchema = z.object({
  type: QuestionType,
  stem: z.string().min(1).max(10000), // Markdown + LaTeX, supports Unicode/Devanagari
  options: z.array(QuestionOptionSchema).min(2).max(8).optional(), // Required for MCQ types
  imageIds: z.array(z.string().uuid()).max(5).optional(),
  solution: z.string().max(10000).optional(),
  language: Language.default('EN'),
});
export type QuestionContent = z.infer<typeof QuestionContentSchema>;

// ── Answer Key (encrypted separately) ──────────────────────────────
export const AnswerKeySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MCQ_SINGLE'),
    correct: z.string().min(1).max(1), // e.g., "B"
  }),
  z.object({
    type: z.literal('MCQ_MULTI'),
    correct: z.array(z.string().min(1).max(1)).min(1).max(8), // e.g., ["A", "C"]
  }),
  z.object({
    type: z.literal('INTEGER'),
    correct: z.number().int(),
    tolerance: z.number().min(0).default(0),
  }),
]);
export type AnswerKey = z.infer<typeof AnswerKeySchema>;

// ── Question Metadata (unencrypted, used for filtering) ────────────
export const QuestionMetadataSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  subtopicId: z.string().uuid().optional(),
  type: QuestionType,
  difficulty: z.number().min(0).max(100),
  cognitiveLevel: CognitiveLevel,
  marks: z.number().positive(),
  negativeMarks: z.number().min(0).default(0),
  estimatedTimeSeconds: z.number().positive().int(),
  language: Language.default('EN'),
});
export type QuestionMetadata = z.infer<typeof QuestionMetadataSchema>;

// ── Create/Update Question ─────────────────────────────────────────
export const CreateQuestionSchema = z.object({
  content: QuestionContentSchema,
  answerKey: AnswerKeySchema,
  metadata: QuestionMetadataSchema,
});
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = CreateQuestionSchema;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

// ── Question Response (metadata only for non-owners/ADMIN/AUDITOR) ─
export const QuestionMetadataResponseSchema = z.object({
  id: z.string().uuid(),
  humanId: z.string(),
  authorId: z.string().uuid(),
  authorName: z.string().optional(),
  status: QuestionStatus,
  currentVersion: z.number().int(),
  metadata: QuestionMetadataSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuestionMetadataResponse = z.infer<typeof QuestionMetadataResponseSchema>;

export const QuestionFullResponseSchema = QuestionMetadataResponseSchema.extend({
  content: QuestionContentSchema,
  answerKey: AnswerKeySchema,
});
export type QuestionFullResponse = z.infer<typeof QuestionFullResponseSchema>;

export const QuestionVersionResponseSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  versionNo: z.number().int(),
  status: QuestionStatus,
  contentCommitment: z.string(),
  createdAt: z.string().datetime(),
});
export type QuestionVersionResponse = z.infer<typeof QuestionVersionResponseSchema>;

// ── CSV Import ─────────────────────────────────────────────────────
export const CsvImportRowSchema = z.object({
  type: QuestionType,
  stem: z.string().min(1),
  optionA: z.string().optional(),
  optionB: z.string().optional(),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  correctAnswer: z.string().min(1),
  solution: z.string().optional(),
  subjectCode: z.string().min(2).max(10),
  topicName: z.string().optional(),
  difficulty: z.coerce.number().min(0).max(1),
  cognitiveLevel: CognitiveLevel,
  marks: z.coerce.number().positive(),
  negativeMarks: z.coerce.number().min(0).default(0),
  estimatedTimeSeconds: z.coerce.number().positive().int(),
  language: Language.default('EN'),
});
export type CsvImportRow = z.infer<typeof CsvImportRowSchema>;

export const CsvImportResultSchema = z.object({
  success: z.boolean(),
  totalRows: z.number().int(),
  importedCount: z.number().int(),
  errors: z.array(
    z.object({
      row: z.number().int(),
      field: z.string(),
      message: z.string(),
    })
  ),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;

// ── Audit Log ──────────────────────────────────────────────────────
export const AuditEventResponseSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  actorId: z.string().uuid().nullable(),
  actorEmail: z.string().optional(),
  action: AuditAction,
  targetType: z.string(),
  targetId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  entryHash: z.string(),
  prevHash: z.string(),
  signature: z.string(),
});
export type AuditEventResponse = z.infer<typeof AuditEventResponseSchema>;

export const AuditVerifyResponseSchema = z.object({
  valid: z.boolean(),
  totalEntries: z.number().int(),
  verifiedEntries: z.number().int(),
  firstBrokenEntry: z
    .object({
      id: z.string().uuid(),
      index: z.number().int(),
      expectedHash: z.string(),
      actualHash: z.string(),
    })
    .optional(),
});
export type AuditVerifyResponse = z.infer<typeof AuditVerifyResponseSchema>;

// ── Audit Log Filter ───────────────────────────────────────────────
export const AuditFilterSchema = z.object({
  action: AuditAction.optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AuditFilter = z.infer<typeof AuditFilterSchema>;

// ── Dashboard Statistics ───────────────────────────────────────────
export const BankStatisticsSchema = z.object({
  totalQuestions: z.number().int(),
  byStatus: z.record(QuestionStatus, z.number().int()),
  bySubject: z.array(
    z.object({
      subjectId: z.string().uuid(),
      subjectName: z.string(),
      count: z.number().int(),
    })
  ),
  byDifficultyBucket: z.array(
    z.object({
      bucket: z.string(),
      count: z.number().int(),
    })
  ),
  byType: z.record(QuestionType, z.number().int()),
});
export type BankStatistics = z.infer<typeof BankStatisticsSchema>;

// ── Pagination ─────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  });

// ── API Response Wrapper ───────────────────────────────────────────
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .optional(),
  });

// ── Step 2: Approval Policy Schemas ────────────────────────────────
export const ApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  examId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  questionType: QuestionType.nullable().optional(),
  version: z.number().int().positive(),
  requiredReviewers: z.number().int().min(1).default(2),
  requireBlindSolve: z.boolean().default(true),
  requireModerator: z.boolean().default(true),
  requireLanguageReview: z.boolean().default(true),
  maxReviewDays: z.number().int().min(1).default(7),
  difficultyTolerance: z.number().default(20),
  exactMatchThreshold: z.number().min(0).max(1).default(1.0),
  highSimilarityThreshold: z.number().min(0).max(1).default(0.85),
  mediumSimilarityThreshold: z.number().min(0).max(1).default(0.60),
  effectiveFrom: z.string().datetime(),
  proposedById: z.string().uuid(),
  approvedById: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const ProposePolicySchema = z.object({
  examId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  questionType: QuestionType.optional(),
  requiredReviewers: z.number().int().min(1).default(2),
  requireBlindSolve: z.boolean().default(true),
  requireModerator: z.boolean().default(true),
  requireLanguageReview: z.boolean().default(true),
  maxReviewDays: z.number().int().min(1).default(7),
  difficultyTolerance: z.number().min(0).max(100).default(20),
  exactMatchThreshold: z.number().min(0).max(1).default(1.0),
  highSimilarityThreshold: z.number().min(0).max(1).default(0.85),
  mediumSimilarityThreshold: z.number().min(0).max(1).default(0.60),
});
export type ProposePolicyInput = z.infer<typeof ProposePolicySchema>;

export const ApprovePolicySchema = z.object({
  policyId: z.string().uuid(),
});
export type ApprovePolicyInput = z.infer<typeof ApprovePolicySchema>;

export const QuickConfigurePolicySchema = z.object({
  subjectId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  requiredReviewers: z.number().int().min(1).max(5).default(2),
  difficultyTolerance: z.number().min(0).max(100).default(20),
});
export type QuickConfigurePolicyInput = z.infer<typeof QuickConfigurePolicySchema>;

// ── Step 2: Reviewer Schemas (Blind Solve & Checklist) ─────────────
export const BlindAnswerSubmitSchema = z.object({
  blindAnswer: z.union([z.string(), z.array(z.string()), z.number()]),
  timeTakenSeconds: z.number().int().positive(),
  difficultyRating: z.number().min(0).max(100),
});
export type BlindAnswerSubmitInput = z.infer<typeof BlindAnswerSubmitSchema>;

export const ReviewChecklistSchema = z.object({
  contentAccuracy: z.boolean(),
  singleDefensibleAnswer: z.boolean(),
  clarityAndWording: z.boolean(),
  distractorPlausibility: z.boolean(),
  syllabusTopicAlignment: z.boolean(),
  difficultyAppropriate: z.boolean(),
  languageEquivalence: z.boolean().optional(),
  biasAndSensitivity: z.boolean(),
  formattingMathRendering: z.boolean(),
});
export type ReviewChecklist = z.infer<typeof ReviewChecklistSchema>;

export const ReviewSubmitSchema = z.object({
  decision: ReviewDecision,
  checklist: ReviewChecklistSchema,
  comments: z.string().min(1).max(5000),
  totpToken: z.string().length(6).regex(/^\d{6}$/),
});
export type ReviewSubmitInput = z.infer<typeof ReviewSubmitSchema>;

// ── Step 2: Moderator Schemas ──────────────────────────────────────
export const DuplicateDispositionSchema = z.object({
  disposition: DuplicateDisposition,
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(5000),
});
export type DuplicateDispositionInput = z.infer<typeof DuplicateDispositionSchema>;

export const ModeratorDecisionSchema = z.object({
  decision: ReviewDecision,
  comments: z.string().max(5000).optional().default(''),
  totpToken: z.string().length(6).regex(/^\d{6}$/),
});
export type ModeratorDecisionInput = z.infer<typeof ModeratorDecisionSchema>;

export const ReassignReviewerSchema = z.object({
  assignmentId: z.string().uuid(),
  newReviewerId: z.string().uuid(),
  reason: z.string().min(5).max(1000),
});
export type ReassignReviewerInput = z.infer<typeof ReassignReviewerSchema>;

export const RetireQuestionSchema = z.object({
  reason: RetirementReason,
  note: z.string().min(5).max(1000),
});
export type RetireQuestionInput = z.infer<typeof RetireQuestionSchema>;

export const DifficultyResolutionAction = z.enum([
  'ACCEPT_MEAN',
  'SET_FINAL_VALUE',
  'REQUEST_THIRD_REVIEW',
  'REQUEST_CHANGES',
]);
export type DifficultyResolutionAction = z.infer<typeof DifficultyResolutionAction>;

export const ResolveDifficultyConflictSchema = z.object({
  action: DifficultyResolutionAction,
  customValue: z.number().min(0).max(100).optional(),
  customTimingSeconds: z.number().int().positive().optional(),
  autoApprove: z.boolean().optional(),
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(5000),
});
export type ResolveDifficultyConflictInput = z.infer<typeof ResolveDifficultyConflictSchema>;

// ── Step 2: Author Revision & Feedback ─────────────────────────────
export const CreateNewVersionSchema = z.object({
  parentVersionId: z.string().uuid(),
  changeJustification: z.string().min(15, 'Change justification must be at least 15 characters').max(5000),
  content: QuestionContentSchema,
  answerKey: AnswerKeySchema,
  metadata: QuestionMetadataSchema,
});
export type CreateNewVersionInput = z.infer<typeof CreateNewVersionSchema>;

// ── Step 2: Conflict Declarations ──────────────────────────────────
export const ConflictDeclarationSchema = z.object({
  conflictType: z.enum(['INSTITUTION', 'COACHING_CENTRE', 'PERSON', 'SOURCE']),
  description: z.string().min(2).max(1000),
});
export type ConflictDeclarationInput = z.infer<typeof ConflictDeclarationSchema>;

// ── Step 2: Corpus Import ──────────────────────────────────────────
export const CorpusImportSchema = z.object({
  name: z.string().min(2).max(255),
  sourceType: z.enum(['PAST_PAPER', 'PUBLIC']),
  licenseNote: z.string().max(1000).optional(),
  documents: z.array(
    z.object({
      title: z.string().min(1).max(255),
      identifier: z.string().min(1).max(100),
      content: z.string().min(1),
    })
  ).min(1),
});
export type CorpusImportInput = z.infer<typeof CorpusImportSchema>;

// ── Step 2: Signed Approval Verification ───────────────────────────
export const ApprovalRecordSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  versionNo: z.number().int(),
  contentCommitment: z.string(),
  decision: z.string(),
  role: z.string(),
  approverId: z.string().uuid(),
  reviewRound: z.number().int(),
  policyVersion: z.number().int(),
  timestamp: z.string().datetime(),
  signature: z.string(),
  validSignature: z.boolean(),
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const ApprovalVerificationResponseSchema = z.object({
  questionId: z.string().uuid(),
  versionNo: z.number().int(),
  contentCommitment: z.string(),
  approvals: z.array(ApprovalRecordSchema),
  allSignaturesValid: z.boolean(),
  meetsPolicyRequirements: z.boolean(),
  isEligible: z.boolean(),
});
export type ApprovalVerificationResponse = z.infer<typeof ApprovalVerificationResponseSchema>;

// ── Step 4: Eligible Questions Feed (Metadata Only) ────────────────
export const EligibleQuestionSchema = z.object({
  questionId: z.string().uuid(),
  versionId: z.string().uuid(),
  humanId: z.string(),
  versionNo: z.number().int(),
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().nullable().optional(),
  type: QuestionType,
  difficulty: z.number(),
  marks: z.number(),
  negativeMarks: z.number(),
  contentCommitment: z.string(),
  approvedAt: z.string().datetime(),
});
export type EligibleQuestion = z.infer<typeof EligibleQuestionSchema>;

