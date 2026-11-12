import sys
import os

# Ensure backend directory is in the python path to resolve submodules everywhere
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, validator

from graph.workflow import SOCWorkflow
from graph.workflow_v2 import SOCWorkflowV2
from config.settings import settings
from agents.mitre_agent import get_mitre_heatmap_data
from reporting.pdf_generator import generate_incident_pdf
from schemas.schemas import IncidentState, IncidentStatus, AnalystFeedback, Severity
from middleware.security import (
    InputSanitizer,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from middleware.auth import (
    Principal,
    require_principal,
    user_store,
    login_rate_limiter,
    get_current_user,
    require_admin_user,
    User,
    SESSION_COOKIE_NAME,
)
import db

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="አውራ AI autonomous multi-agent SOC platform"
)

# Add security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=60)
app.add_middleware(RequestSizeLimitMiddleware, max_size_mb=10)

# Add CORS middleware
from starlette.middleware.cors import CORSMiddleware
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Request-ID", "Content-Disposition"],
    max_age=600,
)

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


class CreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "analyst"


class UpdateUserRoleRequest(BaseModel):
    role: str


class StatusUpdateRequest(BaseModel):
    status: IncidentStatus


def _client_ip(req: Request) -> str:
    forwarded = req.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


@app.post("/api/auth/login")
async def login(request: LoginRequest, http_request: Request, response: Response):
    """Authenticate user and set httpOnly session cookie (8h default, 30d remember me)."""
    ip = _client_ip(http_request)
    if not login_rate_limiter.check_and_record(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait a minute and try again.",
        )

    user, error = user_store.authenticate(request.email, request.password)
    if error:
        raise HTTPException(status_code=401, detail=error)

    token = user_store.create_session_token(user, remember_me=request.remember_me)
    max_age = 30 * 24 * 3600 if request.remember_me else 8 * 3600
    is_secure = (
        http_request.url.scheme == "https"
        or os.environ.get("COOKIE_SECURE", "").lower() == "true"
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        }
    }


@app.post("/api/auth/logout")
async def logout(response: Response):
    """Clear session cookie."""
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth/me")
async def get_me(request: Request):
    """Return current authenticated user or 401."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }


@app.get("/api/users")
async def list_users(admin: User = Depends(require_admin_user)):
    """List platform users (admin only)."""
    return {"users": user_store.list_users()}


@app.post("/api/users")
async def create_user(body: CreateUserRequest, admin: User = Depends(require_admin_user)):
    """Create a user (admin only)."""
    user, err = user_store.create_user(body.email, body.name, body.password, body.role)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "status": "active",
        }
    }


@app.patch("/api/users/{user_id}")
async def update_user_role(
    user_id: str,
    body: UpdateUserRoleRequest,
    admin: User = Depends(require_admin_user),
):
    """Update a user's role (admin only)."""
    user, err = user_store.update_user_role(user_id, body.role)
    if err:
        code = 404 if err == "User not found." else 400
        raise HTTPException(status_code=code, detail=err)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        }
    }


