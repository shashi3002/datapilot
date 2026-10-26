import json
import logging
from typing import Any, Dict, List, Optional
import requests
import urllib3
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

# Pydantic Schemas for Metric Planning

class QualitativeMetric(BaseModel):
    metric_id: str = Field(default="QUAL_01", description="Unique identifier for the qualitative metric")
    metric_name: str = Field(default="Qualitative Metric", description="Name of the qualitative metric")
    description: str = Field(default="", description="Explanation of what this metric evaluates")
    relevance_to_objective: str = Field(default="", description="Why it is critical for this specific training objective")
    evaluation_rubric: str = Field(default="", description="Criteria for what constitutes high vs low quality")

class PhysicalMetric(BaseModel):
    metric_id: str = Field(default="PHYS_01", description="Unique identifier for the physical metric")
    metric_name: str = Field(default="Physical Metric", description="Name of the physical / mathematical / signal metric")
    description: str = Field(default="", description="Explanation of what this metric measures mathematically or physically")
    recommended_threshold: str = Field(default="Defined per domain literature", description="Standard target value or range from domain research")
    reference_tool_or_library: str = Field(default="Standard Python libraries", description="Standard library or calculation method used in production pipelines")

class TaskProfile(BaseModel):
    inferred_domain: str = Field(default="General ML", description="Inferred domain, e.g., NLP, Speech, Vision, Tabular")
    inferred_learning_paradigm: str = Field(default="Supervised Learning", description="Learning paradigm, e.g., SFT, Generative, Classification")
    objective_interpretation: str = Field(default="Dataset readiness and quality audit.", description="Brief interpretation of the user objective")

class MetricPlanResponse(BaseModel):
    task_profile: TaskProfile = Field(default_factory=TaskProfile)
    qualitative_metrics: List[QualitativeMetric] = Field(default_factory=list)
    physical_metrics: List[PhysicalMetric] = Field(default_factory=list)
    raw_status: str = "success"


class EvalPromptResponse(BaseModel):
    eval_system_prompt: str = Field(description="System instructions establishing evaluator persona, guidelines, and rules.")
    eval_user_prompt_template: str = Field(description="Dynamic template containing variable placeholders to evaluate sample batches.")
    full_compiled_prompt: str = Field(description="Full assembled evaluation prompt ready for manual review or execution.")
    target_metrics_summary: List[str] = Field(default_factory=list, description="List of qualitative metrics embedded in this prompt.")
    suggested_temperature: float = Field(default=0.1, description="Recommended model temperature for reproducible, rigorous evaluation.")
    status: str = "success"


