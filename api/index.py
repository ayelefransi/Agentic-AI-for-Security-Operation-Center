import sys
import os

# Add the root folder to the Python path so our absolute imports work
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import the FastAPI app instance from backend/api/main.py
from backend.api.main import app
