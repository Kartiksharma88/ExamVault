import { z } from 'zod';

export const DifficultyBinConfigSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((data) => data.min <= data.max, {
    message: 'Difficulty bin min must be <= max',
  });

export const TopicQuotaSchema = z
  .object({
    topicId: z.string().uuid(),
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((data) => data.min <= data.max, {
    message: 'Topic quota min must be <= max',
  });

export const SectionSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  subjectId: z.string().uuid(),
  allowedQuestionTypes: z
    .array(z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER']))
    .min(1),
  count: z.number().int().positive(),
  totalMarks: z.number().positive(),
  negativeMarksAllowed: z.boolean().default(true),
  topicQuotas: z.array(TopicQuotaSchema).default([]),
  difficultyBins: z.object({
    EASY: DifficultyBinConfigSchema,
    MEDIUM: DifficultyBinConfigSchema,
    HARD: DifficultyBinConfigSchema,
  }),
  allowedMarksValues: z.array(z.number().positive()).min(1),
});

export const BlueprintSchema = z.object({
  examId: z.string().uuid(),
  name: z.string().min(1).max(255),
  durationSeconds: z.number().int().positive(),
  totalQuestions: z.number().int().positive(),
  totalMarks: z.number().positive(),
  sections: z.array(SectionSchema).min(1),
  difficulty: z.object({
    targetMean: z.number().min(0).max(100),
    meanTolerance: z.number().nonnegative().default(5.0),
  }),
  time: z.object({
    minRatio: z.number().positive().max(1.0).default(0.8),
    maxRatio: z.number().min(1.0).default(1.1),
  }),
  exposure: z.object({
    maxTotalUses: z.number().int().positive().default(3),
    cooldownPapers: z.number().int().nonnegative().default(2),
    overlap: z.object({
      recentPapersM: z.number().int().positive().default(3),
      maxSharedQuestionsPerPaper: z.number().int().nonnegative().default(1),
    }),
  }),
  sets: z.object({
    count: z.number().int().min(1).max(4).default(1),
  }),
  solver: z.object({
    timeLimitSeconds: z.number().int().positive().default(60),
    requireOptimal: z.boolean().default(false),
    minPoolMultiplier: z.number().positive().default(2.0),
  }),
  csv: z.object({
    bom: z.boolean().default(true),
    formulaGuard: z.boolean().default(true),
    profileDefault: z.string().default('GENERIC_CSV'),
    includeSolutions: z.boolean().default(false),
  }),
});

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
export function validateBlueprintConsistency(blueprint: Blueprint): string[] {
  const errors: string[] = [];

  const sumCounts = blueprint.sections.reduce((acc, s) => acc + s.count, 0);
  if (sumCounts !== blueprint.totalQuestions) {
    errors.push(
      `Sum of section counts (${sumCounts}) does not equal totalQuestions (${blueprint.totalQuestions})`,
    );
  }

  const sumMarks = blueprint.sections.reduce((acc, s) => acc + s.totalMarks, 0);
  if (Math.abs(sumMarks - blueprint.totalMarks) > 0.001) {
    errors.push(
      `Sum of section marks (${sumMarks}) does not equal totalMarks (${blueprint.totalMarks})`,
    );
  }

  for (const sec of blueprint.sections) {
    const minBins =
      sec.difficultyBins.EASY.min +
      sec.difficultyBins.MEDIUM.min +
      sec.difficultyBins.HARD.min;
    const maxBins =
      sec.difficultyBins.EASY.max +
      sec.difficultyBins.MEDIUM.max +
      sec.difficultyBins.HARD.max;

    if (minBins > sec.count) {
      errors.push(
        `Section ${sec.code}: Sum of difficulty bin minimums (${minBins}) exceeds section count (${sec.count})`,
      );
    }
    if (maxBins < sec.count) {
      errors.push(
        `Section ${sec.code}: Sum of difficulty bin maximums (${maxBins}) is less than section count (${sec.count})`,
      );
    }

    const minTopics = sec.topicQuotas.reduce((acc, t) => acc + t.min, 0);
    if (minTopics > sec.count) {
      errors.push(
        `Section ${sec.code}: Sum of topic quota minimums (${minTopics}) exceeds section count (${sec.count})`,
      );
    }
  }

  return errors;
}

