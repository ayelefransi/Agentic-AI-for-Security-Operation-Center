import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas.alert_schema import SOCAgentOutput
from graph.workflow import SOCWorkflow
from config.settings import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

class AlertRequest(BaseModel):
    alert: str

class AlertResponse(BaseModel):
    structured_json: dict
    report: str
    iterations: int

# We'll instantiate the workflow globally (ideally would manage its resources more gracefully)
try:
    workflow = SOCWorkflow()
except Exception as e:
    logger.error(f"Failed to initialize workflow: {e}")
    workflow = None

@app.post("/api/analyze-alert", response_model=AlertResponse)
async def analyze_alert(request: AlertRequest):
    if not workflow:
        raise HTTPException(status_code=500, detail="Workflow initialization failed.")
    
    logger.info(f"Received new alert analysis request: {request.alert[:50]}...")
    
    try:
        final_state = await workflow.run(request.alert)
        
        # Format response
        soc_analysis = final_state.get("soc_analysis")
        if soc_analysis:
            json_output = soc_analysis.model_dump()
        else:
            json_output = {"error": "Failed to generate SOC analysis"}
            
        report = final_state.get("final_report", "No report generated.")
        
        logger.info("Analysis completed successfully.")
        
        return AlertResponse(
            structured_json=json_output,
            report=report,
            iterations=final_state.get("rewrite_iterations", 0)
        )
        
    except Exception as e:
        logger.error(f"Error during alert analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "model": settings.llm_model}
