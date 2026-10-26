import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────
export const UserRole = z.enum(['ADMIN', 'EXAMINER', 'REVIEWER', 'AUDITOR']);
export type UserRole = z.infer<typeof UserRole>;

export const QuestionType = z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER']);
export type QuestionType = z.infer<typeof QuestionType>;

// Step 1 active: DRAFT, SUBMITTED, WITHDRAWN
// Step 2 placeholders: UNDER_REVIEW, APPROVED, REJECTED, RETIRED
export const QuestionStatus = z.enum([
  'DRAFT',
  'SUBMITTED',
  'WITHDRAWN',
  'UNDER_REVIEW',  // TODO: Step 2 — review workflow
  'APPROVED',      // TODO: Step 2 — review workflow
  'REJECTED',      // TODO: Step 2 — review workflow
  'RETIRED',       // TODO: Step 2 — review workflow
]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

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
  // TODO: Step 2+ extension points
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
  difficulty: z.number().min(0).max(1),
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
