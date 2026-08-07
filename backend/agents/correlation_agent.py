"""
Correlation Agent — groups related events into a single incident state.
(In this standalone architecture, it mainly deduplicates IOCs if multiple
events were ingested at once).
"""

from __future__ import annotations

import logging

from agents.base_agent import BaseAgent
from schemas.schemas import IncidentState, IOC

logger = logging.getLogger(__name__)


class CorrelationAgent(BaseAgent):
    """
    Analyzes multiple events in the incident state, deduplicates IOCs,
    and identifies cross-event relationships.
    """

    name = "correlation_agent"

    async def _process(self, state: IncidentState) -> IncidentState:
        if len(state.events) <= 1:
            # Nothing to correlate
            return state

        # Deduplicate IOCs across all events
        unique_iocs: dict[str, IOC] = {}
        for event in state.events:
            for ioc in event.extracted_iocs:
                key = f"{ioc.type.value}:{ioc.value.lower()}"
                if key not in unique_iocs:
                    unique_iocs[key] = ioc
                else:
                    # Append context if we've seen this IOC before
                    if ioc.context and ioc.context not in unique_iocs[key].context:
                        unique_iocs[key].context += f" | {ioc.context}"

        logger.info(f"Correlated {len(state.events)} events down to {len(unique_iocs)} unique IOCs")
        return state
