import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    app_name: str = "Agentic RAG for SOC"
    debug: bool = True
    
    # Core Agent LLM
    groq_api_key: str = "dummy_key"
    llm_model: str = "llama3-8b-8192"
  
    # Threat Intel API Keys (Optional - gracefully falls back to DemoGateway)
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    alienvault_api_key: str = ""
    
    # Vector DB
    # Use /tmp since Vercel Serverless Functions have a read-only filesystem except for /tmp
    qdrant_path: str = "/tmp/qdrant_data"
    qdrant_collection_name: str = "soc_knowledge"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()


