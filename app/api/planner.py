import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.gemini_service import (
    MetricPlanResponse,
    EvalPromptResponse,
    generate_metric_plan,
    generate_eval_prompt
)

logger = logging.getLogger(__name__)

router = APIRouter()

class GenerateMetricsRequest(BaseModel):
    training_objective: str = Field(
        ...,
        description="User-defined natural language training objective.",
        example="Fine-tune an instruction-following LLM on coding problems. Audit alignment, syntax validity, and edge cases."
    )
    dataset_name: str = Field(
        ...,
        description="Dataset identifier or Hugging Face repo ID.",
        example="tatsu-lab/alpaca"
    )
    schema_definitions: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Dictionary mapping column names to data types or signatures."
    )
    sample_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of 1-5 sample record dictionaries."
    )
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Optional Gemini API key override. If omitted, uses GEMINI_API_KEY from .env"
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional Gemini model override."
    )

@router.post("/generate-metrics", response_model=MetricPlanResponse)
def api_generate_metrics(req: GenerateMetricsRequest):
    """
    Formulates a comprehensive Data Quality Metric Plan (Qualitative & Physical)
    tailored to the user's objective and dataset context using Gemini.
    """
    if not req.training_objective or not req.training_objective.strip():
        raise HTTPException(status_code=400, detail="training_objective cannot be empty.")

    try:
        plan = generate_metric_plan(
            training_objective=req.training_objective.strip(),
            dataset_name=req.dataset_name.strip(),
            schema_definitions=req.schema_definitions,
            sample_records=req.sample_records,
            api_key=req.gemini_api_key,
            model=req.model
        )
        return plan
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Metric generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate metric plan: {str(e)}")


class GenerateEvalPromptRequest(BaseModel):
    training_objective: str = Field(
        ...,
        description="User-defined natural language training objective.",
        example="Fine-tune an instruction-following LLM on coding problems."
    )
    dataset_name: str = Field(
        ...,
        description="Dataset identifier or Hugging Face repo ID.",
        example="tatsu-lab/alpaca"
    )
    inferred_domain: Optional[str] = Field(
        "General ML",
        description="Domain deduced from the metric plan (e.g. NLP, Speech, Vision, Tabular)."
    )
    inferred_learning_paradigm: Optional[str] = Field(
        "Supervised Fine-Tuning",
        description="Learning paradigm deduced from the metric plan."
    )
    qualitative_metrics: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of qualitative metric objects generated in the planning phase."
    )
    schema_definitions: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Dictionary mapping column names to data types."
    )
    sample_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Sample preview records."
    )
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Optional Gemini API key override."
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional Gemini model override."
    )


@router.post("/generate-eval-prompt", response_model=EvalPromptResponse)
def api_generate_eval_prompt(req: GenerateEvalPromptRequest):
    """
    Synthesizes a specialized Data Quality Evaluation Prompt tailored to the
    qualitative metrics, dataset modality, and user's objective using Gemini.
    """
    if not req.training_objective or not req.training_objective.strip():
        raise HTTPException(status_code=400, detail="training_objective cannot be empty.")

    try:
        eval_prompt = generate_eval_prompt(
            training_objective=req.training_objective.strip(),
            dataset_name=req.dataset_name.strip(),
            inferred_domain=req.inferred_domain,
            inferred_learning_paradigm=req.inferred_learning_paradigm,
            qualitative_metrics=req.qualitative_metrics,
            schema_definitions=req.schema_definitions,
            sample_records=req.sample_records,
            api_key=req.gemini_api_key,
            model=req.model
        )
        return eval_prompt
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Eval prompt generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate eval prompt: {str(e)}")