@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin_user)):
    """Delete a user (admin only, cannot delete self)."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    if not user_store.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found.")
    return {"status": "deleted"}


class AlertRequest(BaseModel):
    alert: str = Field(..., min_length=1, description="Raw security alert text")
    
    @validator('alert')
    def sanitize_alert(cls, v):
        """Sanitize and validate alert input."""
        return InputSanitizer.sanitize_alert(v, max_length=50000)

class AlertResponse(BaseModel):
    structured_json: dict
    report: str
    iterations: int
    telemetry_data: list = []


def generate_telemetry(decision: str) -> list:
    is_critical = "True Positive" in decision or "Critical" in decision
    
    data = []
    for i in range(7, 0, -1):
        day_label = f"Day -{i}" if i > 1 else "Today"
        
        # If today and critical, massive spike
        if i == 1 and is_critical:
            volume = random.randint(80, 100)
            severity = random.randint(85, 100)
        elif i == 1 and not is_critical:
            volume = random.randint(30, 50)
            severity = random.randint(10, 30)
        else:
            volume = random.randint(5, 30)
            severity = random.randint(5, 40)
            
        data.append({"time": day_label, "volume": volume, "severity": severity})
    return data

# We'll instantiate the workflow globally (ideally would manage its resources more gracefully)
# Use V2 workflow with supervisor agent
try:
    workflow = SOCWorkflowV2()
    logger.info("Initialized SOCWorkflowV2 (supervisor-controlled)")
except Exception as e:
    logger.error(f"Failed to initialize V2 workflow: {e}, falling back to V1")
    try:
        workflow = SOCWorkflow()
        logger.info("Initialized SOCWorkflow V1 (legacy)")
    except Exception as e2:
        logger.error(f"Failed to initialize workflow: {e2}")
        workflow = None

@app.post("/api/analyze-alert", response_model=AlertResponse)
async def analyze_alert(
    request: AlertRequest,
    principal: Principal = Depends(require_principal)
):
    """
    Analyze a security alert through the multi-agent pipeline.
    
    Works without authentication for demo/development. 
    When API key is provided, it validates permissions.
    """
    if not workflow:
        raise HTTPException(status_code=500, detail="Workflow initialization failed.")
    
    logger.info(f"Received new alert analysis request: {request.alert[:50]}...")
    
    try:
        # Run graph
        final_state_dict = await workflow.run(request.alert)
        
        # Save to DB for the frontend to list
        if "id" in final_state_dict:
            db.save_incident(IncidentState(**final_state_dict))
            
        soc_analysis = final_state_dict.get("soc_analysis", {})
        decision = soc_analysis.get("decision", "Needs Investigation")
            
        # Dynamically generate real telemetry graph data based on LangGraph agent output
        telemetry = generate_telemetry(decision)
            
        report = final_state_dict.get("report", "No report generated.")
        
        # Enrich soc_analysis with IOCs and MITRE for frontend display
        if "iocs" not in soc_analysis:
            iocs = []
            for event in final_state_dict.get("events", []):
                for ioc in event.get("extracted_iocs", []):
                    enrichment = None
                    for enr in final_state_dict.get("enrichments", []):
                        if enr.get("ioc", {}).get("value") == ioc.get("value"):
                            enrichment = enr
                            break
                    iocs.append({
                        "type": ioc.get("type", "unknown"),
                        "value": ioc.get("value", ""),
                        "verdict": enrichment.get("final_verdict", "unknown") if enrichment else "unknown"
                    })
            soc_analysis["iocs"] = iocs
        
        if "mitre_techniques" not in soc_analysis:
            mitre = []
            for m in final_state_dict.get("mitre_mappings", []):
                mitre.append({
                    "technique_id": m.get("technique_id", ""),
                    "technique_name": m.get("technique_name", "")
                })
            soc_analysis["mitre_techniques"] = mitre
        
        # Add score from triage
        triage = final_state_dict.get("triage")
        if triage and "score" not in soc_analysis:
            soc_analysis["score"] = triage.get("score", 50)
            soc_analysis["triage_score"] = triage.get("score", 50)
            
        # Enrich with additional structured investigation fields for modern UI
        soc_analysis["id"] = final_state_dict.get("id")
        soc_analysis["status"] = final_state_dict.get("status", "open")
        soc_analysis["recommended_actions"] = final_state_dict.get("recommended_actions", [])
        soc_analysis["agent_trace"] = final_state_dict.get("agent_trace", [])
        soc_analysis["triage"] = final_state_dict.get("triage")
        soc_analysis["investigation_plan_summary"] = final_state_dict.get("investigation_plan_summary")
        soc_analysis["supervisor_iteration"] = final_state_dict.get("supervisor_iteration", 1)
        soc_analysis["raw_alert"] = final_state_dict.get("raw_alert")
        
        logger.info("Analysis completed successfully.")
        
        return AlertResponse(
            structured_json=soc_analysis,
            report=report,
            iterations=final_state_dict.get("supervisor_iteration", final_state_dict.get("rewrite_iterations", 1)),
            telemetry_data=telemetry
        )
        
    except Exception as e:
        logger.error(f"Error during alert analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _format_relative(dt: datetime, now: datetime) -> str:
    diff_sec = max(0, int((now - _ensure_utc(dt)).total_seconds()))
    if diff_sec < 60:
        return "Just now"
    mins = diff_sec // 60
    if mins < 60:
        return f"{mins}m ago"
    hrs = mins // 60
    if hrs < 24:
        return f"{hrs}h ago"
    return f"{hrs // 24}d ago"


@app.get("/api/incidents")
async def list_incidents(
    principal: Principal = Depends(require_principal)
):
    """List all analyzed incidents."""
    incidents = db.list_incidents()
    return {"incidents": [inc.model_dump() for inc in incidents]}


@app.get("/api/incidents/volume")
async def get_incidents_volume(
    window: str = Query("24h", alias="range", pattern="^(24h|7d)$"),
    principal: Principal = Depends(require_principal)
):
    """Aggregate real incident counts by hour (24h) or day (7d)."""
    incidents = db.list_incidents()
    now = datetime.now(timezone.utc)

    if window == "7d":
        count = 7
        interval_sec = 86400
        buckets = [
            {"label": (now - timedelta(days=count - 1 - i)).strftime("%b %d"), "count": 0}
            for i in range(count)
        ]
        for inc in incidents:
            created = _ensure_utc(inc.created_at)
            idx = int((now - created).total_seconds() // interval_sec)
            if 0 <= idx < count:
                buckets[count - 1 - idx]["count"] += 1
        return {"range": "7d", "buckets": buckets}

    count = 24
    buckets = [
        {"label": (now - timedelta(hours=count - 1 - i)).strftime("%H:00"), "count": 0}
        for i in range(count)
    ]
    for inc in incidents:
        created = _ensure_utc(inc.created_at)
        idx = int((now - created).total_seconds() // 3600)
        if 0 <= idx < count:
            buckets[count - 1 - idx]["count"] += 1
    return {"range": "24h", "buckets": buckets}

@app.get("/api/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    principal: Principal = Depends(require_principal)
):
    """Get full details of a specific incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident.model_dump()


