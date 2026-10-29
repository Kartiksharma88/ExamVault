import { Blueprint, DifficultyBinConfig } from './blueprint.schema';

export interface CandidateMetadata {
  version_id: string;
  question_id: string;
  subject_id: string;
  section_code?: string;
  topic_id?: string;
  type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'INTEGER';
  marks: number;
  final_difficulty: number;
  final_time_seconds: number;
  exclusion_group_id?: string | null;
  total_uses?: number;
  papers_since_last_used?: number;
  reservation_handle?: string;
  is_eligible?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  summary: {
    totalQuestions: number;
    totalMarks: number;
    meanDifficulty: number;
    totalTimeSeconds: number;
    sectionSummaries: Record<
      string,
      {
        count: number;
        totalMarks: number;
        difficultyBins: { EASY: number; MEDIUM: number; HARD: number };
      }
    >;
  };
}

export function getDifficultyBinName(diff: number): 'EASY' | 'MEDIUM' | 'HARD' {
  const norm = diff <= 1.0 ? Math.round(diff * 100) : Math.round(diff);
  if (norm <= 33) return 'EASY';
  if (norm <= 66) return 'MEDIUM';
  return 'HARD';
}

/**
 * Independent Paper Validator (TypeScript)
 * Shares NO code with the Python CP-SAT solver.
 * Verifies all blueprint requirements, eligibility, exclusion groups, and exposure constraints.
 */
