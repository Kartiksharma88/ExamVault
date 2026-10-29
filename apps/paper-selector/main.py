"""
FastAPI Microservice: Paper Selector (Step 4 Selection Engine)
Runs in internal network with zero outbound internet access.
Operates strictly on question metadata (never receives question text or answers).
"""

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import hashlib
from selector_model import PaperSelector


app = FastAPI(
    title="ExamVault Paper Selector Service",
    description="Internal microservice for difficulty-aware constrained paper generation using OR-Tools CP-SAT",
    version="1.0.0",
)


class SelectionRequest(BaseModel):
    blueprint: Dict[str, Any]
    candidates: List[Dict[str, Any]]
    seed: str = Field(description="256-bit hex seed from CSPRNG")
    recentPaperHandles: Optional[List[List[str]]] = None


class SelectionResponse(BaseModel):
    status: str
    selectedVersionIds: Optional[List[str]] = None
    stats: Optional[Dict[str, Any]] = None
    diagnostics: Optional[Dict[str, Any]] = None
    snapshotHash: str
    solverInfo: Dict[str, Any]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "paper-selector",
        "solver": "Google OR-Tools CP-SAT",
        "version": "9.15.6755",
    }


@app.post("/select", response_model=SelectionResponse)
def select_paper(req: SelectionRequest):
    # Compute candidate snapshot hash over sorted candidate records
    sorted_tuples = sorted(
        [
            f"{c.get('version_id')}:{c.get('question_id')}:{c.get('marks')}:{c.get('final_difficulty')}"
            for c in req.candidates
        ]
    )
    snapshot_hash = hashlib.sha256("\n".join(sorted_tuples).encode("utf-8")).hexdigest()

    selector = PaperSelector(
        blueprint=req.blueprint,
        candidates=req.candidates,
        seed=req.seed,
        recent_paper_handles=req.recentPaperHandles,
    )

    solver_status, selected_ids, stats = selector.solve()

    solver_info = {
        "solver": "Google OR-Tools CP-SAT",
        "version": "9.15.6755",
        "parameters": selector.solver_params,
    }

    if solver_status in ("OPTIMAL", "FEASIBLE"):
        # If requireOptimal is true and status is FEASIBLE, reject as non-optimal
        if req.blueprint.get("solver", {}).get("requireOptimal", False) and solver_status != "OPTIMAL":
            return SelectionResponse(
                status="FAILED_INFEASIBLE",
                selectedVersionIds=None,
                stats=stats,
                diagnostics={"message": "Solver produced feasible solution but requireOptimal is true."},
                snapshotHash=snapshot_hash,
                solverInfo=solver_info,
            )

        return SelectionResponse(
            status=solver_status,
            selectedVersionIds=selected_ids,
            stats=stats,
            diagnostics=None,
            snapshotHash=snapshot_hash,
            solverInfo=solver_info,
        )

    elif solver_status == "INFEASIBLE":
        diagnostics = selector.diagnose_infeasibility()
        return SelectionResponse(
            status="INFEASIBLE",
            selectedVersionIds=None,
            stats=stats,
            diagnostics=diagnostics,
            snapshotHash=snapshot_hash,
            solverInfo=solver_info,
        )

    else:
        return SelectionResponse(
            status="FAILED_ERROR",
            selectedVersionIds=None,
            stats=stats,
            diagnostics={"message": f"Solver exited with status {solver_status}"},
            snapshotHash=snapshot_hash,
            solverInfo=solver_info,
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

