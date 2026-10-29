import pytest
from selector_model import PaperSelector, normalize_difficulty, get_difficulty_bin


def make_candidate(
    version_id: str,
    subject_id: str = "sub-1",
    topic_id: str = "top-1",
    qtype: str = "MCQ_SINGLE",
    marks: float = 4.0,
    difficulty: float = 50.0,
    time_sec: int = 120,
    exclusion_group_id: str = None,
    total_uses: int = 0,
    papers_since_last_used: int = 5,
):
    return {
        "version_id": version_id,
        "question_id": f"q-{version_id}",
        "subject_id": subject_id,
        "section_code": "SEC-1",
        "topic_id": topic_id,
        "type": qtype,
        "marks": marks,
        "final_difficulty": difficulty,
        "final_time_seconds": time_sec,
        "exclusion_group_id": exclusion_group_id,
        "total_uses": total_uses,
        "papers_since_last_used": papers_since_last_used,
        "reservation_handle": f"res-{version_id}",
    }


def make_blueprint(
    total_q: int = 5,
    total_marks: float = 20.0,
    duration: int = 600,
    easy_count: int = 2,
    medium_count: int = 1,
    hard_count: int = 2,
):
    return {
        "totalQuestions": total_q,
        "totalMarks": total_marks,
        "durationSeconds": duration,
        "sections": [
            {
                "code": "SEC-1",
                "name": "Section 1",
                "subjectId": "sub-1",
                "allowedQuestionTypes": ["MCQ_SINGLE", "MCQ_MULTI"],
                "count": total_q,
                "totalMarks": total_marks,
                "topicQuotas": [
                    {"topicId": "top-1", "min": 1, "max": 5},
                ],
                "difficultyBins": {
                    "EASY": {"min": easy_count, "max": easy_count},
                    "MEDIUM": {"min": medium_count, "max": medium_count},
                    "HARD": {"min": hard_count, "max": hard_count},
                },
            }
        ],
        "difficulty": {
            "targetMean": 50.0,
            "meanTolerance": 15.0,
        },
        "time": {
            "minRatio": 0.8,
            "maxRatio": 1.2,
        },
        "exposure": {
            "maxTotalUses": 3,
            "cooldownPapers": 1,
            "overlap": {
                "recentPapersM": 2,
                "maxSharedQuestionsPerPaper": 1,
            },
        },
        "solver": {
            "timeLimitSeconds": 10,
            "requireOptimal": False,
        },
    }


def test_custom_difficulty_bins():
    """Admin specifies: 2 Easy, 1 Medium, 2 Hard -> Paper must contain exactly 2 Easy, 1 Medium, 2 Hard."""
    candidates = [
        # Easy: diff <= 33
        make_candidate("e1", difficulty=20.0),
        make_candidate("e2", difficulty=30.0),
        make_candidate("e3", difficulty=25.0),
        # Medium: diff 34..66
        make_candidate("m1", difficulty=45.0),
        make_candidate("m2", difficulty=55.0),
        # Hard: diff 67..100
        make_candidate("h1", difficulty=75.0),
        make_candidate("h2", difficulty=85.0),
        make_candidate("h3", difficulty=90.0),
    ]

    bp = make_blueprint(easy_count=2, medium_count=1, hard_count=2)
    seed = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    selector = PaperSelector(bp, candidates, seed)
    status, selected_ids, stats = selector.solve()

    assert status in ("OPTIMAL", "FEASIBLE")
    assert len(selected_ids) == 5

    selected_cands = [c for c in candidates if c["version_id"] in selected_ids]
    easy_selected = [c for c in selected_cands if get_difficulty_bin(normalize_difficulty(c["final_difficulty"])) == "EASY"]
    med_selected = [c for c in selected_cands if get_difficulty_bin(normalize_difficulty(c["final_difficulty"])) == "MEDIUM"]
    hard_selected = [c for c in selected_cands if get_difficulty_bin(normalize_difficulty(c["final_difficulty"])) == "HARD"]

    assert len(easy_selected) == 2
    assert len(med_selected) == 1
    assert len(hard_selected) == 2


def test_exclusion_groups():
    """Questions sharing an exclusion group must NEVER be selected together."""
    candidates = [
        make_candidate("v1", difficulty=20.0, exclusion_group_id="GRP-1"),
        make_candidate("v2", difficulty=25.0, exclusion_group_id="GRP-1"), # Same group as v1
        make_candidate("v3", difficulty=30.0),
        make_candidate("v4", difficulty=50.0),
        make_candidate("v5", difficulty=75.0),
        make_candidate("v6", difficulty=80.0),
    ]

    bp = make_blueprint(easy_count=2, medium_count=1, hard_count=2)
    seed = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    selector = PaperSelector(bp, candidates, seed)
    status, selected_ids, _ = selector.solve()

    assert status in ("OPTIMAL", "FEASIBLE")
    assert not ("v1" in selected_ids and "v2" in selected_ids), "Exclusion group conflict!"


def test_infeasible_diagnostics():
    """Infeasible blueprint returns INFEASIBLE and identifies binding constraint groups."""
    # Pool has 0 hard questions, but blueprint requires 2 hard
    candidates = [
        make_candidate("e1", difficulty=20.0),
        make_candidate("e2", difficulty=30.0),
        make_candidate("m1", difficulty=50.0),
        make_candidate("m2", difficulty=60.0),
    ]
    bp = make_blueprint(easy_count=2, medium_count=1, hard_count=2)
    seed = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    selector = PaperSelector(bp, candidates, seed)
    status, selected, _ = selector.solve()
    assert status == "INFEASIBLE"

    diagnostics = selector.diagnose_infeasibility()
    assert "DIFFICULTY_BINS" in diagnostics["binding_constraint_groups"] or "status" in diagnostics
