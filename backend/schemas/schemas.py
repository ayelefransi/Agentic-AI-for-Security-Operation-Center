"""
Unified Pydantic v2 schemas for the SOC Agent multi-agent pipeline.

Every agent takes and returns validated schemas — no raw dict passing.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────

class IOCType(str, Enum):
    IP = "ip"
    DOMAIN = "domain"
    HASH = "hash"
    URL = "url"
    EMAIL = "email"


class Verdict(str, Enum):
    MALICIOUS = "malicious"
    SUSPICIOUS = "suspicious"
    BENIGN = "benign"
    UNKNOWN = "unknown"


class Severity(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    ESCALATED = "escalated"
    CLOSED_FALSE_POSITIVE = "closed_false_positive"
    CLOSED_RESOLVED = "closed_resolved"


class AgentNodeStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"
    SKIPPED = "skipped"


# ── Core Data Models ──────────────────────────────────────────────────────────

class IOC(BaseModel):
    """An individual Indicator of Compromise extracted from a security event."""
    type: IOCType
    value: str
    context: str = Field(default="", description="Surrounding text or field where IOC was found")


class EnrichmentResult(BaseModel):
    """Result from a single threat-intel source for a single IOC."""
    ioc: IOC
    source: str = Field(description="Name of the threat intel source (e.g., 'virustotal', 'abuseipdb')")
    verdict: Verdict = Verdict.UNKNOWN
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    raw_data: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    cached: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class IOCEnrichmentSummary(BaseModel):
    """Merged enrichment for a single IOC across all sources."""
    ioc: IOC
    results: list[EnrichmentResult] = Field(default_factory=list)
    final_verdict: Verdict = Verdict.UNKNOWN
    final_confidence: float = 0.0
    tags: list[str] = Field(default_factory=list)


class MITREMapping(BaseModel):
    """A single MITRE ATT&CK technique match."""
    tactic: str = Field(description="ATT&CK Tactic (e.g., 'Initial Access')")
    technique_id: str = Field(description="ATT&CK Technique ID (e.g., 'T1566')")
    technique_name: str = Field(description="ATT&CK Technique name (e.g., 'Phishing')")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    evidence: str = Field(default="", description="What in the alert triggered this mapping")


class TriageScore(BaseModel):
    """Weighted triage score for an incident."""
    score: float = Field(ge=0.0, le=100.0, description="Numeric score 0-100")
    severity: Severity = Severity.LOW
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    breakdown: dict[str, float] = Field(
        default_factory=dict,
        description="Score breakdown by factor: ioc_reputation, mitre_severity, frequency, asset_criticality"
    )


class SecurityEvent(BaseModel):
    """Normalized security event — the canonical input to the pipeline."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="manual", description="Source system (e.g., 'siem', 'edr', 'manual')")
    event_type: str = Field(default="unknown")
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    user: Optional[Union[str, dict[str, Any]]] = None
    hostname: Optional[str] = None
    file_hash: Optional[str] = None
    url: Optional[str] = None
    domain: Optional[str] = None
    port: Optional[int] = None
    protocol: Optional[str] = None
    raw_log: str = ""
    severity_hint: Optional[Severity] = None
    extracted_iocs: list[IOC] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AnalystFeedback(BaseModel):
    """Human analyst override / confirmation."""
    analyst_id: str = "analyst"
    override_verdict: Optional[str] = None
    override_severity: Optional[Severity] = None
    notes: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentStepLog(BaseModel):
    """Audit log entry for a single agent execution."""
    agent_name: str
    status: AgentNodeStatus
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    input_summary: str = ""
    output_summary: str = ""
    error: Optional[str] = None


# ── Incident State (append-only, used by the graph orchestrator) ──────────────

class IncidentState(BaseModel):
    """
    The shared state object passed through the multi-agent graph.
    
    Design: append-only event log. Each agent reads what it needs and appends
    its outputs. No mutation-in-place so any node can be replayed/debugged.
    """
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Input
    raw_alert: str = ""
    
    # Ingestion output
    events: list[SecurityEvent] = Field(default_factory=list)
    
    # Enrichment output
    enrichments: list[IOCEnrichmentSummary] = Field(default_factory=list)
    
    # MITRE mapping output
    mitre_mappings: list[MITREMapping] = Field(default_factory=list)
    
    # Existing RAG analysis (kept for backward compat)
    optimized_query: str = ""
    retrieved_docs: list[dict[str, Any]] = Field(default_factory=list)
    rewrite_iterations: int = 0
    is_sufficient: bool = False
    soc_analysis: Optional[dict[str, Any]] = None
    
    # Triage output
    triage: Optional[TriageScore] = None
    
    # Decision output
    decision: Optional[str] = None
    decision_reasoning: str = ""
    recommended_actions: list[str] = Field(default_factory=list)
    status: IncidentStatus = IncidentStatus.OPEN
    
    # Report output
    report: str = ""
    
    # Telemetry (for UI charts)
    telemetry_data: list[dict[str, Any]] = Field(default_factory=list)
    
    # Agent execution trace (audit trail)
    agent_trace: list[AgentStepLog] = Field(default_factory=list)
    
    # Analyst feedback
    feedback: Optional[AnalystFeedback] = None
