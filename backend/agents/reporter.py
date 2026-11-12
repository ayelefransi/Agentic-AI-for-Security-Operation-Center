from __future__ import annotations
import logging
from agents.base_agent import BaseAgent
from agents.reporter_v2 import ReporterAgent as ReporterAgentV2
from schemas.schemas import IncidentState
from schemas.alert_schema import SOCAgentOutput

logger = logging.getLogger(__name__)

class ReporterAgent(BaseAgent):
    """
    ReporterAgent supporting both BaseAgent run(state) interface (for LangGraph workflows)
    and legacy generate_report(alert, analysis) interface.
    """
    name = "reporter_agent"

    def __init__(self):
        self._v2_reporter = ReporterAgentV2()

    async def _process(self, state: IncidentState) -> IncidentState:
        return await self._v2_reporter._process(state)

    def generate_report(self, alert: str, analysis: SOCAgentOutput) -> str:
        evidence_str = ""
        if analysis.evidence:
            for i, ev in enumerate(analysis.evidence):
                evidence_str += f"- **[Source {ev.source_id}]** {ev.excerpt}\n"
        else:
            evidence_str = "- No contextual logs or policies retrieved.\n"

        report = f"""### General Alert Summary
{alert}

### Triage Analytics
- **Classification Verdict:** `{analysis.classification}`
- **System Confidence:** `{analysis.confidence_score * 100:.1f}%`

### Root Cause Reasoning
{analysis.reasoning}

### Correlated Evidence & Telemetry
{evidence_str}
### Requested Countermeasures
- {analysis.recommended_action}
"""
        return report
