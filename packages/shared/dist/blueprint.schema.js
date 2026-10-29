"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueprintSchema = exports.SectionSchema = exports.TopicQuotaSchema = exports.DifficultyBinConfigSchema = void 0;
exports.validateBlueprintConsistency = validateBlueprintConsistency;
const zod_1 = require("zod");
exports.DifficultyBinConfigSchema = zod_1.z
    .object({
    min: zod_1.z.number().int().nonnegative(),
    max: zod_1.z.number().int().nonnegative(),
})
    .refine((data) => data.min <= data.max, {
    message: 'Difficulty bin min must be <= max',
});
exports.TopicQuotaSchema = zod_1.z
    .object({
    topicId: zod_1.z.string().uuid(),
    min: zod_1.z.number().int().nonnegative(),
    max: zod_1.z.number().int().nonnegative(),
})
    .refine((data) => data.min <= data.max, {
    message: 'Topic quota min must be <= max',
});
exports.SectionSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(20),
    name: zod_1.z.string().min(1).max(100),
    subjectId: zod_1.z.string().uuid(),
    allowedQuestionTypes: zod_1.z
        .array(zod_1.z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER']))
        .min(1),
    count: zod_1.z.number().int().positive(),
    totalMarks: zod_1.z.number().positive(),
    negativeMarksAllowed: zod_1.z.boolean().default(true),
    topicQuotas: zod_1.z.array(exports.TopicQuotaSchema).default([]),
    difficultyBins: zod_1.z.object({
        EASY: exports.DifficultyBinConfigSchema,
        MEDIUM: exports.DifficultyBinConfigSchema,
        HARD: exports.DifficultyBinConfigSchema,
    }),
    allowedMarksValues: zod_1.z.array(zod_1.z.number().positive()).min(1),
});
exports.BlueprintSchema = zod_1.z.object({
    examId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    durationSeconds: zod_1.z.number().int().positive(),
    totalQuestions: zod_1.z.number().int().positive(),
    totalMarks: zod_1.z.number().positive(),
    sections: zod_1.z.array(exports.SectionSchema).min(1),
    difficulty: zod_1.z.object({
        targetMean: zod_1.z.number().min(0).max(100),
        meanTolerance: zod_1.z.number().nonnegative().default(5.0),
    }),
    time: zod_1.z.object({
        minRatio: zod_1.z.number().positive().max(1.0).default(0.8),
        maxRatio: zod_1.z.number().min(1.0).default(1.1),
    }),
    exposure: zod_1.z.object({
        maxTotalUses: zod_1.z.number().int().positive().default(3),
        cooldownPapers: zod_1.z.number().int().nonnegative().default(2),
        overlap: zod_1.z.object({
            recentPapersM: zod_1.z.number().int().positive().default(3),
            maxSharedQuestionsPerPaper: zod_1.z.number().int().nonnegative().default(1),
        }),
    }),
    sets: zod_1.z.object({
        count: zod_1.z.number().int().min(1).max(4).default(1),
    }),
    solver: zod_1.z.object({
        timeLimitSeconds: zod_1.z.number().int().positive().default(60),
        requireOptimal: zod_1.z.boolean().default(false),
        minPoolMultiplier: zod_1.z.number().positive().default(2.0),
    }),
    csv: zod_1.z.object({
        bom: zod_1.z.boolean().default(true),
        formulaGuard: zod_1.z.boolean().default(true),
        profileDefault: zod_1.z.string().default('GENERIC_CSV'),
        includeSolutions: zod_1.z.boolean().default(false),
    }),
});
/**
 * Validates cross-field consistency of a blueprint:
 * 1. Sum of section counts equals totalQuestions.
 * 2. Sum of section totalMarks equals totalMarks.
 * 3. Bin bounds are consistent: sum of mins <= count <= sum of maxes.
 * 4. Topic quota bounds are consistent: sum of mins <= count.
 */
function validateBlueprintConsistency(blueprint) {
    const errors = [];
    const sumCounts = blueprint.sections.reduce((acc, s) => acc + s.count, 0);
    if (sumCounts !== blueprint.totalQuestions) {
        errors.push(`Sum of section counts (${sumCounts}) does not equal totalQuestions (${blueprint.totalQuestions})`);
    }
    const sumMarks = blueprint.sections.reduce((acc, s) => acc + s.totalMarks, 0);
    if (Math.abs(sumMarks - blueprint.totalMarks) > 0.001) {
        errors.push(`Sum of section marks (${sumMarks}) does not equal totalMarks (${blueprint.totalMarks})`);
    }
    for (const sec of blueprint.sections) {
        const minBins = sec.difficultyBins.EASY.min +
            sec.difficultyBins.MEDIUM.min +
            sec.difficultyBins.HARD.min;
        const maxBins = sec.difficultyBins.EASY.max +
            sec.difficultyBins.MEDIUM.max +
            sec.difficultyBins.HARD.max;
        if (minBins > sec.count) {
            errors.push(`Section ${sec.code}: Sum of difficulty bin minimums (${minBins}) exceeds section count (${sec.count})`);
        }
        if (maxBins < sec.count) {
            errors.push(`Section ${sec.code}: Sum of difficulty bin maximums (${maxBins}) is less than section count (${sec.count})`);
        }
        const minTopics = sec.topicQuotas.reduce((acc, t) => acc + t.min, 0);
        if (minTopics > sec.count) {
            errors.push(`Section ${sec.code}: Sum of topic quota minimums (${minTopics}) exceeds section count (${sec.count})`);
        }
    }
    return errors;
}
//# sourceMappingURL=blueprint.schema.js.map