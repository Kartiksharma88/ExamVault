"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifficultyResolutionAction = exports.RetireQuestionSchema = exports.ReassignReviewerSchema = exports.ModeratorDecisionSchema = exports.DuplicateDispositionSchema = exports.ReviewSubmitSchema = exports.ReviewChecklistSchema = exports.BlindAnswerSubmitSchema = exports.QuickConfigurePolicySchema = exports.ApprovePolicySchema = exports.ProposePolicySchema = exports.ApprovalPolicySchema = exports.ApiResponseSchema = exports.PaginatedResponseSchema = exports.PaginationSchema = exports.BankStatisticsSchema = exports.AuditFilterSchema = exports.AuditVerifyResponseSchema = exports.AuditEventResponseSchema = exports.CsvImportResultSchema = exports.CsvImportRowSchema = exports.QuestionVersionResponseSchema = exports.QuestionFullResponseSchema = exports.QuestionMetadataResponseSchema = exports.UpdateQuestionSchema = exports.CreateQuestionSchema = exports.QuestionMetadataSchema = exports.AnswerKeySchema = exports.QuestionContentSchema = exports.QuestionOptionSchema = exports.CreateSubtopicSchema = exports.CreateTopicSchema = exports.CreateSubjectSchema = exports.CreateExamSchema = exports.UserResponseSchema = exports.MfaVerifySchema = exports.LoginSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.AuditAction = exports.Language = exports.CognitiveLevel = exports.RetirementReason = exports.OriginalitySourceType = exports.OriginalityRiskLevel = exports.ReviewDecision = exports.DuplicateDisposition = exports.QuestionStatus = exports.QuestionType = exports.UserRole = void 0;
exports.EligibleQuestionSchema = exports.ApprovalVerificationResponseSchema = exports.ApprovalRecordSchema = exports.CorpusImportSchema = exports.ConflictDeclarationSchema = exports.CreateNewVersionSchema = exports.ResolveDifficultyConflictSchema = void 0;
const zod_1 = require("zod");
// ── Enums ──────────────────────────────────────────────────────────
exports.UserRole = zod_1.z.enum(['ADMIN', 'EXAMINER', 'REVIEWER', 'AUDITOR', 'MODERATOR', 'CUSTODIAN']);
exports.QuestionType = zod_1.z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER']);
exports.QuestionStatus = zod_1.z.enum([
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
exports.DuplicateDisposition = zod_1.z.enum([
    'CONFIRMED_DUPLICATE',
    'NOT_DUPLICATE',
    'SIMILAR_ALLOWED',
]);
exports.ReviewDecision = zod_1.z.enum([
    'APPROVE',
    'REQUEST_CHANGES',
    'REJECT',
]);
exports.OriginalityRiskLevel = zod_1.z.enum([
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'EXACT',
]);
exports.OriginalitySourceType = zod_1.z.enum([
    'BANK',
    'PAST_PAPER',
    'PUBLIC',
]);
exports.RetirementReason = zod_1.z.enum([
    'SUPERSEDED',
    'OUTDATED_SYLLABUS',
    'ERRONEOUS_CONTENT',
    'OTHER',
]);
exports.CognitiveLevel = zod_1.z.enum([
    'REMEMBER',
    'UNDERSTAND',
    'APPLY',
    'ANALYZE',
    'EVALUATE',
    'CREATE',
]);
exports.Language = zod_1.z.enum(['EN', 'HI', 'BILINGUAL']);
exports.AuditAction = zod_1.z.enum([
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
// ── User Schemas ───────────────────────────────────────────────────
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    name: zod_1.z.string().min(1).max(255),
    role: exports.UserRole,
    password: zod_1.z
        .string()
        .min(12)
        .max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, 'Password must contain uppercase, lowercase, digit, and special character'),
});
exports.UpdateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    role: exports.UserRole.optional(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.MfaVerifySchema = zod_1.z.object({
    token: zod_1.z.string().length(6).regex(/^\d{6}$/),
});
// ── User Response ──────────────────────────────────────────────────
exports.UserResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string(),
    role: exports.UserRole,
    mfaEnabled: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ── Syllabus Schemas ───────────────────────────────────────────────
exports.CreateExamSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
});
exports.CreateSubjectSchema = zod_1.z.object({
    examId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z
        .string()
        .min(2)
        .max(10)
        .regex(/^[A-Z]{2,10}$/, 'Code must be 2-10 uppercase letters'),
});
exports.CreateTopicSchema = zod_1.z.object({
    subjectId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
});
exports.CreateSubtopicSchema = zod_1.z.object({
    topicId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
});
// ── Question Option Schema ─────────────────────────────────────────
exports.QuestionOptionSchema = zod_1.z.object({
    label: zod_1.z.string().min(1).max(1), // A, B, C, D, etc.
    text: zod_1.z.string().min(1).max(5000), // Markdown + LaTeX
    imageId: zod_1.z.string().uuid().optional(),
});
// ── Question Content (encrypted at rest) ───────────────────────────
exports.QuestionContentSchema = zod_1.z.object({
    type: exports.QuestionType,
    stem: zod_1.z.string().min(1).max(10000), // Markdown + LaTeX, supports Unicode/Devanagari
    options: zod_1.z.array(exports.QuestionOptionSchema).min(2).max(8).optional(), // Required for MCQ types
    imageIds: zod_1.z.array(zod_1.z.string().uuid()).max(5).optional(),
    solution: zod_1.z.string().max(10000).optional(),
    language: exports.Language.default('EN'),
});
// ── Answer Key (encrypted separately) ──────────────────────────────
exports.AnswerKeySchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('MCQ_SINGLE'),
        correct: zod_1.z.string().min(1).max(1), // e.g., "B"
    }),
    zod_1.z.object({
        type: zod_1.z.literal('MCQ_MULTI'),
        correct: zod_1.z.array(zod_1.z.string().min(1).max(1)).min(1).max(8), // e.g., ["A", "C"]
    }),
    zod_1.z.object({
        type: zod_1.z.literal('INTEGER'),
        correct: zod_1.z.number().int(),
        tolerance: zod_1.z.number().min(0).default(0),
    }),
]);
// ── Question Metadata (unencrypted, used for filtering) ────────────
exports.QuestionMetadataSchema = zod_1.z.object({
    subjectId: zod_1.z.string().uuid(),
    topicId: zod_1.z.string().uuid().optional(),
    subtopicId: zod_1.z.string().uuid().optional(),
    type: exports.QuestionType,
    difficulty: zod_1.z.number().min(0).max(100),
    cognitiveLevel: exports.CognitiveLevel,
    marks: zod_1.z.number().positive(),
    negativeMarks: zod_1.z.number().min(0).default(0),
    estimatedTimeSeconds: zod_1.z.number().positive().int(),
    language: exports.Language.default('EN'),
});
// ── Create/Update Question ─────────────────────────────────────────
exports.CreateQuestionSchema = zod_1.z.object({
    content: exports.QuestionContentSchema,
    answerKey: exports.AnswerKeySchema,
    metadata: exports.QuestionMetadataSchema,
});
exports.UpdateQuestionSchema = exports.CreateQuestionSchema;
// ── Question Response (metadata only for non-owners/ADMIN/AUDITOR) ─
exports.QuestionMetadataResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    humanId: zod_1.z.string(),
    authorId: zod_1.z.string().uuid(),
    authorName: zod_1.z.string().optional(),
    status: exports.QuestionStatus,
    currentVersion: zod_1.z.number().int(),
    metadata: exports.QuestionMetadataSchema,
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.QuestionFullResponseSchema = exports.QuestionMetadataResponseSchema.extend({
    content: exports.QuestionContentSchema,
    answerKey: exports.AnswerKeySchema,
});
exports.QuestionVersionResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    questionId: zod_1.z.string().uuid(),
    versionNo: zod_1.z.number().int(),
    status: exports.QuestionStatus,
    contentCommitment: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
});
// ── CSV Import ─────────────────────────────────────────────────────
exports.CsvImportRowSchema = zod_1.z.object({
    type: exports.QuestionType,
    stem: zod_1.z.string().min(1),
    optionA: zod_1.z.string().optional(),
    optionB: zod_1.z.string().optional(),
    optionC: zod_1.z.string().optional(),
    optionD: zod_1.z.string().optional(),
    correctAnswer: zod_1.z.string().min(1),
    solution: zod_1.z.string().optional(),
    subjectCode: zod_1.z.string().min(2).max(10),
    topicName: zod_1.z.string().optional(),
    difficulty: zod_1.z.coerce.number().min(0).max(1),
    cognitiveLevel: exports.CognitiveLevel,
    marks: zod_1.z.coerce.number().positive(),
    negativeMarks: zod_1.z.coerce.number().min(0).default(0),
    estimatedTimeSeconds: zod_1.z.coerce.number().positive().int(),
    language: exports.Language.default('EN'),
});
exports.CsvImportResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    totalRows: zod_1.z.number().int(),
    importedCount: zod_1.z.number().int(),
    errors: zod_1.z.array(zod_1.z.object({
        row: zod_1.z.number().int(),
        field: zod_1.z.string(),
        message: zod_1.z.string(),
    })),
});
// ── Audit Log ──────────────────────────────────────────────────────
exports.AuditEventResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    actorId: zod_1.z.string().uuid().nullable(),
    actorEmail: zod_1.z.string().optional(),
    action: exports.AuditAction,
    targetType: zod_1.z.string(),
    targetId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    entryHash: zod_1.z.string(),
    prevHash: zod_1.z.string(),
    signature: zod_1.z.string(),
});
exports.AuditVerifyResponseSchema = zod_1.z.object({
    valid: zod_1.z.boolean(),
    totalEntries: zod_1.z.number().int(),
    verifiedEntries: zod_1.z.number().int(),
    firstBrokenEntry: zod_1.z
        .object({
        id: zod_1.z.string().uuid(),
        index: zod_1.z.number().int(),
        expectedHash: zod_1.z.string(),
        actualHash: zod_1.z.string(),
    })
        .optional(),
});
// ── Audit Log Filter ───────────────────────────────────────────────
exports.AuditFilterSchema = zod_1.z.object({
    action: exports.AuditAction.optional(),
    actorId: zod_1.z.string().uuid().optional(),
    targetType: zod_1.z.string().optional(),
    targetId: zod_1.z.string().optional(),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
// ── Dashboard Statistics ───────────────────────────────────────────
exports.BankStatisticsSchema = zod_1.z.object({
    totalQuestions: zod_1.z.number().int(),
    byStatus: zod_1.z.record(exports.QuestionStatus, zod_1.z.number().int()),
    bySubject: zod_1.z.array(zod_1.z.object({
        subjectId: zod_1.z.string().uuid(),
        subjectName: zod_1.z.string(),
        count: zod_1.z.number().int(),
    })),
    byDifficultyBucket: zod_1.z.array(zod_1.z.object({
        bucket: zod_1.z.string(),
        count: zod_1.z.number().int(),
    })),
    byType: zod_1.z.record(exports.QuestionType, zod_1.z.number().int()),
});
// ── Pagination ─────────────────────────────────────────────────────
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    items: zod_1.z.array(itemSchema),
    total: zod_1.z.number().int(),
    page: zod_1.z.number().int(),
    limit: zod_1.z.number().int(),
    totalPages: zod_1.z.number().int(),
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
// ── API Response Wrapper ───────────────────────────────────────────
const ApiResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: zod_1.z
        .object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
    })
        .optional(),
});
exports.ApiResponseSchema = ApiResponseSchema;
// ── Step 2: Approval Policy Schemas ────────────────────────────────
exports.ApprovalPolicySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    examId: zod_1.z.string().uuid().nullable().optional(),
    subjectId: zod_1.z.string().uuid().nullable().optional(),
    questionType: exports.QuestionType.nullable().optional(),
    version: zod_1.z.number().int().positive(),
    requiredReviewers: zod_1.z.number().int().min(1).default(2),
    requireBlindSolve: zod_1.z.boolean().default(true),
    requireModerator: zod_1.z.boolean().default(true),
    requireLanguageReview: zod_1.z.boolean().default(true),
    maxReviewDays: zod_1.z.number().int().min(1).default(7),
    difficultyTolerance: zod_1.z.number().default(20),
    exactMatchThreshold: zod_1.z.number().min(0).max(1).default(1.0),
    highSimilarityThreshold: zod_1.z.number().min(0).max(1).default(0.85),
    mediumSimilarityThreshold: zod_1.z.number().min(0).max(1).default(0.60),
    effectiveFrom: zod_1.z.string().datetime(),
    proposedById: zod_1.z.string().uuid(),
    approvedById: zod_1.z.string().uuid().nullable().optional(),
    isActive: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.ProposePolicySchema = zod_1.z.object({
    examId: zod_1.z.string().uuid().optional(),
    subjectId: zod_1.z.string().uuid().optional(),
    questionType: exports.QuestionType.optional(),
    requiredReviewers: zod_1.z.number().int().min(1).default(2),
    requireBlindSolve: zod_1.z.boolean().default(true),
    requireModerator: zod_1.z.boolean().default(true),
    requireLanguageReview: zod_1.z.boolean().default(true),
    maxReviewDays: zod_1.z.number().int().min(1).default(7),
    difficultyTolerance: zod_1.z.number().min(0).max(100).default(20),
    exactMatchThreshold: zod_1.z.number().min(0).max(1).default(1.0),
    highSimilarityThreshold: zod_1.z.number().min(0).max(1).default(0.85),
    mediumSimilarityThreshold: zod_1.z.number().min(0).max(1).default(0.60),
});
exports.ApprovePolicySchema = zod_1.z.object({
    policyId: zod_1.z.string().uuid(),
});
exports.QuickConfigurePolicySchema = zod_1.z.object({
    subjectId: zod_1.z.string().uuid().optional(),
    examId: zod_1.z.string().uuid().optional(),
    requiredReviewers: zod_1.z.number().int().min(1).max(5).default(2),
    difficultyTolerance: zod_1.z.number().min(0).max(100).default(20),
});
// ── Step 2: Reviewer Schemas (Blind Solve & Checklist) ─────────────
exports.BlindAnswerSubmitSchema = zod_1.z.object({
    blindAnswer: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string()), zod_1.z.number()]),
    timeTakenSeconds: zod_1.z.number().int().positive(),
    difficultyRating: zod_1.z.number().min(0).max(100),
});
exports.ReviewChecklistSchema = zod_1.z.object({
    contentAccuracy: zod_1.z.boolean(),
    singleDefensibleAnswer: zod_1.z.boolean(),
    clarityAndWording: zod_1.z.boolean(),
    distractorPlausibility: zod_1.z.boolean(),
    syllabusTopicAlignment: zod_1.z.boolean(),
    difficultyAppropriate: zod_1.z.boolean(),
    languageEquivalence: zod_1.z.boolean().optional(),
    biasAndSensitivity: zod_1.z.boolean(),
    formattingMathRendering: zod_1.z.boolean(),
});
exports.ReviewSubmitSchema = zod_1.z.object({
    decision: exports.ReviewDecision,
    checklist: exports.ReviewChecklistSchema,
    comments: zod_1.z.string().min(1).max(5000),
    totpToken: zod_1.z.string().length(6).regex(/^\d{6}$/),
});
// ── Step 2: Moderator Schemas ──────────────────────────────────────
exports.DuplicateDispositionSchema = zod_1.z.object({
    disposition: exports.DuplicateDisposition,
    justification: zod_1.z.string().min(10, 'Justification must be at least 10 characters').max(5000),
});
exports.ModeratorDecisionSchema = zod_1.z.object({
    decision: exports.ReviewDecision,
    comments: zod_1.z.string().max(5000).optional().default(''),
    totpToken: zod_1.z.string().length(6).regex(/^\d{6}$/),
});
exports.ReassignReviewerSchema = zod_1.z.object({
    assignmentId: zod_1.z.string().uuid(),
    newReviewerId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(5).max(1000),
});
exports.RetireQuestionSchema = zod_1.z.object({
    reason: exports.RetirementReason,
    note: zod_1.z.string().min(5).max(1000),
});
exports.DifficultyResolutionAction = zod_1.z.enum([
    'ACCEPT_MEAN',
    'SET_FINAL_VALUE',
    'REQUEST_THIRD_REVIEW',
    'REQUEST_CHANGES',
]);
exports.ResolveDifficultyConflictSchema = zod_1.z.object({
    action: exports.DifficultyResolutionAction,
    customValue: zod_1.z.number().min(0).max(100).optional(),
    customTimingSeconds: zod_1.z.number().int().positive().optional(),
    autoApprove: zod_1.z.boolean().optional(),
    justification: zod_1.z.string().min(10, 'Justification must be at least 10 characters').max(5000),
});
// ── Step 2: Author Revision & Feedback ─────────────────────────────
exports.CreateNewVersionSchema = zod_1.z.object({
    parentVersionId: zod_1.z.string().uuid(),
    changeJustification: zod_1.z.string().min(15, 'Change justification must be at least 15 characters').max(5000),
    content: exports.QuestionContentSchema,
    answerKey: exports.AnswerKeySchema,
    metadata: exports.QuestionMetadataSchema,
});
// ── Step 2: Conflict Declarations ──────────────────────────────────
exports.ConflictDeclarationSchema = zod_1.z.object({
    conflictType: zod_1.z.enum(['INSTITUTION', 'COACHING_CENTRE', 'PERSON', 'SOURCE']),
    description: zod_1.z.string().min(2).max(1000),
});
// ── Step 2: Corpus Import ──────────────────────────────────────────
exports.CorpusImportSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(255),
    sourceType: zod_1.z.enum(['PAST_PAPER', 'PUBLIC']),
    licenseNote: zod_1.z.string().max(1000).optional(),
    documents: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().min(1).max(255),
        identifier: zod_1.z.string().min(1).max(100),
        content: zod_1.z.string().min(1),
    })).min(1),
});
// ── Step 2: Signed Approval Verification ───────────────────────────
exports.ApprovalRecordSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    questionId: zod_1.z.string().uuid(),
    versionNo: zod_1.z.number().int(),
    contentCommitment: zod_1.z.string(),
    decision: zod_1.z.string(),
    role: zod_1.z.string(),
    approverId: zod_1.z.string().uuid(),
    reviewRound: zod_1.z.number().int(),
    policyVersion: zod_1.z.number().int(),
    timestamp: zod_1.z.string().datetime(),
    signature: zod_1.z.string(),
    validSignature: zod_1.z.boolean(),
});
exports.ApprovalVerificationResponseSchema = zod_1.z.object({
    questionId: zod_1.z.string().uuid(),
    versionNo: zod_1.z.number().int(),
    contentCommitment: zod_1.z.string(),
    approvals: zod_1.z.array(exports.ApprovalRecordSchema),
    allSignaturesValid: zod_1.z.boolean(),
    meetsPolicyRequirements: zod_1.z.boolean(),
    isEligible: zod_1.z.boolean(),
});
// ── Step 4: Eligible Questions Feed (Metadata Only) ────────────────
exports.EligibleQuestionSchema = zod_1.z.object({
    questionId: zod_1.z.string().uuid(),
    versionId: zod_1.z.string().uuid(),
    humanId: zod_1.z.string(),
    versionNo: zod_1.z.number().int(),
    subjectId: zod_1.z.string().uuid(),
    topicId: zod_1.z.string().uuid().nullable().optional(),
    type: exports.QuestionType,
    difficulty: zod_1.z.number(),
    marks: zod_1.z.number(),
    negativeMarks: zod_1.z.number(),
    contentCommitment: zod_1.z.string(),
    approvedAt: zod_1.z.string().datetime(),
});
//# sourceMappingURL=schemas.js.map