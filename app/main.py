from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import datasets, planner, audits

app = FastAPI(
    title="DataPilot API",
    description="Local-First AI Dataset Quality Auditor API for Hugging Face datasets.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(planner.router, prefix="/api/planner", tags=["Planner"])
app.include_router(audits.router, prefix="/api/audits", tags=["Audits"])

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "DataPilot API",
        "version": "0.1.0"
    }

@app.get("/", include_in_schema=False)
def serve_root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "DataPilot API is running. Visit /docs for Swagger documentation."}
