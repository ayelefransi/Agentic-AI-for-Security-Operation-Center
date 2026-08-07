"""
Triage Agent — calculates a weighted severity score based on IOC enrichment,
MITRE mappings, and event frequency.
"""

from __future__ import annotations

import logging

from agents.base_agent import BaseAgent
from schemas.schemas import IncidentState, Severity, TriageScore, Verdict

logger = logging.getLogger(__name__)


class TriageAgent(BaseAgent):
    """
    Scores an incident from 0-100 and assigns a severity.
    
    Weights:
    - 40% MITRE ATT&CK tactics/techniques severity
    - 40% IOC Reputation (from enrichment)
    - 20% Base severity hint from ingestion
    """

    name = "triage_agent"

    async def _process(self, state: IncidentState) -> IncidentState:
        score = 0.0
        breakdown: dict[str, float] = {
            "ioc_reputation": 0.0,
            "mitre_severity": 0.0,
            "base_severity": 0.0,
        }

        # 1. Base Severity Hint (20 points max)
        base_pts = 0.0
        for event in state.events:
            if event.severity_hint == Severity.CRITICAL:
                base_pts = max(base_pts, 20.0)
            elif event.severity_hint == Severity.HIGH:
                base_pts = max(base_pts, 15.0)
            elif event.severity_hint == Severity.MEDIUM:
                base_pts = max(base_pts, 10.0)
            elif event.severity_hint == Severity.LOW:
                base_pts = max(base_pts, 5.0)
        breakdown["base_severity"] = base_pts
        score += base_pts

        # 2. IOC Reputation (40 points max)
        ioc_pts = 0.0
        malicious_count = 0
        suspicious_count = 0
        
        for enrichment in state.enrichments:
            if enrichment.final_verdict == Verdict.MALICIOUS:
                malicious_count += 1
            elif enrichment.final_verdict == Verdict.SUSPICIOUS:
                suspicious_count += 1
                
        if malicious_count > 0:
            # 1 malicious = 30 pts, 2+ = 40 pts
            ioc_pts = min(30.0 + (malicious_count - 1) * 10.0, 40.0)
        elif suspicious_count > 0:
            ioc_pts = min(15.0 + suspicious_count * 5.0, 25.0)
            
        breakdown["ioc_reputation"] = ioc_pts
        score += ioc_pts

        # 3. MITRE ATT&CK Severity (40 points max)
        mitre_pts = 0.0
        critical_tactics = {"Execution", "Privilege Escalation", "Defense Evasion", 
                          "Credential Access", "Lateral Movement", "Exfiltration", "Impact"}
        
        high_severity_tactics = 0
        other_tactics = 0
        
        for mapping in state.mitre_mappings:
            if mapping.tactic in critical_tactics:
                high_severity_tactics += 1
            else:
                other_tactics += 1
                
        mitre_pts += high_severity_tactics * 15.0
        mitre_pts += other_tactics * 5.0
        mitre_pts = min(mitre_pts, 40.0)
        
        breakdown["mitre_severity"] = mitre_pts
        score += mitre_pts

        # Cap at 100
        score = min(score, 100.0)

        # Determine textual severity
        if score >= 80.0:
            severity = Severity.CRITICAL
        elif score >= 60.0:
            severity = Severity.HIGH
        elif score >= 35.0:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        # Calculate confidence based on how much data we had
        confidence = 0.5
        if state.enrichments and state.mitre_mappings:
            confidence = 0.9
        elif state.enrichments or state.mitre_mappings:
            confidence = 0.7

        state.triage = TriageScore(
            score=round(score, 1),
            severity=severity,
            confidence=confidence,
            breakdown=breakdown,
        )

        logger.info(f"Triage complete: {severity.value} ({score:.1f}/100)")
        return state