def _normalize_metric_plan_dict(raw: Any) -> dict:
    """
    Robustly normalizes raw Gemini JSON output to guarantee compatibility
    even if Gemini omits metric_id or uses slight key variations.
    """
    if not isinstance(raw, dict):
        raw = {}

    # 1. Normalize Task Profile
    tp = raw.get("task_profile")
    if not isinstance(tp, dict):
        tp = {}
    normalized_tp = {
        "inferred_domain": str(tp.get("inferred_domain") or raw.get("domain") or "General ML / Multimodal"),
        "inferred_learning_paradigm": str(tp.get("inferred_learning_paradigm") or raw.get("learning_paradigm") or "Supervised Fine-Tuning"),
        "objective_interpretation": str(tp.get("objective_interpretation") or raw.get("interpretation") or "Objective evaluation plan.")
    }

    # 2. Normalize Qualitative Metrics
    raw_qual = raw.get("qualitative_metrics") or raw.get("tier_1_qualitative_metrics") or []
    if not isinstance(raw_qual, list):
        raw_qual = []
    normalized_qual = []
    for i, item in enumerate(raw_qual, 1):
        if not isinstance(item, dict):
            continue
        normalized_qual.append({
            "metric_id": str(item.get("metric_id") or item.get("id") or f"QUAL_{i:02d}"),
            "metric_name": str(item.get("metric_name") or item.get("name") or f"Qualitative Metric {i}"),
            "description": str(item.get("description") or item.get("desc") or "Evaluates qualitative suitability for the target model."),
            "relevance_to_objective": str(item.get("relevance_to_objective") or item.get("relevance") or item.get("why_critical") or "Directly impacts model alignment."),
            "evaluation_rubric": str(item.get("evaluation_rubric") or item.get("rubric") or item.get("criteria") or "Evaluate against standard task criteria.")
        })

    # 3. Normalize Physical Metrics
    raw_phys = raw.get("physical_metrics") or raw.get("tier_2_physical_metrics") or []
    if not isinstance(raw_phys, list):
        raw_phys = []
    normalized_phys = []
    for i, item in enumerate(raw_phys, 1):
        if not isinstance(item, dict):
            continue
        normalized_phys.append({
            "metric_id": str(item.get("metric_id") or item.get("id") or f"PHYS_{i:02d}"),
            "metric_name": str(item.get("metric_name") or item.get("name") or f"Physical Metric {i}"),
            "description": str(item.get("description") or item.get("desc") or "Measures quantitative signal property."),
            "recommended_threshold": str(item.get("recommended_threshold") or item.get("threshold") or "Standard domain literature threshold"),
            "reference_tool_or_library": str(item.get("reference_tool_or_library") or item.get("tool") or item.get("library") or "Standard Python libraries (e.g. torchaudio, librosa, transformers)")
        })

    return {
        "task_profile": normalized_tp,
        "qualitative_metrics": normalized_qual,
        "physical_metrics": normalized_phys,
        "raw_status": "success"
    }


def _safe_post(url: str, json_data: dict, timeout: int = 45) -> requests.Response:
    """
    POST helper that handles SSL certificate chain issues on local Windows environments.
    """
    try:
        return requests.post(url, json=json_data, timeout=timeout)
    except requests.exceptions.SSLError:
        logger.warning("Standard SSL verification failed. Falling back with verify=False.")
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        return requests.post(url, json=json_data, verify=False, timeout=timeout)


def build_planner_prompt(
    training_objective: str,
    dataset_name: str,
    schema_definitions: Any,
    sample_records: Any
) -> str:
    """
    Builds the unified, generalized Metric Planning prompt.
    """
    schema_str = json.dumps(schema_definitions, indent=2) if not isinstance(schema_definitions, str) else schema_definitions
    samples_str = json.dumps(sample_records[:5], indent=2) if isinstance(sample_records, list) else str(sample_records)

    prompt = f"""You are a Principal Machine Learning Evaluation Architect.

Your sole task is to formulate a comprehensive Data Quality Metric Plan for ANY given dataset and user training objective, across any domain or modality.

Do NOT evaluate the data, do NOT pass any suitability verdict, and do NOT reject or approve the dataset. Your only objective is to identify, define, and list the exact metrics that should be used to evaluate this data.

Categorize the metrics into two distinct tiers:
1. Qualitative Metrics: Evaluative, semantic, and contextual metrics that measure qualitative suitability for the objective (to be evaluated via cognitive/LLM analysis).
2. Physical / Quantitative Metrics: Measurable, mathematical, statistical, or signal-level metrics established in literature for this domain (to be measured via computation/code).

---
### INPUT:

1. USER'S TRAINING OBJECTIVE:
"{training_objective}"

2. DATASET CONTEXT & SCHEMA:
- Dataset Identifier: {dataset_name}
- Features / Fields / Attributes: {schema_str}

3. REPRESENTATIVE SAMPLE DATA:
{samples_str}

---
### INSTRUCTIONS:

1. Task & Modality Induction:
   Deduce the domain, underlying modality, and machine learning paradigm directly from the objective and data context.

2. Identify Qualitative Metrics:
   List the essential qualitative and semantic metrics needed to determine if data of this nature is qualitatively fit for the stated training objective.
   For each qualitative metric, define:
   - Metric Name
   - What it measures
   - Why it is critical for this specific training objective
   - The criteria/rubric to judge it

3. Identify Physical / Quantitative Metrics:
   List the objective, mathematical, statistical, or signal-processing metrics that research literature prescribes for this domain.
   For each physical metric, define:
   - Metric Name
   - What it measures
   - Target benchmark / recommended threshold from standard literature
   - Standard computation tool, algorithm, or library

---
### OUTPUT FORMAT:
Return your response STRICTLY as a single, valid JSON object without markdown code blocks, backticks, or conversational text:

{{
  "task_profile": {{
    "inferred_domain": "<e.g., NLP / Audio / Computer Vision / Tabular / Time-Series / Multimodal>",
    "inferred_learning_paradigm": "<e.g., Supervised Fine-Tuning / Self-Supervised / Generative / Reinforcement Learning>",
    "objective_interpretation": "<Brief interpretation of what the user is trying to accomplish>"
  }},
  "qualitative_metrics": [
    {{
      "metric_id": "QUAL_01",
      "metric_name": "<Name of the qualitative metric>",
      "description": "<Clear explanation of what this metric evaluates>",
      "relevance_to_objective": "<Why this qualitative aspect matters specifically for this model/training goal>",
      "evaluation_rubric": "<Clear criteria for what constitutes high vs low quality>"
    }}
  ],
  "physical_metrics": [
    {{
      "metric_id": "PHYS_01",
      "metric_name": "<Name of the physical / mathematical / signal metric>",
      "description": "<Clear explanation of what this metric measures mathematically or physically>",
      "recommended_threshold": "<Standard target value or range from domain research>",
      "reference_tool_or_library": "<Standard library or calculation method used in production pipelines>"
    }}
  ]
}}
"""
    return prompt


