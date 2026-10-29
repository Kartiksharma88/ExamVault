import { validatePaper, CandidateMetadata } from '../paper-validator';
import { Blueprint } from '../blueprint.schema';

describe('Independent Paper Validator (Section 8 & Acceptance Criteria)', () => {
  const sampleBlueprint: Blueprint = {
    examId: '11111111-1111-1111-1111-111111111111',
    name: 'Sample Exam',
    durationSeconds: 600,
    totalQuestions: 5,
    totalMarks: 20,
    sections: [
      {
        code: 'SEC-1',
        name: 'Section 1',
        subjectId: '22222222-2222-2222-2222-222222222222',
        allowedQuestionTypes: ['MCQ_SINGLE', 'MCQ_MULTI'],
        count: 5,
        totalMarks: 20,
        negativeMarksAllowed: true,
        topicQuotas: [
          { topicId: '33333333-3333-3333-3333-333333333333', min: 1, max: 5 },
        ],
        difficultyBins: {
          EASY: { min: 2, max: 2 },
          MEDIUM: { min: 1, max: 1 },
          HARD: { min: 2, max: 2 },
        },
        allowedMarksValues: [4],
      },
    ],
    difficulty: {
      targetMean: 50,
      meanTolerance: 15,
    },
    time: {
      minRatio: 0.8,
      maxRatio: 1.2,
    },
    exposure: {
      maxTotalUses: 3,
      cooldownPapers: 1,
      overlap: {
        recentPapersM: 2,
        maxSharedQuestionsPerPaper: 1,
      },
    },
    sets: { count: 1 },
    solver: {
      timeLimitSeconds: 10,
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

  const pool: CandidateMetadata[] = [
    {
      version_id: 'e1',
      question_id: 'q-e1',
      subject_id: '22222222-2222-2222-2222-222222222222',
      topic_id: '33333333-3333-3333-3333-333333333333',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 20,
      final_time_seconds: 120,
      total_uses: 0,
      papers_since_last_used: 5,
    },
    {
      version_id: 'e2',
      question_id: 'q-e2',
      subject_id: '22222222-2222-2222-2222-222222222222',
      topic_id: '33333333-3333-3333-3333-333333333333',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 30,
      final_time_seconds: 120,
      total_uses: 0,
      papers_since_last_used: 5,
    },
    {
      version_id: 'm1',
      question_id: 'q-m1',
      subject_id: '22222222-2222-2222-2222-222222222222',
      topic_id: '33333333-3333-3333-3333-333333333333',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 50,
      final_time_seconds: 120,
      total_uses: 0,
      papers_since_last_used: 5,
    },
    {
      version_id: 'h1',
      question_id: 'q-h1',
      subject_id: '22222222-2222-2222-2222-222222222222',
      topic_id: '33333333-3333-3333-3333-333333333333',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 75,
      final_time_seconds: 120,
      total_uses: 0,
      papers_since_last_used: 5,
    },
    {
      version_id: 'h2',
      question_id: 'q-h2',
      subject_id: '22222222-2222-2222-2222-222222222222',
      topic_id: '33333333-3333-3333-3333-333333333333',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 80,
      final_time_seconds: 120,
      total_uses: 0,
      papers_since_last_used: 5,
    },
  ];

  it('validates a completely feasible paper selection matching 2 Easy, 1 Medium, 2 Hard', () => {
    const selected = ['e1', 'e2', 'm1', 'h1', 'h2'];
    const result = validatePaper(sampleBlueprint, selected, pool);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary.totalQuestions).toBe(5);
    expect(result.summary.totalMarks).toBe(20);
    expect(result.summary.sectionSummaries['SEC-1'].difficultyBins.EASY).toBe(2);
    expect(result.summary.sectionSummaries['SEC-1'].difficultyBins.MEDIUM).toBe(1);
    expect(result.summary.sectionSummaries['SEC-1'].difficultyBins.HARD).toBe(2);
  });

  it('fails validation when difficulty bin distribution does not match blueprint requirement', () => {
    // If pool replaces hard with an easy, so we have 3 Easy, 1 Medium, 1 Hard
    const poolTampered = [
      ...pool.slice(0, 4),
      {
        ...pool[4],
        final_difficulty: 25, // Easy instead of Hard
      },
    ];

    const selected = ['e1', 'e2', 'm1', 'h1', 'h2'];
    const result = validatePaper(sampleBlueprint, selected, poolTampered);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Difficulty bin EASY count (3) exceeds max (2)'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Difficulty bin HARD count (1) is below min (2)'))).toBe(true);
  });

  it('fails validation on exclusion group collision', () => {
    const poolWithCollision = [
      { ...pool[0], exclusion_group_id: 'EXCL_GRP_ALPHA' },
      { ...pool[1], exclusion_group_id: 'EXCL_GRP_ALPHA' }, // Colliding group!
      pool[2],
      pool[3],
      pool[4],
    ];

    const selected = ['e1', 'e2', 'm1', 'h1', 'h2'];
    const result = validatePaper(sampleBlueprint, selected, poolWithCollision);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Exclusion group collision'))).toBe(true);
  });

  it('fails validation when total marks do not match blueprint totalMarks', () => {
    const poolWithWrongMarks = [
      { ...pool[0], marks: 2 }, // Total marks will be 18 instead of 20
      pool[1],
      pool[2],
      pool[3],
      pool[4],
    ];

    const selected = ['e1', 'e2', 'm1', 'h1', 'h2'];
    const result = validatePaper(sampleBlueprint, selected, poolWithWrongMarks);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Total marks (18) does not equal blueprint totalMarks (20)'))).toBe(true);
  });
});

