from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.hf_service import (
    validate_and_extract_repo_id,
    inspect_hf_dataset,
    download_dataset_partition
)

router = APIRouter()

# ============================================================
# Request / Response Schemas
# ============================================================

class ValidateUrlRequest(BaseModel):
    url: str = Field(
        ...,
        description="Hugging Face dataset URL or repository identifier",
        example="https://huggingface.co/datasets/tatsu-lab/alpaca"
    )

class ValidateUrlResponse(BaseModel):
    valid: bool
    repo_id: str
    message: str

class InspectDatasetRequest(BaseModel):
    url: str = Field(
        ...,
        description="Hugging Face dataset URL or repository identifier",
        example="tatsu-lab/alpaca"
    )
    hf_token: Optional[str] = Field(
        None,
        description="Optional personal Hugging Face access token for gated/private repositories"
    )

class InspectDatasetResponse(BaseModel):
    repo_id: str
    author: str
    is_private: bool
    is_gated: bool
    last_modified: Optional[str] = None
    sha: Optional[str] = None
    description: Optional[str] = ""
    tags: List[str] = []
    configs: List[str] = []
    splits: List[Dict[str, Any]] = []
    estimated_total_rows: int = 0
    columns: List[Dict[str, str]] = []
    preview: List[Dict[str, Any]] = []
    status: str = "accessible"

class DownloadDatasetRequest(BaseModel):
    url: str = Field(
        ...,
        description="Hugging Face dataset URL or repository identifier",
        example="tatsu-lab/alpaca"
    )
    config: Optional[str] = Field(
        "default",
        description="Dataset configuration name (subset)"
    )
    split: Optional[str] = Field(
        "train",
        description="Dataset split name (train, validation, test)"
    )
    max_rows: int = Field(
        100,
        ge=1,
        le=500,
        description="Maximum bounded rows to download and cache locally"
    )
    hf_token: Optional[str] = Field(
        None,
        description="Optional personal Hugging Face access token"
    )

class DownloadDatasetResponse(BaseModel):
    repo_id: str
    config: str
    split: str
    requested_max_rows: int
    downloaded_rows: int
    local_path: str
    file_size_bytes: int
    file_size_mb: float
    columns: List[Dict[str, str]]
    preview: List[Dict[str, Any]]
    rows: List[Dict[str, Any]] = []
    status: str

# ============================================================
# API Endpoints
# ============================================================

@router.post(
    "/validate-url",
    response_model=ValidateUrlResponse,
    summary="Validate a Hugging Face Dataset URL",
    description="Validates whether an input URL points to a legitimate, safe Hugging Face repository and extracts the canonical repo_id."
)
def validate_url_endpoint(req: ValidateUrlRequest):
    try:
        repo_id = validate_and_extract_repo_id(req.url)
        return ValidateUrlResponse(
            valid=True,
            repo_id=repo_id,
            message=f"Valid Hugging Face dataset identifier '{repo_id}'"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/inspect",
    response_model=InspectDatasetResponse,
    summary="Inspect Dataset Metadata & Splits",
    description="Fetches live metadata, splits, configurations, and accessibility status from Hugging Face Hub APIs."
)
def inspect_dataset_endpoint(req: InspectDatasetRequest):
    try:
        repo_id = validate_and_extract_repo_id(req.url)
        metadata = inspect_hf_dataset(repo_id, token=req.hf_token)
        return InspectDatasetResponse(**metadata)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/download",
    response_model=DownloadDatasetResponse,
    summary="Download Bounded Dataset Partition Locally",
    description="Downloads up to max_rows of a dataset partition and caches it locally as structured JSON in ./data/."
)
def download_dataset_endpoint(req: DownloadDatasetRequest):
    try:
        repo_id = validate_and_extract_repo_id(req.url)
        download_result = download_dataset_partition(
            repo_id=repo_id,
            config=req.config,
            split=req.split,
            max_rows=req.max_rows,
            token=req.hf_token
        )
        return DownloadDatasetResponse(**download_result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
