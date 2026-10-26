import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    DATA_DIR: Path = (BASE_DIR / os.getenv("DATAPILOT_DATA_DIR", "./data")).resolve()
    ARTIFACTS_DIR: Path = (BASE_DIR / os.getenv("DATAPILOT_ARTIFACTS_DIR", "./artifacts")).resolve()
    MAX_DOWNLOAD_GB: float = float(os.getenv("DATAPILOT_MAX_DOWNLOAD_GB", "5.0"))
    DEFAULT_SAMPLE_BUDGET: int = int(os.getenv("DATAPILOT_DEFAULT_SAMPLE_BUDGET", "100"))
    MAX_SAMPLE_BUDGET: int = int(os.getenv("DATAPILOT_MAX_SAMPLE_BUDGET", "500"))

settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
