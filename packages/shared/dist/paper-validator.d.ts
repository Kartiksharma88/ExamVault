import { Blueprint } from './blueprint.schema';
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
        sectionSummaries: Record<string, {
            count: number;
            totalMarks: number;
            difficultyBins: {
                EASY: number;
                MEDIUM: number;
                HARD: number;
            };
        }>;
    };
}
export declare function getDifficultyBinName(diff: number): 'EASY' | 'MEDIUM' | 'HARD';
/**
 * Independent Paper Validator (TypeScript)
 * Shares NO code with the Python CP-SAT solver.
 * Verifies all blueprint requirements, eligibility, exclusion groups, and exposure constraints.
 */
export declare function validatePaper(blueprint: Blueprint, selectedIds: string[], candidatePool: CandidateMetadata[], recentPaperHandles?: string[][]): ValidationResult;
//# sourceMappingURL=paper-validator.d.ts.map