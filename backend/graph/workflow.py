"""
LangGraph Orchestrator for the full multi-agent SOC pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from agents.correlation_agent import CorrelationAgent
from agents.decision_agent import DecisionAgent
from agents.enrichment_agent import EnrichmentAgent
from agents.ingestion_agent import IngestionAgent
from agents.mitre_agent import MITREAgent
from agents.reporter import ReporterAgent
from agents.triage_agent import TriageAgent
from schemas.schemas import IncidentState

logger = logging.getLogger(__name__)


class SOCWorkflow:
    def __init__(self):
        # Instantiate agents
        self.ingestion = IngestionAgent()
        self.enrichment = EnrichmentAgent()
        self.mitre = MITREAgent()
        self.correlation = CorrelationAgent()
        self.triage = TriageAgent()
        self.decision = DecisionAgent()
        
        # Keep ReporterAgent for backward compatibility (we might rewrite it later,
        # but for now we'll just adapt its input)
        self.reporter = ReporterAgent()
        
        self.graph = self._build_graph()

    def _build_graph(self):
        # Create a StateGraph using our new IncidentState Pydantic model
        # Note: LangGraph accepts TypedDict natively, but can also work with Pydantic
        # models if wrapped properly, or we can just pass dicts that conform to it.
        # The easiest approach is passing the Pydantic model itself if LangGraph >=0.2 supports it.
        # (It does, StateGraph takes a type).
        workflow = StateGraph(IncidentState)

        # Add nodes
        workflow.add_node("ingestion", self.node_ingestion)
        workflow.add_node("enrichment", self.node_enrichment)
        workflow.add_node("mitre", self.node_mitre)
        workflow.add_node("correlation", self.node_correlation)
        workflow.add_node("triage", self.node_triage)
        workflow.add_node("decision", self.node_decision)
        workflow.add_node("reporter", self.node_reporter)

        # Set entry point
        workflow.set_entry_point("ingestion")

        # Define edges (Sequential pipeline)
        # Note: Enrichment and MITRE could run in parallel conceptually, 
        # but StateGraph sequential is simpler to trace.
        workflow.add_edge("ingestion", "enrichment")
        workflow.add_edge("enrichment", "mitre")
        workflow.add_edge("mitre", "correlation")
        workflow.add_edge("correlation", "triage")
        workflow.add_edge("triage", "decision")
        workflow.add_edge("decision", "reporter")
        workflow.add_edge("reporter", END)

        # Compile the graph
        return workflow.compile()

    # ── Node Functions ────────────────────────────────────────────────────────

    async def node_ingestion(self, state: IncidentState):
        logger.info("--- NODE: INGESTION ---")
        return await self.ingestion.run(state)

    async def node_enrichment(self, state: IncidentState):
        logger.info("--- NODE: ENRICHMENT ---")
        return await self.enrichment.run(state)

    async def node_mitre(self, state: IncidentState):
        logger.info("--- NODE: MITRE ---")
        return await self.mitre.run(state)

    async def node_correlation(self, state: IncidentState):
        logger.info("--- NODE: CORRELATION ---")
        return await self.correlation.run(state)

    async def node_triage(self, state: IncidentState):
        logger.info("--- NODE: TRIAGE ---")
        return await self.triage.run(state)

    async def node_decision(self, state: IncidentState):
        logger.info("--- NODE: DECISION ---")
        return await self.decision.run(state)

    async def node_reporter(self, state: IncidentState):
        logger.info("--- NODE: REPORTER ---")
        # Adapt our old reporter to use the new state
        
        # Backward compat for the UI which expects 'decision' inside 'soc_analysis'
        state.soc_analysis = {
            "classification": state.decision or "Needs Investigation",
            "decision": state.decision or "Needs Investigation", # For UI telemetry function
            "reasoning": state.decision_reasoning,
            "evidence": [],
            "confidence_score": state.triage.confidence if state.triage else 0.5,
            "recommended_action": "\\n".join(state.recommended_actions)
        }
        
        # Generate the report string
        report = ""
        report += f"### 🚨 Incident Summary\n"
        report += f"**Verdict:** `{state.decision}`\n"
        
        if state.triage:
            report += f"**Severity:** `{state.triage.severity.value}` (Score: {state.triage.score}/100)\n"
            
        report += f"\n### 🧠 Reasoning\n{state.decision_reasoning}\n\n"
        
        if state.events:
            report += f"### 📝 Extracted Entities\n"
            for ev in state.events:
                report += f"- Type: `{ev.event_type}`\n"
                for ioc in ev.extracted_iocs:
                    report += f"  - `{ioc.type.value}`: {ioc.value}\n"
            report += "\n"
            
        if state.enrichments:
            report += f"### 🔬 Threat Intel Enrichment\n"
            for enr in state.enrichments:
                icon = "🔴" if enr.final_verdict.value == "malicious" else "🟡" if enr.final_verdict.value == "suspicious" else "🟢"
                report += f"- {icon} **{enr.ioc.value}** - {enr.final_verdict.value.upper()}\n"
                for r in enr.results:
                    if not r.error:
                        report += f"  - _{r.source}_: {r.verdict.value} (conf: {r.confidence})\n"
            report += "\n"
            
        if state.mitre_mappings:
            report += f"### 🗺️ MITRE ATT&CK Mappings\n"
            for m in state.mitre_mappings:
                report += f"- **{m.technique_id}** {m.technique_name} [{m.tactic}]\n"
            report += "\n"
            
        if state.recommended_actions:
            report += f"### ⚡ Recommended Actions\n"
            for a in state.recommended_actions:
                report += f"- {a}\n"
        
        state.report = report
        
        # Ensure rewrite_iterations is returned (for UI compat)
        state.rewrite_iterations = 1
        
        return state

    async def run(self, raw_alert: str) -> dict[str, Any]:
        """
        Public entry point. Creates a new IncidentState and runs it through the graph.
        Returns the final state as a dictionary.
        """
        initial_state = IncidentState(raw_alert=raw_alert)
        
        # Run graph
        final_state = await self.graph.ainvoke(initial_state)
        
        # Pydantic models in LangGraph v0.2+ are returned as dicts or models depending on setup.
        # We ensure it's a dict for API serialization.
        if isinstance(final_state, IncidentState):
            return final_state.model_dump()
        return final_state
