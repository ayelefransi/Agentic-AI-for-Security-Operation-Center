"""
Decision Agent — uses an LLM to generate a natural language summary,
final verdict, and recommended actions based on all previous pipeline context.
"""

from __future__ import annotations

import logging
import os

from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field

from agents.base_agent import BaseAgent
from config.settings import settings
from schemas.schemas import IncidentState, IncidentStatus, Severity

logger = logging.getLogger(__name__)


# Schema for structured output from the LLM
class DecisionOutput(BaseModel):
    decision: str = Field(description="Must be exactly 'True Positive', 'False Positive', or 'Needs Investigation'")
    reasoning: str = Field(description="1-2 paragraph executive summary explaining the verdict based on evidence")
    recommended_actions: list[str] = Field(description="List of 2-5 actionable steps for the SOC team to take")


class DecisionAgent(BaseAgent):
    """
    Acts as the final SOC Analyst. Reviews all structured data (events,
    enrichments, MITRE, triage) and produces the final decision narrative.
    """

    name = "decision_agent"

    def __init__(self):
        # We assume GROQ_API_KEY is available
        self.llm = ChatGroq(
            model=settings.llm_model,
            temperature=0.1,
            api_key=settings.groq_api_key or os.environ.get("GROQ_API_KEY", "")
        )
        self.structured_llm = self.llm.with_structured_output(DecisionOutput)
        
        self.prompt = PromptTemplate(
            template="""You are an expert Security Operations Center (SOC) Analyst.
Review the following incident context and make a final determination.

### Raw Alert
{raw_alert}

### Extracted IOCs & Enrichment
{enrichments}

### MITRE ATT&CK Mappings
{mitre}

### Automated Triage Score
Score: {triage_score}/100
Severity: {triage_severity}

Instructions:
1. If there are malicious IOCs or Critical MITRE tactics (e.g. Exfiltration, Ransomware), classify as 'True Positive'.
2. If it's a known safe IP or benign behavior, classify as 'False Positive'.
3. Otherwise, classify as 'Needs Investigation'.
4. Provide a clear, professional reasoning narrative.
5. Provide actionable recommendations (e.g., "Isolate host X", "Block IP Y on firewall").

Analyze and output JSON.
""",
            input_variables=["raw_alert", "enrichments", "mitre", "triage_score", "triage_severity"]
        )

    async def _process(self, state: IncidentState) -> IncidentState:
        if not state.triage:
            logger.warning("No triage score found, skipping decision")
            return state

        # Format enrichments for the prompt
        enrichment_strs = []
        for e in state.enrichments:
            enrichment_strs.append(f"- {e.ioc.type.value}:{e.ioc.value} -> {e.final_verdict.value} (Confidence: {e.final_confidence})")
        enrichments_text = "\n".join(enrichment_strs) if enrichment_strs else "None found."

        # Format MITRE for the prompt
        mitre_strs = []
        for m in state.mitre_mappings:
            mitre_strs.append(f"- {m.technique_id} ({m.technique_name}) [{m.tactic}]")
        mitre_text = "\n".join(mitre_strs) if mitre_strs else "None mapped."

        try:
            chain = self.prompt | self.structured_llm
            result: DecisionOutput = await chain.ainvoke({
                "raw_alert": state.raw_alert,
                "enrichments": enrichments_text,
                "mitre": mitre_text,
                "triage_score": state.triage.score,
                "triage_severity": state.triage.severity.value,
            })

            state.decision = result.decision
            state.decision_reasoning = result.reasoning
            state.recommended_actions = result.recommended_actions

            # Update state status based on decision
            if result.decision == "False Positive":
                state.status = IncidentStatus.CLOSED_FALSE_POSITIVE
            elif state.triage.severity in (Severity.HIGH, Severity.CRITICAL):
                state.status = IncidentStatus.ESCALATED
            else:
                state.status = IncidentStatus.OPEN

            logger.info(f"Decision complete: {result.decision}")

        except Exception as e:
            logger.error(f"LLM decision failed: {e}")
            state.decision = "Error"
            state.decision_reasoning = f"Failed to generate decision: {e}"
            state.status = IncidentStatus.OPEN

        return state
