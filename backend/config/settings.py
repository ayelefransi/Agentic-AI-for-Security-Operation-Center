import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str:
    """Find the .env file by checking multiple locations."""
    # Check common locations relative to the backend directory
    candidates = [
        Path(__file__).parent.parent.parent / ".env",  # project root
        Path(__file__).parent.parent / ".env",          # backend dir
        Path.cwd() / ".env",                           # current working dir
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return ".env"  # fallback


class Settings(BaseSettings):
    # App Settings
    app_name: str = "አውራ AI SOC"
    debug: bool = True
    
    # Core Agent LLM
    groq_api_key: str = "dummy_key"
    llm_model: str = "openai/gpt-oss-120b"
  
    # Threat Intel API Keys (Optional - gracefully falls back to DemoGateway)
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    alienvault_api_key: str = ""
    
    # Google API key (for embeddings)
    google_api_key: str = ""
    
    # Vector DB — use temp dir that works on both Windows and Unix
    qdrant_path: str = os.path.join(
        os.environ.get("TEMP", os.environ.get("TMP", "/tmp")),
        "qdrant_data"
    )
    qdrant_collection_name: str = "soc_knowledge"
    
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
