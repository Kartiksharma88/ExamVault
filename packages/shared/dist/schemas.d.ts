import { z } from 'zod';
export declare const UserRole: z.ZodEnum<["ADMIN", "EXAMINER", "REVIEWER", "AUDITOR", "MODERATOR", "CUSTODIAN"]>;
export type UserRole = z.infer<typeof UserRole>;
export declare const QuestionType: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
export type QuestionType = z.infer<typeof QuestionType>;
export declare const QuestionStatus: z.ZodEnum<["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"]>;
export type QuestionStatus = z.infer<typeof QuestionStatus>;
export declare const DuplicateDisposition: z.ZodEnum<["CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "SIMILAR_ALLOWED"]>;
export type DuplicateDisposition = z.infer<typeof DuplicateDisposition>;
export declare const ReviewDecision: z.ZodEnum<["APPROVE", "REQUEST_CHANGES", "REJECT"]>;
export type ReviewDecision = z.infer<typeof ReviewDecision>;
export declare const OriginalityRiskLevel: z.ZodEnum<["NONE", "LOW", "MEDIUM", "HIGH", "EXACT"]>;
export type OriginalityRiskLevel = z.infer<typeof OriginalityRiskLevel>;
export declare const OriginalitySourceType: z.ZodEnum<["BANK", "PAST_PAPER", "PUBLIC"]>;
export type OriginalitySourceType = z.infer<typeof OriginalitySourceType>;
export declare const RetirementReason: z.ZodEnum<["SUPERSEDED", "OUTDATED_SYLLABUS", "ERRONEOUS_CONTENT", "OTHER"]>;
export type RetirementReason = z.infer<typeof RetirementReason>;
export declare const CognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
export type CognitiveLevel = z.infer<typeof CognitiveLevel>;
export declare const Language: z.ZodEnum<["EN", "HI", "BILINGUAL"]>;
export type Language = z.infer<typeof Language>;
export declare const AuditAction: z.ZodEnum<["LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT", "MFA_SETUP", "MFA_VERIFY", "MFA_FAILURE", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "ROLE_CHANGE", "SYLLABUS_CREATE", "SYLLABUS_UPDATE", "SYLLABUS_DELETE", "QUESTION_CREATE", "QUESTION_EDIT", "QUESTION_SUBMIT", "QUESTION_WITHDRAW", "QUESTION_READ", "QUESTION_CONTENT_READ", "IMPORT_START", "IMPORT_SUCCESS", "IMPORT_FAILURE", "ACCESS_DENIED", "SCREENING_START", "SCREENING_COMPLETE", "DUPLICATE_FLAGGED", "DUPLICATE_DISPOSITION", "REVIEWER_ASSIGNMENT", "BLIND_ANSWER_SUBMIT", "KEY_REVEAL", "REVIEW_DECISION", "DISAGREEMENT_RAISED", "DISAGREEMENT_RESOLVED", "MODERATOR_DECISION", "APPROVAL_SIGNED", "NEW_VERSION_CREATE", "VERSION_SUPERSEDED", "VERSION_RETIRED", "POLICY_PROPOSE", "POLICY_APPROVE", "CONFLICT_UPDATE", "STEP_UP_MFA_SUCCESS", "STEP_UP_MFA_FAILURE", "ORIGINALITY_SERVICE_FAILURE", "REVIEW_COMMENT_READ", "REVIEW_REASSIGN", "QUESTION_REVIEW_START", "QUESTION_APPROVE", "QUESTION_REJECT", "PAPER_GENERATE", "KEY_RELEASE"]>;
export type AuditAction = z.infer<typeof AuditAction>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["ADMIN", "EXAMINER", "REVIEWER", "AUDITOR", "MODERATOR", "CUSTODIAN"]>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    role: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN";
    password: string;
}, {
    email: string;
    name: string;
    role: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN";
    password: string;
}>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export declare const UpdateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["ADMIN", "EXAMINER", "REVIEWER", "AUDITOR", "MODERATOR", "CUSTODIAN"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    role?: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN" | undefined;
}, {
    name?: string | undefined;
    role?: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN" | undefined;
}>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const MfaVerifySchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;
export declare const UserResponseSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["ADMIN", "EXAMINER", "REVIEWER", "AUDITOR", "MODERATOR", "CUSTODIAN"]>;
    mfaEnabled: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    role: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN";
    id: string;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}, {
    email: string;
    name: string;
    role: "ADMIN" | "EXAMINER" | "REVIEWER" | "AUDITOR" | "MODERATOR" | "CUSTODIAN";
    id: string;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export declare const CreateExamSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export type CreateExamInput = z.infer<typeof CreateExamSchema>;
export declare const CreateSubjectSchema: z.ZodObject<{
    examId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    examId: string;
}, {
    code: string;
    name: string;
    examId: string;
}>;
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;
export declare const CreateTopicSchema: z.ZodObject<{
    subjectId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    subjectId: string;
}, {
    name: string;
    subjectId: string;
}>;
export type CreateTopicInput = z.infer<typeof CreateTopicSchema>;
export declare const CreateSubtopicSchema: z.ZodObject<{
    topicId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    topicId: string;
}, {
    name: string;
    topicId: string;
}>;
export type CreateSubtopicInput = z.infer<typeof CreateSubtopicSchema>;
export declare const QuestionOptionSchema: z.ZodObject<{
    label: z.ZodString;
    text: z.ZodString;
    imageId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    text: string;
    imageId?: string | undefined;
}, {
    label: string;
    text: string;
    imageId?: string | undefined;
}>;
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export declare const QuestionContentSchema: z.ZodObject<{
    type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
    stem: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        text: z.ZodString;
        imageId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        text: string;
        imageId?: string | undefined;
    }, {
        label: string;
        text: string;
        imageId?: string | undefined;
    }>, "many">>;
    imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    solution: z.ZodOptional<z.ZodString>;
    language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    stem: string;
    language: "EN" | "HI" | "BILINGUAL";
    options?: {
        label: string;
        text: string;
        imageId?: string | undefined;
    }[] | undefined;
    imageIds?: string[] | undefined;
    solution?: string | undefined;
}, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    stem: string;
    options?: {
        label: string;
        text: string;
        imageId?: string | undefined;
    }[] | undefined;
    imageIds?: string[] | undefined;
    solution?: string | undefined;
    language?: "EN" | "HI" | "BILINGUAL" | undefined;
}>;
export type QuestionContent = z.infer<typeof QuestionContentSchema>;
export declare const AnswerKeySchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"MCQ_SINGLE">;
    correct: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_SINGLE";
    correct: string;
}, {
    type: "MCQ_SINGLE";
    correct: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"MCQ_MULTI">;
    correct: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_MULTI";
    correct: string[];
}, {
    type: "MCQ_MULTI";
    correct: string[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"INTEGER">;
    correct: z.ZodNumber;
    tolerance: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "INTEGER";
    correct: number;
    tolerance: number;
}, {
    type: "INTEGER";
    correct: number;
    tolerance?: number | undefined;
}>]>;
export type AnswerKey = z.infer<typeof AnswerKeySchema>;
export declare const QuestionMetadataSchema: z.ZodObject<{
    subjectId: z.ZodString;
    topicId: z.ZodOptional<z.ZodString>;
    subtopicId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
    difficulty: z.ZodNumber;
    cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
    marks: z.ZodNumber;
    negativeMarks: z.ZodDefault<z.ZodNumber>;
    estimatedTimeSeconds: z.ZodNumber;
    language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    subjectId: string;
    language: "EN" | "HI" | "BILINGUAL";
    difficulty: number;
    cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
    marks: number;
    negativeMarks: number;
    estimatedTimeSeconds: number;
    topicId?: string | undefined;
    subtopicId?: string | undefined;
}, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    subjectId: string;
    difficulty: number;
    cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
    marks: number;
    estimatedTimeSeconds: number;
    topicId?: string | undefined;
    language?: "EN" | "HI" | "BILINGUAL" | undefined;
    subtopicId?: string | undefined;
    negativeMarks?: number | undefined;
}>;
export type QuestionMetadata = z.infer<typeof QuestionMetadataSchema>;
export declare const CreateQuestionSchema: z.ZodObject<{
    content: z.ZodObject<{
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        stem: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            text: z.ZodString;
            imageId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }>, "many">>;
        imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        solution: z.ZodOptional<z.ZodString>;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    }>;
    answerKey: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"MCQ_SINGLE">;
        correct: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE";
        correct: string;
    }, {
        type: "MCQ_SINGLE";
        correct: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"MCQ_MULTI">;
        correct: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_MULTI";
        correct: string[];
    }, {
        type: "MCQ_MULTI";
        correct: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"INTEGER">;
        correct: z.ZodNumber;
        tolerance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    }, {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    }>]>;
    metadata: z.ZodObject<{
        subjectId: z.ZodString;
        topicId: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        difficulty: z.ZodNumber;
        cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
        marks: z.ZodNumber;
        negativeMarks: z.ZodDefault<z.ZodNumber>;
        estimatedTimeSeconds: z.ZodNumber;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    };
}, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    };
}>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export declare const UpdateQuestionSchema: z.ZodObject<{
    content: z.ZodObject<{
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        stem: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            text: z.ZodString;
            imageId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }>, "many">>;
        imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        solution: z.ZodOptional<z.ZodString>;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    }>;
    answerKey: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"MCQ_SINGLE">;
        correct: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE";
        correct: string;
    }, {
        type: "MCQ_SINGLE";
        correct: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"MCQ_MULTI">;
        correct: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_MULTI";
        correct: string[];
    }, {
        type: "MCQ_MULTI";
        correct: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"INTEGER">;
        correct: z.ZodNumber;
        tolerance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    }, {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    }>]>;
    metadata: z.ZodObject<{
        subjectId: z.ZodString;
        topicId: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        difficulty: z.ZodNumber;
        cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
        marks: z.ZodNumber;
        negativeMarks: z.ZodDefault<z.ZodNumber>;
        estimatedTimeSeconds: z.ZodNumber;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    };
}, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    };
}>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export declare const QuestionMetadataResponseSchema: z.ZodObject<{
    id: z.ZodString;
    humanId: z.ZodString;
    authorId: z.ZodString;
    authorName: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"]>;
    currentVersion: z.ZodNumber;
    metadata: z.ZodObject<{
        subjectId: z.ZodString;
        topicId: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        difficulty: z.ZodNumber;
        cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
        marks: z.ZodNumber;
        negativeMarks: z.ZodDefault<z.ZodNumber>;
        estimatedTimeSeconds: z.ZodNumber;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    updatedAt: string;
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    };
    humanId: string;
    authorId: string;
    currentVersion: number;
    authorName?: string | undefined;
}, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    updatedAt: string;
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    };
    humanId: string;
    authorId: string;
    currentVersion: number;
    authorName?: string | undefined;
}>;
export type QuestionMetadataResponse = z.infer<typeof QuestionMetadataResponseSchema>;
export declare const QuestionFullResponseSchema: z.ZodObject<{
    id: z.ZodString;
    humanId: z.ZodString;
    authorId: z.ZodString;
    authorName: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"]>;
    currentVersion: z.ZodNumber;
    metadata: z.ZodObject<{
        subjectId: z.ZodString;
        topicId: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        difficulty: z.ZodNumber;
        cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
        marks: z.ZodNumber;
        negativeMarks: z.ZodDefault<z.ZodNumber>;
        estimatedTimeSeconds: z.ZodNumber;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    content: z.ZodObject<{
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        stem: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            text: z.ZodString;
            imageId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }>, "many">>;
        imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        solution: z.ZodOptional<z.ZodString>;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    }>;
    answerKey: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"MCQ_SINGLE">;
        correct: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE";
        correct: string;
    }, {
        type: "MCQ_SINGLE";
        correct: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"MCQ_MULTI">;
        correct: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_MULTI";
        correct: string[];
    }, {
        type: "MCQ_MULTI";
        correct: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"INTEGER">;
        correct: z.ZodNumber;
        tolerance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    }, {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    }>]>;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    updatedAt: string;
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    };
    humanId: string;
    authorId: string;
    currentVersion: number;
    authorName?: string | undefined;
}, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    updatedAt: string;
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    };
    humanId: string;
    authorId: string;
    currentVersion: number;
    authorName?: string | undefined;
}>;
export type QuestionFullResponse = z.infer<typeof QuestionFullResponseSchema>;
export declare const QuestionVersionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    questionId: z.ZodString;
    versionNo: z.ZodNumber;
    status: z.ZodEnum<["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"]>;
    contentCommitment: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
}, {
    status: "DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED";
    id: string;
    createdAt: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
}>;
export type QuestionVersionResponse = z.infer<typeof QuestionVersionResponseSchema>;
export declare const CsvImportRowSchema: z.ZodObject<{
    type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
    stem: z.ZodString;
    optionA: z.ZodOptional<z.ZodString>;
    optionB: z.ZodOptional<z.ZodString>;
    optionC: z.ZodOptional<z.ZodString>;
    optionD: z.ZodOptional<z.ZodString>;
    correctAnswer: z.ZodString;
    solution: z.ZodOptional<z.ZodString>;
    subjectCode: z.ZodString;
    topicName: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodNumber;
    cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
    marks: z.ZodNumber;
    negativeMarks: z.ZodDefault<z.ZodNumber>;
    estimatedTimeSeconds: z.ZodNumber;
    language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    stem: string;
    language: "EN" | "HI" | "BILINGUAL";
    difficulty: number;
    cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
    marks: number;
    negativeMarks: number;
    estimatedTimeSeconds: number;
    correctAnswer: string;
    subjectCode: string;
    solution?: string | undefined;
    optionA?: string | undefined;
    optionB?: string | undefined;
    optionC?: string | undefined;
    optionD?: string | undefined;
    topicName?: string | undefined;
}, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    stem: string;
    difficulty: number;
    cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
    marks: number;
    estimatedTimeSeconds: number;
    correctAnswer: string;
    subjectCode: string;
    solution?: string | undefined;
    language?: "EN" | "HI" | "BILINGUAL" | undefined;
    negativeMarks?: number | undefined;
    optionA?: string | undefined;
    optionB?: string | undefined;
    optionC?: string | undefined;
    optionD?: string | undefined;
    topicName?: string | undefined;
}>;
export type CsvImportRow = z.infer<typeof CsvImportRowSchema>;
export declare const CsvImportResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    totalRows: z.ZodNumber;
    importedCount: z.ZodNumber;
    errors: z.ZodArray<z.ZodObject<{
        row: z.ZodNumber;
        field: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        row: number;
        field: string;
    }, {
        message: string;
        row: number;
        field: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    totalRows: number;
    importedCount: number;
    errors: {
        message: string;
        row: number;
        field: string;
    }[];
}, {
    success: boolean;
    totalRows: number;
    importedCount: number;
    errors: {
        message: string;
        row: number;
        field: string;
    }[];
}>;
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
export declare const AuditEventResponseSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    actorId: z.ZodNullable<z.ZodString>;
    actorEmail: z.ZodOptional<z.ZodString>;
    action: z.ZodEnum<["LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT", "MFA_SETUP", "MFA_VERIFY", "MFA_FAILURE", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "ROLE_CHANGE", "SYLLABUS_CREATE", "SYLLABUS_UPDATE", "SYLLABUS_DELETE", "QUESTION_CREATE", "QUESTION_EDIT", "QUESTION_SUBMIT", "QUESTION_WITHDRAW", "QUESTION_READ", "QUESTION_CONTENT_READ", "IMPORT_START", "IMPORT_SUCCESS", "IMPORT_FAILURE", "ACCESS_DENIED", "SCREENING_START", "SCREENING_COMPLETE", "DUPLICATE_FLAGGED", "DUPLICATE_DISPOSITION", "REVIEWER_ASSIGNMENT", "BLIND_ANSWER_SUBMIT", "KEY_REVEAL", "REVIEW_DECISION", "DISAGREEMENT_RAISED", "DISAGREEMENT_RESOLVED", "MODERATOR_DECISION", "APPROVAL_SIGNED", "NEW_VERSION_CREATE", "VERSION_SUPERSEDED", "VERSION_RETIRED", "POLICY_PROPOSE", "POLICY_APPROVE", "CONFLICT_UPDATE", "STEP_UP_MFA_SUCCESS", "STEP_UP_MFA_FAILURE", "ORIGINALITY_SERVICE_FAILURE", "REVIEW_COMMENT_READ", "REVIEW_REASSIGN", "QUESTION_REVIEW_START", "QUESTION_APPROVE", "QUESTION_REJECT", "PAPER_GENERATE", "KEY_RELEASE"]>;
    targetType: z.ZodString;
    targetId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    entryHash: z.ZodString;
    prevHash: z.ZodString;
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    actorId: string | null;
    action: "DUPLICATE_FLAGGED" | "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "MFA_FAILURE" | "USER_CREATE" | "USER_UPDATE" | "USER_DELETE" | "ROLE_CHANGE" | "SYLLABUS_CREATE" | "SYLLABUS_UPDATE" | "SYLLABUS_DELETE" | "QUESTION_CREATE" | "QUESTION_EDIT" | "QUESTION_SUBMIT" | "QUESTION_WITHDRAW" | "QUESTION_READ" | "QUESTION_CONTENT_READ" | "IMPORT_START" | "IMPORT_SUCCESS" | "IMPORT_FAILURE" | "ACCESS_DENIED" | "SCREENING_START" | "SCREENING_COMPLETE" | "DUPLICATE_DISPOSITION" | "REVIEWER_ASSIGNMENT" | "BLIND_ANSWER_SUBMIT" | "KEY_REVEAL" | "REVIEW_DECISION" | "DISAGREEMENT_RAISED" | "DISAGREEMENT_RESOLVED" | "MODERATOR_DECISION" | "APPROVAL_SIGNED" | "NEW_VERSION_CREATE" | "VERSION_SUPERSEDED" | "VERSION_RETIRED" | "POLICY_PROPOSE" | "POLICY_APPROVE" | "CONFLICT_UPDATE" | "STEP_UP_MFA_SUCCESS" | "STEP_UP_MFA_FAILURE" | "ORIGINALITY_SERVICE_FAILURE" | "REVIEW_COMMENT_READ" | "REVIEW_REASSIGN" | "QUESTION_REVIEW_START" | "QUESTION_APPROVE" | "QUESTION_REJECT" | "PAPER_GENERATE" | "KEY_RELEASE";
    targetType: string;
    entryHash: string;
    prevHash: string;
    signature: string;
    metadata?: Record<string, unknown> | undefined;
    actorEmail?: string | undefined;
    targetId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    actorId: string | null;
    action: "DUPLICATE_FLAGGED" | "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "MFA_FAILURE" | "USER_CREATE" | "USER_UPDATE" | "USER_DELETE" | "ROLE_CHANGE" | "SYLLABUS_CREATE" | "SYLLABUS_UPDATE" | "SYLLABUS_DELETE" | "QUESTION_CREATE" | "QUESTION_EDIT" | "QUESTION_SUBMIT" | "QUESTION_WITHDRAW" | "QUESTION_READ" | "QUESTION_CONTENT_READ" | "IMPORT_START" | "IMPORT_SUCCESS" | "IMPORT_FAILURE" | "ACCESS_DENIED" | "SCREENING_START" | "SCREENING_COMPLETE" | "DUPLICATE_DISPOSITION" | "REVIEWER_ASSIGNMENT" | "BLIND_ANSWER_SUBMIT" | "KEY_REVEAL" | "REVIEW_DECISION" | "DISAGREEMENT_RAISED" | "DISAGREEMENT_RESOLVED" | "MODERATOR_DECISION" | "APPROVAL_SIGNED" | "NEW_VERSION_CREATE" | "VERSION_SUPERSEDED" | "VERSION_RETIRED" | "POLICY_PROPOSE" | "POLICY_APPROVE" | "CONFLICT_UPDATE" | "STEP_UP_MFA_SUCCESS" | "STEP_UP_MFA_FAILURE" | "ORIGINALITY_SERVICE_FAILURE" | "REVIEW_COMMENT_READ" | "REVIEW_REASSIGN" | "QUESTION_REVIEW_START" | "QUESTION_APPROVE" | "QUESTION_REJECT" | "PAPER_GENERATE" | "KEY_RELEASE";
    targetType: string;
    entryHash: string;
    prevHash: string;
    signature: string;
    metadata?: Record<string, unknown> | undefined;
    actorEmail?: string | undefined;
    targetId?: string | undefined;
}>;
export type AuditEventResponse = z.infer<typeof AuditEventResponseSchema>;
export declare const AuditVerifyResponseSchema: z.ZodObject<{
    valid: z.ZodBoolean;
    totalEntries: z.ZodNumber;
    verifiedEntries: z.ZodNumber;
    firstBrokenEntry: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        index: z.ZodNumber;
        expectedHash: z.ZodString;
        actualHash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        index: number;
        expectedHash: string;
        actualHash: string;
    }, {
        id: string;
        index: number;
        expectedHash: string;
        actualHash: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    totalEntries: number;
    verifiedEntries: number;
    firstBrokenEntry?: {
        id: string;
        index: number;
        expectedHash: string;
        actualHash: string;
    } | undefined;
}, {
    valid: boolean;
    totalEntries: number;
    verifiedEntries: number;
    firstBrokenEntry?: {
        id: string;
        index: number;
        expectedHash: string;
        actualHash: string;
    } | undefined;
}>;
export type AuditVerifyResponse = z.infer<typeof AuditVerifyResponseSchema>;
export declare const AuditFilterSchema: z.ZodObject<{
    action: z.ZodOptional<z.ZodEnum<["LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT", "MFA_SETUP", "MFA_VERIFY", "MFA_FAILURE", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "ROLE_CHANGE", "SYLLABUS_CREATE", "SYLLABUS_UPDATE", "SYLLABUS_DELETE", "QUESTION_CREATE", "QUESTION_EDIT", "QUESTION_SUBMIT", "QUESTION_WITHDRAW", "QUESTION_READ", "QUESTION_CONTENT_READ", "IMPORT_START", "IMPORT_SUCCESS", "IMPORT_FAILURE", "ACCESS_DENIED", "SCREENING_START", "SCREENING_COMPLETE", "DUPLICATE_FLAGGED", "DUPLICATE_DISPOSITION", "REVIEWER_ASSIGNMENT", "BLIND_ANSWER_SUBMIT", "KEY_REVEAL", "REVIEW_DECISION", "DISAGREEMENT_RAISED", "DISAGREEMENT_RESOLVED", "MODERATOR_DECISION", "APPROVAL_SIGNED", "NEW_VERSION_CREATE", "VERSION_SUPERSEDED", "VERSION_RETIRED", "POLICY_PROPOSE", "POLICY_APPROVE", "CONFLICT_UPDATE", "STEP_UP_MFA_SUCCESS", "STEP_UP_MFA_FAILURE", "ORIGINALITY_SERVICE_FAILURE", "REVIEW_COMMENT_READ", "REVIEW_REASSIGN", "QUESTION_REVIEW_START", "QUESTION_APPROVE", "QUESTION_REJECT", "PAPER_GENERATE", "KEY_RELEASE"]>>;
    actorId: z.ZodOptional<z.ZodString>;
    targetType: z.ZodOptional<z.ZodString>;
    targetId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    actorId?: string | undefined;
    action?: "DUPLICATE_FLAGGED" | "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "MFA_FAILURE" | "USER_CREATE" | "USER_UPDATE" | "USER_DELETE" | "ROLE_CHANGE" | "SYLLABUS_CREATE" | "SYLLABUS_UPDATE" | "SYLLABUS_DELETE" | "QUESTION_CREATE" | "QUESTION_EDIT" | "QUESTION_SUBMIT" | "QUESTION_WITHDRAW" | "QUESTION_READ" | "QUESTION_CONTENT_READ" | "IMPORT_START" | "IMPORT_SUCCESS" | "IMPORT_FAILURE" | "ACCESS_DENIED" | "SCREENING_START" | "SCREENING_COMPLETE" | "DUPLICATE_DISPOSITION" | "REVIEWER_ASSIGNMENT" | "BLIND_ANSWER_SUBMIT" | "KEY_REVEAL" | "REVIEW_DECISION" | "DISAGREEMENT_RAISED" | "DISAGREEMENT_RESOLVED" | "MODERATOR_DECISION" | "APPROVAL_SIGNED" | "NEW_VERSION_CREATE" | "VERSION_SUPERSEDED" | "VERSION_RETIRED" | "POLICY_PROPOSE" | "POLICY_APPROVE" | "CONFLICT_UPDATE" | "STEP_UP_MFA_SUCCESS" | "STEP_UP_MFA_FAILURE" | "ORIGINALITY_SERVICE_FAILURE" | "REVIEW_COMMENT_READ" | "REVIEW_REASSIGN" | "QUESTION_REVIEW_START" | "QUESTION_APPROVE" | "QUESTION_REJECT" | "PAPER_GENERATE" | "KEY_RELEASE" | undefined;
    targetType?: string | undefined;
    targetId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}, {
    actorId?: string | undefined;
    action?: "DUPLICATE_FLAGGED" | "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "MFA_FAILURE" | "USER_CREATE" | "USER_UPDATE" | "USER_DELETE" | "ROLE_CHANGE" | "SYLLABUS_CREATE" | "SYLLABUS_UPDATE" | "SYLLABUS_DELETE" | "QUESTION_CREATE" | "QUESTION_EDIT" | "QUESTION_SUBMIT" | "QUESTION_WITHDRAW" | "QUESTION_READ" | "QUESTION_CONTENT_READ" | "IMPORT_START" | "IMPORT_SUCCESS" | "IMPORT_FAILURE" | "ACCESS_DENIED" | "SCREENING_START" | "SCREENING_COMPLETE" | "DUPLICATE_DISPOSITION" | "REVIEWER_ASSIGNMENT" | "BLIND_ANSWER_SUBMIT" | "KEY_REVEAL" | "REVIEW_DECISION" | "DISAGREEMENT_RAISED" | "DISAGREEMENT_RESOLVED" | "MODERATOR_DECISION" | "APPROVAL_SIGNED" | "NEW_VERSION_CREATE" | "VERSION_SUPERSEDED" | "VERSION_RETIRED" | "POLICY_PROPOSE" | "POLICY_APPROVE" | "CONFLICT_UPDATE" | "STEP_UP_MFA_SUCCESS" | "STEP_UP_MFA_FAILURE" | "ORIGINALITY_SERVICE_FAILURE" | "REVIEW_COMMENT_READ" | "REVIEW_REASSIGN" | "QUESTION_REVIEW_START" | "QUESTION_APPROVE" | "QUESTION_REJECT" | "PAPER_GENERATE" | "KEY_RELEASE" | undefined;
    targetType?: string | undefined;
    targetId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type AuditFilter = z.infer<typeof AuditFilterSchema>;
export declare const BankStatisticsSchema: z.ZodObject<{
    totalQuestions: z.ZodNumber;
    byStatus: z.ZodRecord<z.ZodEnum<["DRAFT", "SUBMITTED", "SCREENING", "DUPLICATE_FLAGGED", "READY_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "MODERATION", "APPROVED", "REJECTED", "WITHDRAWN", "RETIRED"]>, z.ZodNumber>;
    bySubject: z.ZodArray<z.ZodObject<{
        subjectId: z.ZodString;
        subjectName: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        subjectId: string;
        subjectName: string;
        count: number;
    }, {
        subjectId: string;
        subjectName: string;
        count: number;
    }>, "many">;
    byDifficultyBucket: z.ZodArray<z.ZodObject<{
        bucket: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        bucket: string;
    }, {
        count: number;
        bucket: string;
    }>, "many">;
    byType: z.ZodRecord<z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalQuestions: number;
    byStatus: Partial<Record<"DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED", number>>;
    bySubject: {
        subjectId: string;
        subjectName: string;
        count: number;
    }[];
    byDifficultyBucket: {
        count: number;
        bucket: string;
    }[];
    byType: Partial<Record<"MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER", number>>;
}, {
    totalQuestions: number;
    byStatus: Partial<Record<"DRAFT" | "SUBMITTED" | "SCREENING" | "DUPLICATE_FLAGGED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "MODERATION" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RETIRED", number>>;
    bySubject: {
        subjectId: string;
        subjectName: string;
        count: number;
    }[];
    byDifficultyBucket: {
        count: number;
        bucket: string;
    }[];
    byType: Partial<Record<"MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER", number>>;
}>;
export type BankStatistics = z.infer<typeof BankStatisticsSchema>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    items: z.ZodArray<T, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    limit: z.ZodNumber;
    totalPages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    items: T["_output"][];
    total: number;
    totalPages: number;
}, {
    page: number;
    limit: number;
    items: T["_input"][];
    total: number;
    totalPages: number;
}>;
export declare const ApiResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const ApprovalPolicySchema: z.ZodObject<{
    id: z.ZodString;
    examId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    subjectId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    questionType: z.ZodOptional<z.ZodNullable<z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>>>;
    version: z.ZodNumber;
    requiredReviewers: z.ZodDefault<z.ZodNumber>;
    requireBlindSolve: z.ZodDefault<z.ZodBoolean>;
    requireModerator: z.ZodDefault<z.ZodBoolean>;
    requireLanguageReview: z.ZodDefault<z.ZodBoolean>;
    maxReviewDays: z.ZodDefault<z.ZodNumber>;
    difficultyTolerance: z.ZodDefault<z.ZodNumber>;
    exactMatchThreshold: z.ZodDefault<z.ZodNumber>;
    highSimilarityThreshold: z.ZodDefault<z.ZodNumber>;
    mediumSimilarityThreshold: z.ZodDefault<z.ZodNumber>;
    effectiveFrom: z.ZodString;
    proposedById: z.ZodString;
    approvedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    requiredReviewers: number;
    requireBlindSolve: boolean;
    requireModerator: boolean;
    requireLanguageReview: boolean;
    maxReviewDays: number;
    difficultyTolerance: number;
    exactMatchThreshold: number;
    highSimilarityThreshold: number;
    mediumSimilarityThreshold: number;
    effectiveFrom: string;
    proposedById: string;
    isActive: boolean;
    examId?: string | null | undefined;
    subjectId?: string | null | undefined;
    questionType?: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER" | null | undefined;
    approvedById?: string | null | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    effectiveFrom: string;
    proposedById: string;
    examId?: string | null | undefined;
    subjectId?: string | null | undefined;
    questionType?: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER" | null | undefined;
    requiredReviewers?: number | undefined;
    requireBlindSolve?: boolean | undefined;
    requireModerator?: boolean | undefined;
    requireLanguageReview?: boolean | undefined;
    maxReviewDays?: number | undefined;
    difficultyTolerance?: number | undefined;
    exactMatchThreshold?: number | undefined;
    highSimilarityThreshold?: number | undefined;
    mediumSimilarityThreshold?: number | undefined;
    approvedById?: string | null | undefined;
    isActive?: boolean | undefined;
}>;
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
export declare const ProposePolicySchema: z.ZodObject<{
    examId: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodOptional<z.ZodString>;
    questionType: z.ZodOptional<z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>>;
    requiredReviewers: z.ZodDefault<z.ZodNumber>;
    requireBlindSolve: z.ZodDefault<z.ZodBoolean>;
    requireModerator: z.ZodDefault<z.ZodBoolean>;
    requireLanguageReview: z.ZodDefault<z.ZodBoolean>;
    maxReviewDays: z.ZodDefault<z.ZodNumber>;
    difficultyTolerance: z.ZodDefault<z.ZodNumber>;
    exactMatchThreshold: z.ZodDefault<z.ZodNumber>;
    highSimilarityThreshold: z.ZodDefault<z.ZodNumber>;
    mediumSimilarityThreshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    requiredReviewers: number;
    requireBlindSolve: boolean;
    requireModerator: boolean;
    requireLanguageReview: boolean;
    maxReviewDays: number;
    difficultyTolerance: number;
    exactMatchThreshold: number;
    highSimilarityThreshold: number;
    mediumSimilarityThreshold: number;
    examId?: string | undefined;
    subjectId?: string | undefined;
    questionType?: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER" | undefined;
}, {
    examId?: string | undefined;
    subjectId?: string | undefined;
    questionType?: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER" | undefined;
    requiredReviewers?: number | undefined;
    requireBlindSolve?: boolean | undefined;
    requireModerator?: boolean | undefined;
    requireLanguageReview?: boolean | undefined;
    maxReviewDays?: number | undefined;
    difficultyTolerance?: number | undefined;
    exactMatchThreshold?: number | undefined;
    highSimilarityThreshold?: number | undefined;
    mediumSimilarityThreshold?: number | undefined;
}>;
export type ProposePolicyInput = z.infer<typeof ProposePolicySchema>;
export declare const ApprovePolicySchema: z.ZodObject<{
    policyId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    policyId: string;
}, {
    policyId: string;
}>;
export type ApprovePolicyInput = z.infer<typeof ApprovePolicySchema>;
export declare const QuickConfigurePolicySchema: z.ZodObject<{
    subjectId: z.ZodOptional<z.ZodString>;
    examId: z.ZodOptional<z.ZodString>;
    requiredReviewers: z.ZodDefault<z.ZodNumber>;
    difficultyTolerance: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    requiredReviewers: number;
    difficultyTolerance: number;
    examId?: string | undefined;
    subjectId?: string | undefined;
}, {
    examId?: string | undefined;
    subjectId?: string | undefined;
    requiredReviewers?: number | undefined;
    difficultyTolerance?: number | undefined;
}>;
export type QuickConfigurePolicyInput = z.infer<typeof QuickConfigurePolicySchema>;
export declare const BlindAnswerSubmitSchema: z.ZodObject<{
    blindAnswer: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">, z.ZodNumber]>;
    timeTakenSeconds: z.ZodNumber;
    difficultyRating: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    blindAnswer: string | number | string[];
    timeTakenSeconds: number;
    difficultyRating: number;
}, {
    blindAnswer: string | number | string[];
    timeTakenSeconds: number;
    difficultyRating: number;
}>;
export type BlindAnswerSubmitInput = z.infer<typeof BlindAnswerSubmitSchema>;
export declare const ReviewChecklistSchema: z.ZodObject<{
    contentAccuracy: z.ZodBoolean;
    singleDefensibleAnswer: z.ZodBoolean;
    clarityAndWording: z.ZodBoolean;
    distractorPlausibility: z.ZodBoolean;
    syllabusTopicAlignment: z.ZodBoolean;
    difficultyAppropriate: z.ZodBoolean;
    languageEquivalence: z.ZodOptional<z.ZodBoolean>;
    biasAndSensitivity: z.ZodBoolean;
    formattingMathRendering: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    contentAccuracy: boolean;
    singleDefensibleAnswer: boolean;
    clarityAndWording: boolean;
    distractorPlausibility: boolean;
    syllabusTopicAlignment: boolean;
    difficultyAppropriate: boolean;
    biasAndSensitivity: boolean;
    formattingMathRendering: boolean;
    languageEquivalence?: boolean | undefined;
}, {
    contentAccuracy: boolean;
    singleDefensibleAnswer: boolean;
    clarityAndWording: boolean;
    distractorPlausibility: boolean;
    syllabusTopicAlignment: boolean;
    difficultyAppropriate: boolean;
    biasAndSensitivity: boolean;
    formattingMathRendering: boolean;
    languageEquivalence?: boolean | undefined;
}>;
export type ReviewChecklist = z.infer<typeof ReviewChecklistSchema>;
export declare const ReviewSubmitSchema: z.ZodObject<{
    decision: z.ZodEnum<["APPROVE", "REQUEST_CHANGES", "REJECT"]>;
    checklist: z.ZodObject<{
        contentAccuracy: z.ZodBoolean;
        singleDefensibleAnswer: z.ZodBoolean;
        clarityAndWording: z.ZodBoolean;
        distractorPlausibility: z.ZodBoolean;
        syllabusTopicAlignment: z.ZodBoolean;
        difficultyAppropriate: z.ZodBoolean;
        languageEquivalence: z.ZodOptional<z.ZodBoolean>;
        biasAndSensitivity: z.ZodBoolean;
        formattingMathRendering: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        contentAccuracy: boolean;
        singleDefensibleAnswer: boolean;
        clarityAndWording: boolean;
        distractorPlausibility: boolean;
        syllabusTopicAlignment: boolean;
        difficultyAppropriate: boolean;
        biasAndSensitivity: boolean;
        formattingMathRendering: boolean;
        languageEquivalence?: boolean | undefined;
    }, {
        contentAccuracy: boolean;
        singleDefensibleAnswer: boolean;
        clarityAndWording: boolean;
        distractorPlausibility: boolean;
        syllabusTopicAlignment: boolean;
        difficultyAppropriate: boolean;
        biasAndSensitivity: boolean;
        formattingMathRendering: boolean;
        languageEquivalence?: boolean | undefined;
    }>;
    comments: z.ZodString;
    totpToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
    checklist: {
        contentAccuracy: boolean;
        singleDefensibleAnswer: boolean;
        clarityAndWording: boolean;
        distractorPlausibility: boolean;
        syllabusTopicAlignment: boolean;
        difficultyAppropriate: boolean;
        biasAndSensitivity: boolean;
        formattingMathRendering: boolean;
        languageEquivalence?: boolean | undefined;
    };
    comments: string;
    totpToken: string;
}, {
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
    checklist: {
        contentAccuracy: boolean;
        singleDefensibleAnswer: boolean;
        clarityAndWording: boolean;
        distractorPlausibility: boolean;
        syllabusTopicAlignment: boolean;
        difficultyAppropriate: boolean;
        biasAndSensitivity: boolean;
        formattingMathRendering: boolean;
        languageEquivalence?: boolean | undefined;
    };
    comments: string;
    totpToken: string;
}>;
export type ReviewSubmitInput = z.infer<typeof ReviewSubmitSchema>;
export declare const DuplicateDispositionSchema: z.ZodObject<{
    disposition: z.ZodEnum<["CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "SIMILAR_ALLOWED"]>;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    disposition: "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "SIMILAR_ALLOWED";
    justification: string;
}, {
    disposition: "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "SIMILAR_ALLOWED";
    justification: string;
}>;
export type DuplicateDispositionInput = z.infer<typeof DuplicateDispositionSchema>;
export declare const ModeratorDecisionSchema: z.ZodObject<{
    decision: z.ZodEnum<["APPROVE", "REQUEST_CHANGES", "REJECT"]>;
    comments: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    totpToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
    comments: string;
    totpToken: string;
}, {
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
    totpToken: string;
    comments?: string | undefined;
}>;
export type ModeratorDecisionInput = z.infer<typeof ModeratorDecisionSchema>;
export declare const ReassignReviewerSchema: z.ZodObject<{
    assignmentId: z.ZodString;
    newReviewerId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    assignmentId: string;
    newReviewerId: string;
    reason: string;
}, {
    assignmentId: string;
    newReviewerId: string;
    reason: string;
}>;
export type ReassignReviewerInput = z.infer<typeof ReassignReviewerSchema>;
export declare const RetireQuestionSchema: z.ZodObject<{
    reason: z.ZodEnum<["SUPERSEDED", "OUTDATED_SYLLABUS", "ERRONEOUS_CONTENT", "OTHER"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: "SUPERSEDED" | "OUTDATED_SYLLABUS" | "ERRONEOUS_CONTENT" | "OTHER";
    note: string;
}, {
    reason: "SUPERSEDED" | "OUTDATED_SYLLABUS" | "ERRONEOUS_CONTENT" | "OTHER";
    note: string;
}>;
export type RetireQuestionInput = z.infer<typeof RetireQuestionSchema>;
export declare const DifficultyResolutionAction: z.ZodEnum<["ACCEPT_MEAN", "SET_FINAL_VALUE", "REQUEST_THIRD_REVIEW", "REQUEST_CHANGES"]>;
export type DifficultyResolutionAction = z.infer<typeof DifficultyResolutionAction>;
export declare const ResolveDifficultyConflictSchema: z.ZodObject<{
    action: z.ZodEnum<["ACCEPT_MEAN", "SET_FINAL_VALUE", "REQUEST_THIRD_REVIEW", "REQUEST_CHANGES"]>;
    customValue: z.ZodOptional<z.ZodNumber>;
    customTimingSeconds: z.ZodOptional<z.ZodNumber>;
    autoApprove: z.ZodOptional<z.ZodBoolean>;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "REQUEST_CHANGES" | "ACCEPT_MEAN" | "SET_FINAL_VALUE" | "REQUEST_THIRD_REVIEW";
    justification: string;
    customValue?: number | undefined;
    customTimingSeconds?: number | undefined;
    autoApprove?: boolean | undefined;
}, {
    action: "REQUEST_CHANGES" | "ACCEPT_MEAN" | "SET_FINAL_VALUE" | "REQUEST_THIRD_REVIEW";
    justification: string;
    customValue?: number | undefined;
    customTimingSeconds?: number | undefined;
    autoApprove?: boolean | undefined;
}>;
export type ResolveDifficultyConflictInput = z.infer<typeof ResolveDifficultyConflictSchema>;
export declare const CreateNewVersionSchema: z.ZodObject<{
    parentVersionId: z.ZodString;
    changeJustification: z.ZodString;
    content: z.ZodObject<{
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        stem: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            text: z.ZodString;
            imageId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }, {
            label: string;
            text: string;
            imageId?: string | undefined;
        }>, "many">>;
        imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        solution: z.ZodOptional<z.ZodString>;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    }>;
    answerKey: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"MCQ_SINGLE">;
        correct: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE";
        correct: string;
    }, {
        type: "MCQ_SINGLE";
        correct: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"MCQ_MULTI">;
        correct: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_MULTI";
        correct: string[];
    }, {
        type: "MCQ_MULTI";
        correct: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"INTEGER">;
        correct: z.ZodNumber;
        tolerance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    }, {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    }>]>;
    metadata: z.ZodObject<{
        subjectId: z.ZodString;
        topicId: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
        difficulty: z.ZodNumber;
        cognitiveLevel: z.ZodEnum<["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]>;
        marks: z.ZodNumber;
        negativeMarks: z.ZodDefault<z.ZodNumber>;
        estimatedTimeSeconds: z.ZodNumber;
        language: z.ZodDefault<z.ZodEnum<["EN", "HI", "BILINGUAL"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    }, {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        language: "EN" | "HI" | "BILINGUAL";
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance: number;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        language: "EN" | "HI" | "BILINGUAL";
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        negativeMarks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        subtopicId?: string | undefined;
    };
    parentVersionId: string;
    changeJustification: string;
}, {
    content: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        stem: string;
        options?: {
            label: string;
            text: string;
            imageId?: string | undefined;
        }[] | undefined;
        imageIds?: string[] | undefined;
        solution?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
    };
    answerKey: {
        type: "MCQ_SINGLE";
        correct: string;
    } | {
        type: "MCQ_MULTI";
        correct: string[];
    } | {
        type: "INTEGER";
        correct: number;
        tolerance?: number | undefined;
    };
    metadata: {
        type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
        subjectId: string;
        difficulty: number;
        cognitiveLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        marks: number;
        estimatedTimeSeconds: number;
        topicId?: string | undefined;
        language?: "EN" | "HI" | "BILINGUAL" | undefined;
        subtopicId?: string | undefined;
        negativeMarks?: number | undefined;
    };
    parentVersionId: string;
    changeJustification: string;
}>;
export type CreateNewVersionInput = z.infer<typeof CreateNewVersionSchema>;
export declare const ConflictDeclarationSchema: z.ZodObject<{
    conflictType: z.ZodEnum<["INSTITUTION", "COACHING_CENTRE", "PERSON", "SOURCE"]>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    conflictType: "INSTITUTION" | "COACHING_CENTRE" | "PERSON" | "SOURCE";
}, {
    description: string;
    conflictType: "INSTITUTION" | "COACHING_CENTRE" | "PERSON" | "SOURCE";
}>;
export type ConflictDeclarationInput = z.infer<typeof ConflictDeclarationSchema>;
export declare const CorpusImportSchema: z.ZodObject<{
    name: z.ZodString;
    sourceType: z.ZodEnum<["PAST_PAPER", "PUBLIC"]>;
    licenseNote: z.ZodOptional<z.ZodString>;
    documents: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        identifier: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        title: string;
        identifier: string;
    }, {
        content: string;
        title: string;
        identifier: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    sourceType: "PAST_PAPER" | "PUBLIC";
    documents: {
        content: string;
        title: string;
        identifier: string;
    }[];
    licenseNote?: string | undefined;
}, {
    name: string;
    sourceType: "PAST_PAPER" | "PUBLIC";
    documents: {
        content: string;
        title: string;
        identifier: string;
    }[];
    licenseNote?: string | undefined;
}>;
export type CorpusImportInput = z.infer<typeof CorpusImportSchema>;
export declare const ApprovalRecordSchema: z.ZodObject<{
    id: z.ZodString;
    questionId: z.ZodString;
    versionNo: z.ZodNumber;
    contentCommitment: z.ZodString;
    decision: z.ZodString;
    role: z.ZodString;
    approverId: z.ZodString;
    reviewRound: z.ZodNumber;
    policyVersion: z.ZodNumber;
    timestamp: z.ZodString;
    signature: z.ZodString;
    validSignature: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    role: string;
    id: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    timestamp: string;
    signature: string;
    decision: string;
    approverId: string;
    reviewRound: number;
    policyVersion: number;
    validSignature: boolean;
}, {
    role: string;
    id: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    timestamp: string;
    signature: string;
    decision: string;
    approverId: string;
    reviewRound: number;
    policyVersion: number;
    validSignature: boolean;
}>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export declare const ApprovalVerificationResponseSchema: z.ZodObject<{
    questionId: z.ZodString;
    versionNo: z.ZodNumber;
    contentCommitment: z.ZodString;
    approvals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        questionId: z.ZodString;
        versionNo: z.ZodNumber;
        contentCommitment: z.ZodString;
        decision: z.ZodString;
        role: z.ZodString;
        approverId: z.ZodString;
        reviewRound: z.ZodNumber;
        policyVersion: z.ZodNumber;
        timestamp: z.ZodString;
        signature: z.ZodString;
        validSignature: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        role: string;
        id: string;
        questionId: string;
        versionNo: number;
        contentCommitment: string;
        timestamp: string;
        signature: string;
        decision: string;
        approverId: string;
        reviewRound: number;
        policyVersion: number;
        validSignature: boolean;
    }, {
        role: string;
        id: string;
        questionId: string;
        versionNo: number;
        contentCommitment: string;
        timestamp: string;
        signature: string;
        decision: string;
        approverId: string;
        reviewRound: number;
        policyVersion: number;
        validSignature: boolean;
    }>, "many">;
    allSignaturesValid: z.ZodBoolean;
    meetsPolicyRequirements: z.ZodBoolean;
    isEligible: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    approvals: {
        role: string;
        id: string;
        questionId: string;
        versionNo: number;
        contentCommitment: string;
        timestamp: string;
        signature: string;
        decision: string;
        approverId: string;
        reviewRound: number;
        policyVersion: number;
        validSignature: boolean;
    }[];
    allSignaturesValid: boolean;
    meetsPolicyRequirements: boolean;
    isEligible: boolean;
}, {
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    approvals: {
        role: string;
        id: string;
        questionId: string;
        versionNo: number;
        contentCommitment: string;
        timestamp: string;
        signature: string;
        decision: string;
        approverId: string;
        reviewRound: number;
        policyVersion: number;
        validSignature: boolean;
    }[];
    allSignaturesValid: boolean;
    meetsPolicyRequirements: boolean;
    isEligible: boolean;
}>;
export type ApprovalVerificationResponse = z.infer<typeof ApprovalVerificationResponseSchema>;
export declare const EligibleQuestionSchema: z.ZodObject<{
    questionId: z.ZodString;
    versionId: z.ZodString;
    humanId: z.ZodString;
    versionNo: z.ZodNumber;
    subjectId: z.ZodString;
    topicId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>;
    difficulty: z.ZodNumber;
    marks: z.ZodNumber;
    negativeMarks: z.ZodNumber;
    contentCommitment: z.ZodString;
    approvedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    subjectId: string;
    difficulty: number;
    marks: number;
    negativeMarks: number;
    humanId: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    versionId: string;
    approvedAt: string;
    topicId?: string | null | undefined;
}, {
    type: "MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER";
    subjectId: string;
    difficulty: number;
    marks: number;
    negativeMarks: number;
    humanId: string;
    questionId: string;
    versionNo: number;
    contentCommitment: string;
    versionId: string;
    approvedAt: string;
    topicId?: string | null | undefined;
}>;
export type EligibleQuestion = z.infer<typeof EligibleQuestionSchema>;
//# sourceMappingURL=schemas.d.ts.map