export function validatePaper(
  blueprint: Blueprint,
  selectedIds: string[],
  candidatePool: CandidateMetadata[],
  recentPaperHandles: string[][] = [],
): ValidationResult {
  const errors: string[] = [];

  const poolMap = new Map<string, CandidateMetadata>();
  for (const c of candidatePool) {
    poolMap.set(c.version_id, c);
  }

  // 1. All selected versions exist in candidate pool
  const selected: CandidateMetadata[] = [];
  for (const id of selectedIds) {
    const cand = poolMap.get(id);
    if (!cand) {
      errors.push(`Selected question version ${id} was not present in candidate pool snapshot`);
    } else {
      selected.push(cand);
    }
  }

  // 2. Total questions count
  if (selectedIds.length !== blueprint.totalQuestions) {
    errors.push(
      `Selected questions count (${selectedIds.length}) does not match blueprint totalQuestions (${blueprint.totalQuestions})`,
    );
  }

  // 3. No duplicates
  const seenIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  for (const c of selected) {
    if (seenIds.has(c.version_id)) {
      errors.push(`Duplicate version_id detected: ${c.version_id}`);
    }
    seenIds.add(c.version_id);

    if (seenQuestionIds.has(c.question_id)) {
      errors.push(`Multiple versions of the same question_id detected: ${c.question_id}`);
    }
    seenQuestionIds.add(c.question_id);
  }

  // 4. Total Marks
  const sumMarks = selected.reduce((acc, c) => acc + c.marks, 0);
  if (Math.abs(sumMarks - blueprint.totalMarks) > 0.001) {
    errors.push(
      `Total marks (${sumMarks}) does not equal blueprint totalMarks (${blueprint.totalMarks})`,
    );
  }

  // 5. Per Section validation
  const sectionSummaries: Record<string, any> = {};

  for (const sec of blueprint.sections) {
    const secQuestions = selected.filter(
      (c) => c.subject_id === sec.subjectId || c.section_code === sec.code,
    );

    if (secQuestions.length !== sec.count) {
      errors.push(
        `Section ${sec.code}: Question count (${secQuestions.length}) does not match requirement (${sec.count})`,
      );
    }

    const secMarks = secQuestions.reduce((acc, c) => acc + c.marks, 0);
    if (Math.abs(secMarks - sec.totalMarks) > 0.001) {
      errors.push(
        `Section ${sec.code}: Total marks (${secMarks}) does not match requirement (${sec.totalMarks})`,
      );
    }

    // Allowed question types
    for (const q of secQuestions) {
      if (!sec.allowedQuestionTypes.includes(q.type)) {
        errors.push(
          `Section ${sec.code}: Question ${q.version_id} has forbidden type ${q.type}`,
        );
      }
    }

    // Topic Quotas
    for (const tq of sec.topicQuotas) {
      const topicCount = secQuestions.filter((q) => q.topic_id === tq.topicId).length;
      if (topicCount < tq.min) {
        errors.push(
          `Section ${sec.code}: Topic ${tq.topicId} count (${topicCount}) is below min quota (${tq.min})`,
        );
      }
      if (topicCount > tq.max) {
        errors.push(
          `Section ${sec.code}: Topic ${tq.topicId} count (${topicCount}) exceeds max quota (${tq.max})`,
        );
      }
    }

    // Difficulty Bins
    const binCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of secQuestions) {
      const bin = getDifficultyBinName(q.final_difficulty);
      binCounts[bin]++;
    }

    for (const binName of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const binCfg: DifficultyBinConfig = sec.difficultyBins[binName];
      if (binCfg) {
        if (binCounts[binName] < binCfg.min) {
          errors.push(
            `Section ${sec.code}: Difficulty bin ${binName} count (${binCounts[binName]}) is below min (${binCfg.min})`,
          );
        }
        if (binCounts[binName] > binCfg.max) {
          errors.push(
            `Section ${sec.code}: Difficulty bin ${binName} count (${binCounts[binName]}) exceeds max (${binCfg.max})`,
          );
        }
      }
    }

    sectionSummaries[sec.code] = {
      count: secQuestions.length,
      totalMarks: secMarks,
      difficultyBins: binCounts,
    };
  }

  // 6. Overall Mean Difficulty
  const normDiffs = selected.map((c) =>
    c.final_difficulty <= 1.0
      ? Math.round(c.final_difficulty * 100)
      : Math.round(c.final_difficulty),
  );
  const meanDifficulty =
    normDiffs.length > 0
      ? Number((normDiffs.reduce((a, b) => a + b, 0) / normDiffs.length).toFixed(2))
      : 0;

  const targetMean = blueprint.difficulty.targetMean;
  const meanTol = blueprint.difficulty.meanTolerance;
  if (Math.abs(meanDifficulty - targetMean) > meanTol + 0.001) {
    errors.push(
      `Mean difficulty (${meanDifficulty}) exceeds target tolerance [${targetMean - meanTol}, ${targetMean + meanTol}]`,
    );
  }

  // 7. Total Time Bounds
  const totalTimeSeconds = selected.reduce((acc, c) => acc + (c.final_time_seconds || 120), 0);
  const minTime = Math.round(blueprint.time.minRatio * blueprint.durationSeconds);
  const maxTime = Math.round(blueprint.time.maxRatio * blueprint.durationSeconds);

  if (totalTimeSeconds < minTime) {
    errors.push(
      `Total estimated time (${totalTimeSeconds}s) is below min ratio threshold (${minTime}s)`,
    );
  }
  if (totalTimeSeconds > maxTime) {
    errors.push(
      `Total estimated time (${totalTimeSeconds}s) exceeds max ratio threshold (${maxTime}s)`,
    );
  }

  // 8. Exclusion Groups
  const groupCounts = new Map<string, number>();
  for (const c of selected) {
    if (c.exclusion_group_id) {
      const cur = groupCounts.get(c.exclusion_group_id) || 0;
      if (cur > 0) {
        errors.push(
          `Exclusion group collision: Multiple questions from group ${c.exclusion_group_id} selected`,
        );
      }
      groupCounts.set(c.exclusion_group_id, cur + 1);
    }
  }

  // 9. Exposure & Overlap
  for (const c of selected) {
    if (c.total_uses !== undefined && c.total_uses >= blueprint.exposure.maxTotalUses) {
      errors.push(
        `Question ${c.version_id} has exceeded maxTotalUses (${c.total_uses} >= ${blueprint.exposure.maxTotalUses})`,
      );
    }
    if (
      c.papers_since_last_used !== undefined &&
      c.papers_since_last_used < blueprint.exposure.cooldownPapers
    ) {
      errors.push(
        `Question ${c.version_id} has not met cooldownPapers requirement (${c.papers_since_last_used} < ${blueprint.exposure.cooldownPapers})`,
      );
    }
  }

  const maxShared = blueprint.exposure.overlap.maxSharedQuestionsPerPaper;
  for (let pIdx = 0; pIdx < recentPaperHandles.length; pIdx++) {
    const pastHandles = new Set(recentPaperHandles[pIdx]);
    let shared = 0;
    for (const c of selected) {
      if (
        (c.reservation_handle && pastHandles.has(c.reservation_handle)) ||
        pastHandles.has(c.question_id)
      ) {
        shared++;
      }
    }
    if (shared > maxShared) {
      errors.push(
        `Recent paper #${pIdx + 1} shared questions count (${shared}) exceeds maxShared limit (${maxShared})`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalQuestions: selectedIds.length,
      totalMarks: sumMarks,
      meanDifficulty,
      totalTimeSeconds,
      sectionSummaries,
    },
  };
}

