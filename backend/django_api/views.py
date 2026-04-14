import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import asyncio

from graph.workflow import SOCWorkflow
from config.settings import settings

logger = logging.getLogger(__name__)

# Instantiate global workflow
workflow = None



@csrf_exempt
@require_http_methods(["POST"])
async def analyze_alert(request):
    global workflow
    if not workflow:
        try:
            workflow = SOCWorkflow()
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"detail": f"Workflow failed to initialize: {str(e)}"}, status=500)
    
    try:
        body = json.loads(request.body)
        alert_text = body.get("alert", "")
        if not alert_text:
            return JsonResponse({"detail": "No alert provided."}, status=400)
            
        logger.info(f"Received new alert analysis request: {alert_text[:50]}...")
        
        final_state = await workflow.run(alert_text)
        
        soc_analysis = final_state.get("soc_analysis")
        if soc_analysis:
            json_output = soc_analysis.model_dump()
        else:
            json_output = {"error": "Failed to generate SOC analysis"}
            
        report = final_state.get("final_report", "No report generated.")
        
        logger.info("Analysis completed successfully.")
        
        return JsonResponse({
            "structured_json": json_output,
            "report": report,
            "iterations": final_state.get("rewrite_iterations", 0)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)
    except Exception as e:
        import traceback
        with open("error_log.txt", "w") as f:
            traceback.print_exc(file=f)
        traceback.print_exc()
        logger.error(f"Error during alert analysis: {e}", exc_info=True)
        return JsonResponse({"detail": str(e)}, status=500)

@require_http_methods(["GET"])
def health_check(request):
    return JsonResponse({"status": "healthy", "model": settings.llm_model})
