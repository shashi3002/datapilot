import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.evaluator import (
    AuditEvaluationResponse,
    SampleEvaluationItem,
    run_audit_evaluation
)

logger = logging.getLogger(__name__)

router = APIRouter()


class EvaluateAuditRequest(BaseModel):
    training_objective: str = Field(..., description="Target training objective.")
    dataset_name: str = Field(..., description="Hugging Face repo or dataset ID.")
    eval_system_prompt: str = Field(..., description="Customized evaluator system prompt.")
    eval_user_prompt_template: str = Field(..., description="Customized evaluator template.")
    qualitative_metrics: List[Dict[str, Any]] = Field(default_factory=list)
    samples: List[Dict[str, Any]] = Field(default_factory=list)
    total_profiled_rows: Optional[int] = 50000
    gemini_api_key: Optional[str] = None
    model: Optional[str] = None


class ExportCuratedRequest(BaseModel):
    dataset_name: str = "curated_dataset"
    all_samples: List[Dict[str, Any]] = Field(default_factory=list)
    excluded_sample_indices: List[int] = Field(default_factory=list)


@router.post("/evaluate", response_model=AuditEvaluationResponse)
def api_evaluate_audit(req: EvaluateAuditRequest):
    """
    Executes bounded sample evaluation using the customized prompt suite.
    Calculates dynamic pass/fail rates, classifies Good vs Bad samples,
    and returns the diagnostic payload for the dashboard.
    """
    if not req.training_objective or not req.training_objective.strip():
        raise HTTPException(status_code=400, detail="training_objective cannot be empty.")

    try:
        results = run_audit_evaluation(
            training_objective=req.training_objective.strip(),
            dataset_name=req.dataset_name.strip(),
            eval_system_prompt=req.eval_system_prompt,
            eval_user_prompt_template=req.eval_user_prompt_template,
            qualitative_metrics=req.qualitative_metrics,
            samples=req.samples,
            total_profiled_rows=req.total_profiled_rows or len(req.samples),
            api_key=req.gemini_api_key,
            model=req.model
        )
        return results
    except Exception as e:
        logger.error(f"Audit evaluation execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate audit samples: {str(e)}")


@router.post("/export-curated")
def api_export_curated(req: ExportCuratedRequest):
    """
    Exports a curated clean dataset with all flagged defective rows excluded.
    """
    excluded_set = set(req.excluded_sample_indices)
    curated_records = [
        row for idx, row in enumerate(req.all_samples)
        if idx not in excluded_set
    ]
    
    clean_filename = f"{req.dataset_name.replace('/', '__')}_curated_clean.json"
    return JSONResponse(
        content={
            "filename": clean_filename,
            "original_count": len(req.all_samples),
            "excluded_count": len(excluded_set),
            "curated_count": len(curated_records),
            "records": curated_records
        },
        headers={
            "Content-Disposition": f"attachment; filename={clean_filename}"
        }
    )