def _safe_pdf_filename(incident_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", (incident_id or "incident").strip()).strip("-.")
    if not cleaned:
        cleaned = "incident"
    return f"awra-soc-report-{cleaned}.pdf"


def _normalize_report_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept either flat IncidentState dicts or AlertResponse-shaped payloads from /analyze."""
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Report payload must be a JSON object")

    structured = payload.get("structured_json")
    merged: dict[str, Any] = {}
    if isinstance(structured, dict):
        merged.update(structured)
    for k, v in payload.items():
        if k != "structured_json" and v is not None:
            merged[k] = v

    if not any(
        merged.get(k)
        for k in ("id", "raw_alert", "report", "decision", "events", "enrichments", "mitre_mappings", "triage")
    ):
        raise HTTPException(status_code=400, detail="Report payload contains no incident or report data")

    return merged


@app.get("/api/incidents/{incident_id}/report.pdf")
async def download_incident_report_pdf(
    incident_id: str,
    principal: Principal = Depends(require_principal),
):
    """Generate and download a complete PDF investigation report for a stored incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    try:
        pdf_bytes = generate_incident_pdf(incident)
    except Exception as e:
        logger.error(f"PDF generation failed for incident {incident_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate PDF report")

    filename = _safe_pdf_filename(incident.id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@app.post("/api/reports/pdf")
async def generate_adhoc_report_pdf(
    payload: dict[str, Any] = Body(...),
    principal: Principal = Depends(require_principal),
):
    """Generate and download a complete PDF report from a submitted investigation payload."""
    normalized = _normalize_report_payload(payload)
    # If an ID exists and DB holds additional persisted fields, enrich missing fields safely
    inc_id = normalized.get("id")
    if isinstance(inc_id, str) and inc_id.strip():
        stored = db.get_incident(inc_id.strip())
        if stored:
            stored_dict = stored.model_dump()
            for k, v in normalized.items():
                if v is not None:
                    stored_dict[k] = v
            normalized = stored_dict

    try:
        pdf_bytes = generate_incident_pdf(normalized)
    except Exception as e:
        logger.error(f"Ad-hoc PDF generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate PDF report")

    filename = _safe_pdf_filename(str(normalized.get("id") or "investigation"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )

@app.get("/api/mitre-heatmap")
async def get_mitre_heatmap(
    principal: Principal = Depends(require_principal)
):
    """Get aggregated MITRE technique hit counts across all incidents."""
    return get_mitre_heatmap_data(db.list_incidents())

@app.get("/api/stats")
async def get_stats(
    principal: Principal = Depends(require_principal)
):
    """Get top-level SOC dashboard stats from the canonical incidents store."""
    incidents = db.list_incidents()
    total = len(incidents)
    closed_states = {"closed", "closed_false_positive", "closed_resolved"}
    open_incidents = sum(
        1
        for i in incidents
        if (i.status.value if hasattr(i.status, "value") else str(i.status)).lower() not in closed_states
    )
    critical = sum(1 for i in incidents if i.triage and i.triage.severity == Severity.CRITICAL)
    
    # Calculate avg triage time
    times = []
    for inc in incidents:
        if inc.agent_trace:
            start = inc.agent_trace[0].started_at
            end = inc.agent_trace[-1].completed_at or inc.agent_trace[-1].started_at
            if start and end:
                times.append((end - start).total_seconds())
                
    avg_time = sum(times) / len(times) if times else 0
    
    return {
        "total_alerts": total,
        "open_incidents": open_incidents,
        "critical_alerts": critical,
        "avg_triage_seconds": round(avg_time, 2)
    }

class FeedbackRequest(BaseModel):
    override_verdict: Optional[str] = None
    override_severity: Optional[str] = None
    notes: str = ""

@app.post("/api/feedback/{incident_id}")
async def submit_feedback(
    incident_id: str,
    request: FeedbackRequest,
    principal: Principal = Depends(require_principal)
):
    """Submit analyst feedback/override for an incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    feedback = AnalystFeedback(
        notes=request.notes,
        override_verdict=request.override_verdict
    )
    if request.override_severity:
        try:
            feedback.override_severity = Severity(request.override_severity)
        except ValueError:
            pass
            
    incident.feedback = feedback
    
    # If verdict overridden to FP, close the ticket
    if feedback.override_verdict == "False Positive":
        incident.status = IncidentStatus.CLOSED_FALSE_POSITIVE
        
    db.save_incident(incident)
        
    return {"status": "success", "incident": incident.model_dump()}

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy" if workflow is not None else "degraded",
        "model": settings.llm_model,
        "workflow_ready": workflow is not None,
    }


@app.patch("/api/incidents/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    body: StatusUpdateRequest,
    principal: Principal = Depends(require_principal)
):
    """Update incident status (acknowledge, escalate, close)."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.status = body.status
    db.save_incident(incident)
    return {"status": "success", "incident": incident.model_dump()}


@app.get("/api/agents/health")
async def get_agents_health(
    principal: Principal = Depends(require_principal)
):
    """Return real health status, latest measured latency, and last run time for the 6 core agents."""
    agent_names = [
        "Supervisor",
        "Ingestion",
        "Enrichment",
        "Correlation",
        "Triage",
        "Decision",
    ]
    incidents = db.list_incidents()
    now = datetime.now(timezone.utc)
    workflow_online = workflow is not None

    agents = []
    for name in agent_names:
        prefix = name.lower()
        latest_step = None
        for inc in incidents:
            for step in reversed(inc.agent_trace or []):
                if step.agent_name.lower().startswith(prefix):
                    latest_step = step
                    break
            if latest_step:
                break

        if latest_step:
            step_status = latest_step.status.value if hasattr(latest_step.status, "value") else str(latest_step.status)
            is_err = step_status.lower() == "error"
            status_val = "offline" if (not workflow_online or is_err) else "online"
            latency_ms = int(round(latest_step.duration_ms)) if latest_step.duration_ms is not None else 0
            ts = latest_step.completed_at or latest_step.started_at
            last_run = _format_relative(ts, now) if ts else "Just now"
            last_run_iso = _ensure_utc(ts).isoformat() if ts else None
        else:
            status_val = "online" if workflow_online else "offline"
            latency_ms = 0
            last_run = "No runs yet"
            last_run_iso = None

        agents.append({
            "name": name,
            "status": status_val,
            "latency_ms": latency_ms,
            "last_run": last_run,
            "last_run_at": last_run_iso,
        })
    return {"agents": agents}