def generate_metric_plan(
    training_objective: str,
    dataset_name: str,
    schema_definitions: Any = None,
    sample_records: Any = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> MetricPlanResponse:
    """
    Calls Gemini API to generate the metric plan for the dataset and training objective.
    Supports automatic model fallback for robustness.
    """
    effective_key = api_key or settings.GEMINI_API_KEY
    if not effective_key:
        raise ValueError("Gemini API Key is not configured. Set GEMINI_API_KEY in .env or pass it in request.")

    candidate_models = [
        model or settings.GEMINI_MODEL or "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest"
    ]
    # Deduplicate while preserving order
    seen = set()
    models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

    prompt = build_planner_prompt(
        training_objective=training_objective,
        dataset_name=dataset_name,
        schema_definitions=schema_definitions or {},
        sample_records=sample_records or []
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    last_error = None
    for target_model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={effective_key}"
        try:
            resp = _safe_post(url, json_data=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    continue
                first_part = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if not first_part:
                    continue
                # Parse JSON safely
                cleaned = first_part.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                
                try:
                    parsed = json.loads(cleaned)
                except Exception as json_err:
                    logger.warning(f"Raw JSON decode failed, attempting lenient parse: {json_err}")
                    parsed = {}

                # Apply normalization so missing metric_id or altered keys never crash Pydantic
                normalized = _normalize_metric_plan_dict(parsed)
                return MetricPlanResponse.model_validate(normalized)
            else:
                last_error = f"Gemini ({target_model}) returned {resp.status_code}: {resp.text}"
                logger.warning(last_error)
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Error calling {target_model}: {e}")

    raise RuntimeError(f"All candidate Gemini models failed. Last error: {last_error}")


def build_meta_prompt_engineer(
    training_objective: str,
    dataset_name: str,
    inferred_domain: str,
    inferred_learning_paradigm: str,
    qualitative_metrics: List[Any],
    schema_definitions: Any,
    sample_records: Any
) -> str:
    """
    Builds the meta-prompt that instructs Gemini to formulate a specialized evaluation prompt.
    """
    metrics_formatted = []
    for m in qualitative_metrics:
        if isinstance(m, dict):
            m_id = m.get("metric_id", "QUAL")
            m_name = m.get("metric_name", "Metric")
            m_desc = m.get("description", "")
            m_rubric = m.get("evaluation_rubric", "")
            metrics_formatted.append(f"- [{m_id}] {m_name}: {m_desc}\n  Evaluation Rubric: {m_rubric}")
        else:
            metrics_formatted.append(f"- {str(m)}")
    metrics_str = "\n".join(metrics_formatted) if metrics_formatted else "General semantic alignment and formatting hygiene."

    schema_str = json.dumps(schema_definitions, indent=2) if not isinstance(schema_definitions, str) else schema_definitions
    samples_str = json.dumps(sample_records[:2], indent=2) if isinstance(sample_records, list) and sample_records else "{}"

    return f"""You are a Principal AI Prompt Engineer and LLM-as-a-Judge Evaluation Specialist.

Your task is to synthesize a specialized, battle-tested Data Quality Evaluation Prompt that will be used by an AI Judge to inspect, audit, and grade sample records from an ML training dataset.

### CONTEXT:
1. USER'S TRAINING OBJECTIVE:
"{training_objective}"

2. DATASET IDENTIFIER & MODALITY:
- Dataset Identifier: {dataset_name}
- Domain / Modality: {inferred_domain} ({inferred_learning_paradigm})

3. QUALITATIVE METRICS TO AUDIT:
{metrics_str}

4. DATASET SCHEMA & SAMPLE SHAPE:
{schema_str}
Sample Preview:
{samples_str}

### INSTRUCTIONS:
Synthesize the evaluation prompt suite with these exact fields:
1. "eval_system_prompt": System prompt establishing the AI Judge persona. Strict, objective, reference-grounded, zero hallucination. Instructs model to output ONLY valid JSON.
2. "eval_user_prompt_template": The exact template to evaluate sample batches. Must embed:
   - The user's target objective
   - The specific rubrics for EACH qualitative metric
   - A placeholder `{{{{SAMPLE_RECORDS}}}}` where raw records will be dynamically injected
   - Explicit JSON response schema for grading each sample:
     `{{"sample_id": "<id>", "scores": {{"<metric_id>": {{"rating": "PASS | MARGINAL | FAIL", "reason": "<string>"}}}}, "flagged_defects": ["<string>"], "curation_action": "<string>"}}`
3. "full_compiled_prompt": The complete assembled prompt ready for inspection, where `{{{{SAMPLE_RECORDS}}}}` has a sample record already filled in so the user can see exactly what the judge receives.
4. "target_metrics_summary": List of metric names audited.
5. "suggested_temperature": Float between 0.0 and 0.2.

### OUTPUT FORMAT:
Return strictly a valid JSON object matching the requested schema without conversational commentary:
{{
  "eval_system_prompt": "<string>",
  "eval_user_prompt_template": "<string>",
  "full_compiled_prompt": "<string>",
  "target_metrics_summary": ["<string>"],
  "suggested_temperature": 0.1
}}
"""


def generate_eval_prompt(
    training_objective: str,
    dataset_name: str,
    inferred_domain: Optional[str] = "General ML",
    inferred_learning_paradigm: Optional[str] = "Supervised Learning",
    qualitative_metrics: Optional[List[Any]] = None,
    schema_definitions: Any = None,
    sample_records: Any = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> EvalPromptResponse:
    """
    Calls Gemini API to generate the specialized Data Evaluation Prompt.
    Includes a deterministic fallback if Gemini is offline or times out.
    """
    effective_key = api_key or settings.GEMINI_API_KEY
    effective_model = model or settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
    q_metrics = qualitative_metrics or []

    metrics_summary = [
        m.get("metric_name", f"QUAL_{i+1}") if isinstance(m, dict) else str(m)
        for i, m in enumerate(q_metrics)
    ]
    if not metrics_summary:
        metrics_summary = ["Semantic Alignment", "Information Density", "Format Hygiene"]

    # Construct robust prompt engineering instructions
    meta_prompt = build_meta_prompt_engineer(
        training_objective=training_objective,
        dataset_name=dataset_name,
        inferred_domain=inferred_domain or "General ML",
        inferred_learning_paradigm=inferred_learning_paradigm or "Supervised",
        qualitative_metrics=q_metrics,
        schema_definitions=schema_definitions or {},
        sample_records=sample_records or []
    )

    candidate_models = [
        effective_model,
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest"
    ]
    seen = set()
    models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

    payload = {
        "contents": [{"parts": [{"text": meta_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    if effective_key:
        for target_model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={effective_key}"
            try:
                resp = _safe_post(url, json_data=payload, timeout=40)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if raw_text.startswith("```"):
                            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                        parsed = json.loads(raw_text)
                        return EvalPromptResponse(
                            eval_system_prompt=str(parsed.get("eval_system_prompt") or "You are an AI Data Quality Auditor."),
                            eval_user_prompt_template=str(parsed.get("eval_user_prompt_template") or ""),
                            full_compiled_prompt=str(parsed.get("full_compiled_prompt") or ""),
                            target_metrics_summary=parsed.get("target_metrics_summary") or metrics_summary,
                            suggested_temperature=float(parsed.get("suggested_temperature") or 0.1),
                            status="success"
                        )
            except Exception as e:
                logger.warning(f"Error calling {target_model} for eval prompt synthesis: {e}")

    # High-grade deterministic fallback if API unavailable or timed out
    rubrics_text = "\n".join([
        f"- [{m.get('metric_id', 'QUAL')}] {m.get('metric_name', 'Metric')}: {m.get('evaluation_rubric', m.get('description', 'Evaluate quality.'))}"
        for m in q_metrics if isinstance(m, dict)
    ])
    if not rubrics_text:
        rubrics_text = "- [QUAL_01] Semantic Alignment: Directly verify prompt-response coherence without digression."

    system_prompt_fb = (
        f"You are DataPilot AI, a Senior Quality Auditor evaluating sample records from the dataset '{dataset_name}'.\n"
        f"Domain: {inferred_domain} | Learning Paradigm: {inferred_learning_paradigm}\n"
        "Your task is to rigorously evaluate whether the provided data samples satisfy the user's training objective.\n"
        "Score each sample objectively against the qualitative rubrics. Output ONLY valid JSON."
    )

    user_template_fb = (
        f"### TRAINING OBJECTIVE:\n\"{training_objective}\"\n\n"
        f"### QUALITATIVE METRICS & RUBRICS:\n{rubrics_text}\n\n"
        "### DATA SAMPLES TO EVALUATE:\n"
        "{{SAMPLE_RECORDS}}\n\n"
        "### INSTRUCTIONS:\n"
        "Evaluate each sample record against each qualitative metric.\n"
        "Return your evaluation strictly as a JSON array of objects:\n"
        "[\n"
        "  {\n"
        "    \"sample_index\": 0,\n"
        "    \"ratings\": {\n"
        "      \"<metric_id>\": {\"status\": \"PASS | MARGINAL | FAIL\", \"defect_rationale\": \"...\"}\n"
        "    },\n"
        "    \"verdict\": \"ACCEPTABLE | REQUIRES_CURATION | REJECT\",\n"
        "    \"flagged_anomaly\": \"Specific defect observation or 'None'\",\n"
        "    \"remediation_tip\": \"How to clean or curate this sample\"\n"
        "  }\n"
        "]"
    )

    sample_preview_str = json.dumps(sample_records[0] if (sample_records and len(sample_records) > 0) else {"sample": "sample data record"}, indent=2)
    compiled_fb = f"{system_prompt_fb}\n\n---\n\n{user_template_fb.replace('{{SAMPLE_RECORDS}}', sample_preview_str)}"

    return EvalPromptResponse(
        eval_system_prompt=system_prompt_fb,
        eval_user_prompt_template=user_template_fb,
        full_compiled_prompt=compiled_fb,
        target_metrics_summary=metrics_summary,
        suggested_temperature=0.1,
        status="generated_fallback"
    )
