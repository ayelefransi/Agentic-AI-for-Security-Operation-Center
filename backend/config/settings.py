import google.generativeai as genai
import os

# Note: You must configure the API key before listing models
# genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
# print([m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods])
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    app_name: str = "Agentic RAG for SOC"
    debug: bool = True
    
    # LLM Settings
    google_api_key: str = "dummy_key"
    llm_model: str = "gemini-3.1-flash-lite-preview"
  
    # Vector DB
    qdrant_path: str = "./qdrant_data"
    qdrant_collection_name: str = "soc_knowledge"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()


