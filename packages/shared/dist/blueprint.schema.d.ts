import { z } from 'zod';
export declare const DifficultyBinConfigSchema: z.ZodEffects<z.ZodObject<{
    min: z.ZodNumber;
    max: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    min: number;
    max: number;
}, {
    min: number;
    max: number;
}>, {
    min: number;
    max: number;
}, {
    min: number;
    max: number;
}>;
export declare const TopicQuotaSchema: z.ZodEffects<z.ZodObject<{
    topicId: z.ZodString;
    min: z.ZodNumber;
    max: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    topicId: string;
    min: number;
    max: number;
}, {
    topicId: string;
    min: number;
    max: number;
}>, {
    topicId: string;
    min: number;
    max: number;
}, {
    topicId: string;
    min: number;
    max: number;
}>;
export declare const SectionSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    subjectId: z.ZodString;
    allowedQuestionTypes: z.ZodArray<z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>, "many">;
    count: z.ZodNumber;
    totalMarks: z.ZodNumber;
    negativeMarksAllowed: z.ZodDefault<z.ZodBoolean>;
    topicQuotas: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        topicId: z.ZodString;
        min: z.ZodNumber;
        max: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        topicId: string;
        min: number;
        max: number;
    }, {
        topicId: string;
        min: number;
        max: number;
    }>, {
        topicId: string;
        min: number;
        max: number;
    }, {
        topicId: string;
        min: number;
        max: number;
    }>, "many">>;
    difficultyBins: z.ZodObject<{
        EASY: z.ZodEffects<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>;
        MEDIUM: z.ZodEffects<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>;
        HARD: z.ZodEffects<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        MEDIUM: {
            min: number;
            max: number;
        };
        EASY: {
            min: number;
            max: number;
        };
        HARD: {
            min: number;
            max: number;
        };
    }, {
        MEDIUM: {
            min: number;
            max: number;
        };
        EASY: {
            min: number;
            max: number;
        };
        HARD: {
            min: number;
            max: number;
        };
    }>;
    allowedMarksValues: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    subjectId: string;
    count: number;
    allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
    totalMarks: number;
    negativeMarksAllowed: boolean;
    topicQuotas: {
        topicId: string;
        min: number;
        max: number;
    }[];
    difficultyBins: {
        MEDIUM: {
            min: number;
            max: number;
        };
        EASY: {
            min: number;
            max: number;
        };
        HARD: {
            min: number;
            max: number;
        };
    };
    allowedMarksValues: number[];
}, {
    code: string;
    name: string;
    subjectId: string;
    count: number;
    allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
    totalMarks: number;
    difficultyBins: {
        MEDIUM: {
            min: number;
            max: number;
        };
        EASY: {
            min: number;
            max: number;
        };
        HARD: {
            min: number;
            max: number;
        };
    };
    allowedMarksValues: number[];
    negativeMarksAllowed?: boolean | undefined;
    topicQuotas?: {
        topicId: string;
        min: number;
        max: number;
    }[] | undefined;
}>;
export declare const BlueprintSchema: z.ZodObject<{
    examId: z.ZodString;
    name: z.ZodString;
    durationSeconds: z.ZodNumber;
    totalQuestions: z.ZodNumber;
    totalMarks: z.ZodNumber;
    sections: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        subjectId: z.ZodString;
        allowedQuestionTypes: z.ZodArray<z.ZodEnum<["MCQ_SINGLE", "MCQ_MULTI", "INTEGER"]>, "many">;
        count: z.ZodNumber;
        totalMarks: z.ZodNumber;
        negativeMarksAllowed: z.ZodDefault<z.ZodBoolean>;
        topicQuotas: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
            topicId: z.ZodString;
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            topicId: string;
            min: number;
            max: number;
        }, {
            topicId: string;
            min: number;
            max: number;
        }>, {
            topicId: string;
            min: number;
            max: number;
        }, {
            topicId: string;
            min: number;
            max: number;
        }>, "many">>;
        difficultyBins: z.ZodObject<{
            EASY: z.ZodEffects<z.ZodObject<{
                min: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>;
            MEDIUM: z.ZodEffects<z.ZodObject<{
                min: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>;
            HARD: z.ZodEffects<z.ZodObject<{
                min: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        }, {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        }>;
        allowedMarksValues: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        subjectId: string;
        count: number;
        allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
        totalMarks: number;
        negativeMarksAllowed: boolean;
        topicQuotas: {
            topicId: string;
            min: number;
            max: number;
        }[];
        difficultyBins: {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        };
        allowedMarksValues: number[];
    }, {
        code: string;
        name: string;
        subjectId: string;
        count: number;
        allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
        totalMarks: number;
        difficultyBins: {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        };
        allowedMarksValues: number[];
        negativeMarksAllowed?: boolean | undefined;
        topicQuotas?: {
            topicId: string;
            min: number;
            max: number;
        }[] | undefined;
    }>, "many">;
    difficulty: z.ZodObject<{
        targetMean: z.ZodNumber;
        meanTolerance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        targetMean: number;
        meanTolerance: number;
    }, {
        targetMean: number;
        meanTolerance?: number | undefined;
    }>;
    time: z.ZodObject<{
        minRatio: z.ZodDefault<z.ZodNumber>;
        maxRatio: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        minRatio: number;
        maxRatio: number;
    }, {
        minRatio?: number | undefined;
        maxRatio?: number | undefined;
    }>;
    exposure: z.ZodObject<{
        maxTotalUses: z.ZodDefault<z.ZodNumber>;
        cooldownPapers: z.ZodDefault<z.ZodNumber>;
        overlap: z.ZodObject<{
            recentPapersM: z.ZodDefault<z.ZodNumber>;
            maxSharedQuestionsPerPaper: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            recentPapersM: number;
            maxSharedQuestionsPerPaper: number;
        }, {
            recentPapersM?: number | undefined;
            maxSharedQuestionsPerPaper?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        maxTotalUses: number;
        cooldownPapers: number;
        overlap: {
            recentPapersM: number;
            maxSharedQuestionsPerPaper: number;
        };
    }, {
        overlap: {
            recentPapersM?: number | undefined;
            maxSharedQuestionsPerPaper?: number | undefined;
        };
        maxTotalUses?: number | undefined;
        cooldownPapers?: number | undefined;
    }>;
    sets: z.ZodObject<{
        count: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        count: number;
    }, {
        count?: number | undefined;
    }>;
    solver: z.ZodObject<{
        timeLimitSeconds: z.ZodDefault<z.ZodNumber>;
        requireOptimal: z.ZodDefault<z.ZodBoolean>;
        minPoolMultiplier: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeLimitSeconds: number;
        requireOptimal: boolean;
        minPoolMultiplier: number;
    }, {
        timeLimitSeconds?: number | undefined;
        requireOptimal?: boolean | undefined;
        minPoolMultiplier?: number | undefined;
    }>;
    csv: z.ZodObject<{
        bom: z.ZodDefault<z.ZodBoolean>;
        formulaGuard: z.ZodDefault<z.ZodBoolean>;
        profileDefault: z.ZodDefault<z.ZodString>;
        includeSolutions: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        bom: boolean;
        formulaGuard: boolean;
        profileDefault: string;
        includeSolutions: boolean;
    }, {
        bom?: boolean | undefined;
        formulaGuard?: boolean | undefined;
        profileDefault?: string | undefined;
        includeSolutions?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    examId: string;
    difficulty: {
        targetMean: number;
        meanTolerance: number;
    };
    totalQuestions: number;
    totalMarks: number;
    durationSeconds: number;
    sections: {
        code: string;
        name: string;
        subjectId: string;
        count: number;
        allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
        totalMarks: number;
        negativeMarksAllowed: boolean;
        topicQuotas: {
            topicId: string;
            min: number;
            max: number;
        }[];
        difficultyBins: {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        };
        allowedMarksValues: number[];
    }[];
    time: {
        minRatio: number;
        maxRatio: number;
    };
    exposure: {
        maxTotalUses: number;
        cooldownPapers: number;
        overlap: {
            recentPapersM: number;
            maxSharedQuestionsPerPaper: number;
        };
    };
    sets: {
        count: number;
    };
    solver: {
        timeLimitSeconds: number;
        requireOptimal: boolean;
        minPoolMultiplier: number;
    };
    csv: {
        bom: boolean;
        formulaGuard: boolean;
        profileDefault: string;
        includeSolutions: boolean;
    };
}, {
    name: string;
    examId: string;
    difficulty: {
        targetMean: number;
        meanTolerance?: number | undefined;
    };
    totalQuestions: number;
    totalMarks: number;
    durationSeconds: number;
    sections: {
        code: string;
        name: string;
        subjectId: string;
        count: number;
        allowedQuestionTypes: ("MCQ_SINGLE" | "MCQ_MULTI" | "INTEGER")[];
        totalMarks: number;
        difficultyBins: {
            MEDIUM: {
                min: number;
                max: number;
            };
            EASY: {
                min: number;
                max: number;
            };
            HARD: {
                min: number;
                max: number;
            };
        };
        allowedMarksValues: number[];
        negativeMarksAllowed?: boolean | undefined;
        topicQuotas?: {
            topicId: string;
            min: number;
            max: number;
        }[] | undefined;
    }[];
    time: {
        minRatio?: number | undefined;
        maxRatio?: number | undefined;
    };
    exposure: {
        overlap: {
            recentPapersM?: number | undefined;
            maxSharedQuestionsPerPaper?: number | undefined;
        };
        maxTotalUses?: number | undefined;
        cooldownPapers?: number | undefined;
    };
    sets: {
        count?: number | undefined;
    };
    solver: {
        timeLimitSeconds?: number | undefined;
        requireOptimal?: boolean | undefined;
        minPoolMultiplier?: number | undefined;
    };
    csv: {
        bom?: boolean | undefined;
        formulaGuard?: boolean | undefined;
        profileDefault?: string | undefined;
        includeSolutions?: boolean | undefined;
    };
}>;
export type Blueprint = z.infer<typeof BlueprintSchema>;
export type SectionConfig = z.infer<typeof SectionSchema>;
export type DifficultyBinConfig = z.infer<typeof DifficultyBinConfigSchema>;
export type TopicQuota = z.infer<typeof TopicQuotaSchema>;
/**
 * Validates cross-field consistency of a blueprint:
 * 1. Sum of section counts equals totalQuestions.
 * 2. Sum of section totalMarks equals totalMarks.
 * 3. Bin bounds are consistent: sum of mins <= count <= sum of maxes.
 * 4. Topic quota bounds are consistent: sum of mins <= count.
 */
export declare function validateBlueprintConsistency(blueprint: Blueprint): string[];
//# sourceMappingURL=blueprint.schema.d.ts.map