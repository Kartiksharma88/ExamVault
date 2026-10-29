"""
Paper Selector Model using Google OR-Tools CP-SAT
Deterministic, difficulty-aware, constrained examination paper selection.
"""

from typing import List, Dict, Any, Optional, Tuple
import hashlib
import hmac
import time
from ortools.sat.python import cp_model


def compute_pseudo_random_cost(seed_hex: str, item_id: str) -> int:
    """Computes a deterministic 0..999 integer from HMAC-SHA256(seed, item_id)."""
    seed_bytes = bytes.fromhex(seed_hex)
    h = hmac.new(seed_bytes, item_id.encode('utf-8'), hashlib.sha256).digest()
    val = int.from_bytes(h[:4], 'big')
    return val % 1000


def normalize_difficulty(val: Optional[float]) -> int:
    """Normalizes difficulty to 0..100 integer scale."""
    if val is None:
        return 50
    if val <= 1.0:
        return int(round(val * 100))
    return int(round(val))


def get_difficulty_bin(diff_int: int) -> str:
    """EASY: 0-33, MEDIUM: 34-66, HARD: 67-100"""
    if diff_int <= 33:
        return 'EASY'
    elif diff_int <= 66:
        return 'MEDIUM'
    return 'HARD'


class EarlyStopSolutionCallback(cp_model.CpSolverSolutionCallback):
    """Early stopping callback when require_optimal is False to meet strict SLA."""
    def __init__(self, diff_dev_var, max_seconds_after_first: float = 0.5):
        super().__init__()
        self.diff_dev_var = diff_dev_var
        self.max_seconds_after_first = max_seconds_after_first
        self.first_sol_time = None
        self.solutions = 0

    def on_solution_callback(self):
        self.solutions += 1
        now = time.time()
        if self.first_sol_time is None:
            self.first_sol_time = now
        dev = self.Value(self.diff_dev_var)
        # If target difficulty deviation is 0 and we've gathered >= 2 solutions or 0.1s
        if dev == 0 and (now - self.first_sol_time >= 0.1 or self.solutions >= 2):
            self.StopSearch()
        elif now - self.first_sol_time >= self.max_seconds_after_first:
            self.StopSearch()


