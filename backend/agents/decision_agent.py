"""
Decision Agent — uses an LLM to generate a natural language summary,
final verdict, and recommended actions based on all previous pipeline context.
"""

from __future__ import annotations

import json
import logging
import os
import re

from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field

from agents.base_agent import BaseAgent
from config.settings import settings
from schemas.schemas import IncidentState, IncidentStatus, Severity

logger = logging.getLogger(__name__)


class DecisionOutput(BaseModel):
    decision: str = Field(description="Must be exactly 'True Positive', 'False Positive', or 'Needs Investigation'")
    reasoning: str = Field(description="1-2 paragraph executive summary explaining the verdict based on evidence")
    recommended_actions: list[str] = Field(default_factory=list, description="List of 2-5 actionable steps for the SOC team to take")


class DecisionAgent(BaseAgent):
    """
    Acts as the final SOC Analyst. Reviews all structured data (events,
    enrichments, MITRE, triage) and produces the final decision narrative.
    """

    name = "decision_agent"

    def __init__(self):
        self.llm = ChatGroq(
            model=settings.llm_model,
            temperature=0.1,
            api_key=settings.groq_api_key or os.environ.get("GROQ_API_KEY", "")
        )
        
        self.prompt = PromptTemplate(
            template="""You are an expert Security Operations Center (SOC) Analyst.
Review the following incident context and make a final determination.

### Raw Alert
{raw_alert}

### Extracted IOCs & Threat Intelligence
{enrichments}

### MITRE ATT&CK Mappings
{mitre}

### Automated Triage Score
Score: {triage_score}/100
Severity: {triage_severity}

### Classification Guidelines
1. If there are malicious IOCs or Critical/High MITRE tactics (e.g. Exfiltration, Ransomware, Credential Dumping), classify as 'True Positive'.
2. If it's a confirmed benign scanner, internal approved test, or false alert, classify as 'False Positive'.
3. Otherwise, classify as 'Needs Investigation'.

CRITICAL: You MUST respond ONLY with a valid JSON object matching this exact schema:
{{
  "decision": "True Positive",
  "reasoning": "Detailed 1-2 paragraph executive reasoning explaining why this verdict was chosen.",
  "recommended_actions": [
    "Step 1 mitigation",
    "Step 2 containment"
  ]
}}
Do NOT output markdown code fences or any text before/after the JSON.
""",
            input_variables=["raw_alert", "enrichments", "mitre", "triage_score", "triage_severity"]
        )

    async def _process(self, state: IncidentState) -> IncidentState:
        # Format enrichments for the prompt
        enrichment_strs = []
        has_malicious_ioc = False
        for e in state.enrichments:
            is_mal = e.final_verdict.value in ("malicious", "suspicious")
            if e.final_verdict.value == "malicious":
                has_malicious_ioc = True
            enrichment_strs.append(f"- {e.ioc.type.value}:{e.ioc.value} -> {e.final_verdict.value} (Confidence: {e.final_confidence:.0%})")
        enrichments_text = "\n".join(enrichment_strs) if enrichment_strs else "None found."

        # Format MITRE for the prompt
        mitre_strs = []
        for m in state.mitre_mappings:
            mitre_strs.append(f"- {m.technique_id} ({m.technique_name}) [{m.tactic}]")
        mitre_text = "\n".join(mitre_strs) if mitre_strs else "None mapped."

        triage_score = state.triage.score if state.triage else 50.0
        triage_severity = state.triage.severity.value if state.triage else "Medium"

        decision = None
        reasoning = None
        actions = []

        try:
            # First attempt: direct invocation with JSON extraction
            response = await (self.prompt | self.llm).ainvoke({
                "raw_alert": state.raw_alert,
                "enrichments": enrichments_text,
                "mitre": mitre_text,
                "triage_score": triage_score,
                "triage_severity": triage_severity,
            })
            
            raw_text = response.content if hasattr(response, 'content') else str(response)
            
            # Extract JSON block
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                decision = parsed.get("decision")
                # Handle possible alternative key names from various LLMs
                reasoning = parsed.get("reasoning") or parsed.get("justification") or parsed.get("summary")
                actions = parsed.get("recommended_actions") or parsed.get("actions") or []
                if isinstance(actions, str):
                    actions = [actions]

        except Exception as e:
            logger.warning(f"LLM decision generation error: {e}, falling back to deterministic expert rules")

        # Fallback to deterministic expert SOC rules if LLM was unavailable or output was invalid
        if not decision or not reasoning:
            if has_malicious_ioc or triage_score >= 70 or triage_severity in ("High", "Critical"):
                decision = "True Positive"
                reasoning = (
                    f"Automated SOC Analysis: The alert has been classified as a True Positive threat with a high risk score of {triage_score:.0f}/100 ({triage_severity} severity). "
                    f"Indicators identified in this telemetry demonstrate active adversary technique execution ({mitre_text.splitlines()[0] if mitre_strs else 'Suspicious telemetry'}). "
                    f"Immediate containment and isolation protocols are required."
                )
                actions = [
                    "Immediately isolate affected endpoint from corporate network segment.",
                    "Block communicating external IP addresses/domains on perimeter firewall.",
                    "Revoke active Kerberos and OAuth tokens for compromised credentials.",
                    "Initiate memory acquisition and forensic triage."
                ]
            elif triage_score <= 25 and triage_severity == "Low" and not has_malicious_ioc:
                decision = "False Positive"
                reasoning = (
                    f"Automated SOC Analysis: Activity scored as {triage_score:.0f}/100 ({triage_severity} severity) with no confirmed malicious indicators. "
                    "Observed behavior is consistent with routine network operations or authorized scanning."
                )
                actions = [
                    "Log event in SIEM archive for compliance audit trail.",
                    "No containment action required; close alert ticket."
                ]
            else:
                decision = "Suspicious Activity"
                reasoning = (
                    f"Automated SOC Analysis: Alert exhibits anomalous indicators with a risk score of {triage_score:.0f}/100 ({triage_severity} severity). "
                    "Telemetry suggests unauthorized reconnaissance or probing. Requires continuous monitoring and correlation with firewall logs."
                )
                actions = [
                    "Add source indicator to 48-hour heightened monitoring watchlist.",
                    "Cross-reference internal proxy logs for secondary connection attempts.",
                    "Review authentication logs for matching source IP addresses."
                ]

        state.decision = decision
        state.decision_reasoning = reasoning
        state.recommended_actions = actions

        # Update state status based on decision
        if decision == "False Positive":
            state.status = IncidentStatus.CLOSED_FALSE_POSITIVE
        elif triage_severity in ("High", "Critical") or decision == "True Positive":
            state.status = IncidentStatus.ESCALATED
        else:
            state.status = IncidentStatus.OPEN

        logger.info(f"Decision complete: {state.decision} (Status: {state.status.value})")
        return state
