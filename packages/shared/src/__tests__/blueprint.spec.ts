import {
  BlueprintSchema,
  validateBlueprintConsistency,
  DifficultyBinConfigSchema,
} from '../blueprint.schema';

describe('Blueprint Validation (Section 4 & User Constraints)', () => {
  const validBlueprint = {
    examId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    name: 'JEE Advanced Physics & Chemistry 2026',
    durationSeconds: 10800, // 3 hours
    totalQuestions: 5,
    totalMarks: 20,
    sections: [
      {
        code: 'SEC-A',
        name: 'Physics Section A',
        subjectId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        allowedQuestionTypes: ['MCQ_SINGLE', 'MCQ_MULTI'],
        count: 5,
        totalMarks: 20,
        negativeMarksAllowed: true,
        topicQuotas: [
          {
            topicId: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
            min: 1,
            max: 3,
          },
        ],
        // User custom difficulty setting: 2 Easy, 1 Medium, 2 Hard
        difficultyBins: {
          EASY: { min: 2, max: 2 },
          MEDIUM: { min: 1, max: 1 },
          HARD: { min: 2, max: 2 },
        },
        allowedMarksValues: [2, 4],
      },
    ],
    difficulty: {
      targetMean: 50,
      meanTolerance: 5,
    },
    time: {
      minRatio: 0.8,
      maxRatio: 1.1,
    },
    exposure: {
      maxTotalUses: 3,
      cooldownPapers: 2,
      overlap: {
        recentPapersM: 3,
        maxSharedQuestionsPerPaper: 1,
      },
    },
    sets: {
      count: 2, // Sets A and B
    },
    solver: {
      timeLimitSeconds: 60,
      requireOptimal: false,
      minPoolMultiplier: 2.0,
    },
    csv: {
      bom: true,
      formulaGuard: true,
      profileDefault: 'GENERIC_CSV',
      includeSolutions: false,
    },
  };

  it('validates a correct blueprint with custom difficulty bins (2 Easy, 1 Medium, 2 Hard)', () => {
    const parsed = BlueprintSchema.parse(validBlueprint);
    expect(parsed.totalQuestions).toBe(5);
    expect(parsed.sections[0].difficultyBins.EASY.min).toBe(2);
    expect(parsed.sections[0].difficultyBins.MEDIUM.min).toBe(1);
    expect(parsed.sections[0].difficultyBins.HARD.min).toBe(2);

    const consistencyErrors = validateBlueprintConsistency(parsed);
    expect(consistencyErrors).toEqual([]);
  });

  it('rejects when sum of section counts does not equal totalQuestions', () => {
    const invalid = {
      ...validBlueprint,
      totalQuestions: 10, // sections only sum to 5
    };
    const parsed = BlueprintSchema.parse(invalid);
    const errors = validateBlueprintConsistency(parsed);
    expect(errors).toContain('Sum of section counts (5) does not equal totalQuestions (10)');
  });

  it('rejects when sum of section totalMarks does not equal totalMarks', () => {
    const invalid = {
      ...validBlueprint,
      totalMarks: 100, // sections sum to 20
    };
    const parsed = BlueprintSchema.parse(invalid);
    const errors = validateBlueprintConsistency(parsed);
    expect(errors).toContain('Sum of section marks (20) does not equal totalMarks (100)');
  });

  it('rejects inconsistent difficulty bin counts (sum of mins > count)', () => {
    const invalid = {
      ...validBlueprint,
      sections: [
        {
          ...validBlueprint.sections[0],
          difficultyBins: {
            EASY: { min: 3, max: 3 },
            MEDIUM: { min: 3, max: 3 },
            HARD: { min: 3, max: 3 }, // sum of mins = 9 > count 5
          },
        },
      ],
    };
    const parsed = BlueprintSchema.parse(invalid);
    const errors = validateBlueprintConsistency(parsed);
    expect(errors.some((e) => e.includes('Sum of difficulty bin minimums'))).toBe(true);
  });

  it('rejects topic quota min > max', () => {
    const invalid = {
      ...validBlueprint,
      sections: [
        {
          ...validBlueprint.sections[0],
          topicQuotas: [
            {
              topicId: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
              min: 5,
              max: 2, // min > max
            },
          ],
        },
      ],
    };
    expect(() => BlueprintSchema.parse(invalid)).toThrow();
  });

  it('rejects sets count outside 1 to 4', () => {
    const invalid = {
      ...validBlueprint,
      sets: { count: 5 },
    };
    expect(() => BlueprintSchema.parse(invalid)).toThrow();
  });
});