class PaperSelector:
    def __init__(
        self,
        blueprint: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        seed: str,
        recent_paper_handles: Optional[List[List[str]]] = None,
    ):
        self.blueprint = blueprint
        exp_cfg = blueprint.get('exposure', {})
        max_uses = exp_cfg.get('maxTotalUses', 1000)
        cooldown_papers = exp_cfg.get('cooldownPapers', 0)

        # Candidate pool filtering: exclude not eligible, exclude total_uses >= max_total_uses, exclude used in cooldown_papers
        self.candidates = sorted([
            c for c in candidates
            if c.get('is_eligible', True)
            and c.get('total_uses', 0) < max_uses
            and c.get('papers_since_last_used', 999) >= cooldown_papers
        ], key=lambda c: c['version_id'])
        self.seed = seed
        self.recent_paper_handles = recent_paper_handles or []
        self.solver_params = {
            'num_workers': int(blueprint.get('solver', {}).get('numWorkers', 4)),
            'random_seed': 42,
            'max_time_in_seconds': float(blueprint.get('solver', {}).get('timeLimitSeconds', 60)),
        }

    def solve(self, relaxed_groups: Optional[List[str]] = None) -> Tuple[str, Optional[List[str]], Dict[str, Any]]:
        relaxed = set(relaxed_groups or [])
        model = cp_model.CpModel()
        n = len(self.candidates)
        if n == 0:
            return 'INFEASIBLE', None, {'reason': 'Candidate pool is empty'}

        # Boolean variable per candidate
        x = [model.NewBoolVar(f"x_{i}") for i in range(n)]

        total_questions = self.blueprint['totalQuestions']
        total_marks = int(round(self.blueprint['totalMarks'] * 100))
        duration_seconds = self.blueprint['durationSeconds']

        # 1. Total Questions & Marks
        model.Add(sum(x) == total_questions)

        cand_marks_scaled = [int(round(c.get('marks', 1.0) * 100)) for c in self.candidates]
        model.Add(sum(x[i] * cand_marks_scaled[i] for i in range(n)) == total_marks)

        # 2. Section Constraints
        for sec in self.blueprint['sections']:
            sec_count = sec['count']
            sec_marks_scaled = int(round(sec['totalMarks'] * 100))
            sec_indices = [
                i for i, c in enumerate(self.candidates)
                if c.get('subject_id') == sec.get('subjectId') or c.get('section_code') == sec.get('code')
            ]

            # Allowed types
            allowed_types = set(sec['allowedQuestionTypes'])
            for i in sec_indices:
                if self.candidates[i].get('type') not in allowed_types:
                    model.Add(x[i] == 0)

            model.Add(sum(x[i] for i in sec_indices) == sec_count)
            model.Add(sum(x[i] * cand_marks_scaled[i] for i in sec_indices) == sec_marks_scaled)

            # Topic Quotas
            if 'TOPIC_QUOTAS' not in relaxed:
                for tq in sec.get('topicQuotas', []):
                    t_indices = [i for i in sec_indices if self.candidates[i].get('topic_id') == tq['topicId']]
                    model.Add(sum(x[i] for i in t_indices) >= tq['min'])
                    model.Add(sum(x[i] for i in t_indices) <= tq['max'])

            # Difficulty Bins (EASY, MEDIUM, HARD)
            if 'DIFFICULTY_BINS' not in relaxed:
                diff_bins = sec.get('difficultyBins', {})
                for bin_name in ['EASY', 'MEDIUM', 'HARD']:
                    if bin_name in diff_bins:
                        b_cfg = diff_bins[bin_name]
                        b_indices = [
                            i for i in sec_indices
                            if get_difficulty_bin(normalize_difficulty(self.candidates[i].get('final_difficulty'))) == bin_name
                        ]
                        model.Add(sum(x[i] for i in b_indices) >= b_cfg['min'])
                        model.Add(sum(x[i] for i in b_indices) <= b_cfg['max'])

        # 3. Overall Mean Difficulty
        diff_cfg = self.blueprint.get('difficulty', {})
        target_mean = diff_cfg.get('targetMean', 50)
        mean_tol = diff_cfg.get('meanTolerance', 5.0)

        cand_diff_norm = [normalize_difficulty(c.get('final_difficulty')) for c in self.candidates]
        if 'MEAN_DIFFICULTY' not in relaxed:
            min_diff_sum = int(round((target_mean - mean_tol) * total_questions))
            max_diff_sum = int(round((target_mean + mean_tol) * total_questions))
            model.Add(sum(x[i] * cand_diff_norm[i] for i in range(n)) >= min_diff_sum)
            model.Add(sum(x[i] * cand_diff_norm[i] for i in range(n)) <= max_diff_sum)

        # 4. Total Time
        time_cfg = self.blueprint.get('time', {})
        min_time = int(round(time_cfg.get('minRatio', 0.8) * duration_seconds))
        max_time = int(round(time_cfg.get('maxRatio', 1.1) * duration_seconds))
        cand_time = [int(c.get('final_time_seconds') or c.get('estimated_time') or 120) for c in self.candidates]

        if 'TIME_BOUNDS' not in relaxed:
            model.Add(sum(x[i] * cand_time[i] for i in range(n)) >= min_time)
            model.Add(sum(x[i] * cand_time[i] for i in range(n)) <= max_time)

        # 5. Exclusion Groups
        if 'EXCLUSION_GROUPS' not in relaxed:
            group_to_indices: Dict[str, List[int]] = {}
            for i, c in enumerate(self.candidates):
                grp = c.get('exclusion_group_id')
                if grp:
                    group_to_indices.setdefault(grp, []).append(i)
            for grp, indices in group_to_indices.items():
                if len(indices) > 1:
                    model.Add(sum(x[i] for i in indices) <= 1)

        # 6. Exposure & Overlap
        exp_cfg = self.blueprint.get('exposure', {})
        max_uses = exp_cfg.get('maxTotalUses', 10)
        cooldown_papers = exp_cfg.get('cooldownPapers', 0)
        overlap_cfg = exp_cfg.get('overlap', {})
        max_shared = overlap_cfg.get('maxSharedQuestionsPerPaper', 100)

        for i, c in enumerate(self.candidates):
            if c.get('total_uses', 0) >= max_uses:
                model.Add(x[i] == 0)
            if c.get('papers_since_last_used', 999) < cooldown_papers:
                model.Add(x[i] == 0)

        if 'OVERLAP' not in relaxed and self.recent_paper_handles:
            m = overlap_cfg.get('recentPapersM', 3)
            recent_slice = self.recent_paper_handles[-m:] if len(self.recent_paper_handles) > m else self.recent_paper_handles
            for past_paper in recent_slice:
                past_set = set(past_paper)
                overlap_indices = [
                    i for i, c in enumerate(self.candidates)
                    if c.get('reservation_handle') in past_set
                    or c.get('question_id') in past_set
                    or c.get('version_id') in past_set
                ]
                if overlap_indices:
                    model.Add(sum(x[i] for i in overlap_indices) <= max_shared)

        # 7. No duplicates of the same question_id
        q_to_indices: Dict[str, List[int]] = {}
        for i, c in enumerate(self.candidates):
            qid = c.get('question_id')
            if qid:
                q_to_indices.setdefault(qid, []).append(i)
        for qid, indices in q_to_indices.items():
            if len(indices) > 1:
                model.Add(sum(x[i] for i in indices) <= 1)

        # 8. Lexicographic Objective Function
        # Term 1: Deviation from target mean difficulty
        target_sum = int(round(target_mean * total_questions))
        diff_dev = model.NewIntVar(0, 100 * total_questions, "diff_dev")
        diff_expr = sum(x[i] * cand_diff_norm[i] for i in range(n)) - target_sum
        model.Add(diff_dev >= diff_expr)
        model.Add(diff_dev >= -diff_expr)

        # Term 2: Exposure penalty (prefer less used and longer rested)
        exposure_costs = [
            (c.get('total_uses', 0) * 10 - min(c.get('papers_since_last_used', 5), 10))
            for c in self.candidates
        ]

        # Term 3: Pseudo-random HMAC term
        random_costs = [compute_pseudo_random_cost(self.seed, c['version_id']) for c in self.candidates]

        # Weights: Term 1: 10000, Term 2: 100, Term 3: 1
        model.Minimize(
            10000 * diff_dev +
            100 * sum(x[i] * exposure_costs[i] for i in range(n)) +
            1 * sum(x[i] * random_costs[i] for i in range(n))
        )

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.num_workers = self.solver_params['num_workers']
        solver.parameters.random_seed = self.solver_params['random_seed']
        solver.parameters.max_time_in_seconds = self.solver_params['max_time_in_seconds']

        callback = None
        if not self.blueprint.get('solver', {}).get('requireOptimal', False):
            callback = EarlyStopSolutionCallback(diff_dev)

        start_time = time.time()
        if callback:
            status = solver.Solve(model, callback)
        else:
            status = solver.Solve(model)
        elapsed = time.time() - start_time

        status_name = solver.StatusName(status)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            selected_ids = [self.candidates[i]['version_id'] for i in range(n) if solver.BooleanValue(x[i])]
            stats = {
                'status': status_name,
                'solve_time_seconds': round(elapsed, 4),
                'objective_value': solver.ObjectiveValue(),
                'best_objective_bound': solver.BestObjectiveBound(),
                'gap': abs(solver.ObjectiveValue() - solver.BestObjectiveBound()) if status == cp_model.FEASIBLE else 0.0,
                'selected_count': len(selected_ids),
                'mean_difficulty': round(sum(cand_diff_norm[i] for i in range(n) if solver.BooleanValue(x[i])) / total_questions, 2),
                'total_time_seconds': sum(cand_time[i] for i in range(n) if solver.BooleanValue(x[i])),
            }
            return status_name, selected_ids, stats
        elif status == cp_model.INFEASIBLE:
            return 'INFEASIBLE', None, {'status': 'INFEASIBLE', 'solve_time_seconds': round(elapsed, 4)}
        else:
            return 'FAILED_ERROR', None, {'status': status_name, 'solve_time_seconds': round(elapsed, 4)}

    def diagnose_infeasibility(self) -> Dict[str, Any]:
        """Runs iterative relaxation of constraint groups to identify binding constraints."""
        groups = [
            'TOPIC_QUOTAS',
            'DIFFICULTY_BINS',
            'MEAN_DIFFICULTY',
            'TIME_BOUNDS',
            'EXCLUSION_GROUPS',
            'OVERLAP',
        ]
        binding_groups = []
        for g in groups:
            status, _, _ = self.solve(relaxed_groups=[g])
            if status in ('OPTIMAL', 'FEASIBLE'):
                binding_groups.append(g)

        return {
            'status': 'INFEASIBLE',
            'binding_constraint_groups': binding_groups,
            'diagnostic_runs': len(groups),
            'message': f"Infeasible blueprint. Relaxing {binding_groups} resolves the conflict." if binding_groups else "Infeasible: fundamental count or mark shortage in eligible pool."
        }
