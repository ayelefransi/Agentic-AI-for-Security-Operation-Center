"""
LangGraph Orchestrator v2 — Supervisor-controlled multi-agent workflow.

This replaces the linear pipeline with dynamic routing, parallel execution,
and bounded investigation loops.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from langgraph.graph import END, StateGraph

from agents.correlation_agent import CorrelationAgent
from agents.decision_agent import DecisionAgent
from agents.enrichment_agent import EnrichmentAgent
from agents.ingestion_agent import IngestionAgent
from agents.mitre_agent import MITREAgent
from agents.reporter_v2 import ReporterAgent
from agents.supervisor_agent import SupervisorAgent
from agents.triage_agent import TriageAgent
from schemas.schemas import IncidentState

logger = logging.getLogger(__name__)


class SOCWorkflowV2:
    """
    Supervisor-controlled multi-agent SOC workflow with:
    - Dynamic agent selection based on alert type
    - Parallel agent execution where possible
    - Bounded investigation loops
    - Conditional routing
    """

    def __init__(self):
        # Instantiate all agents
        self.supervisor = SupervisorAgent()
        self.ingestion = IngestionAgent()
        self.enrichment = EnrichmentAgent()
        self.mitre = MITREAgent()
        self.correlation = CorrelationAgent()
        self.triage = TriageAgent()
        self.decision = DecisionAgent()
        self.reporter = ReporterAgent()
        
        # Placeholder agents for future implementation
        # These will return state unchanged for now
        self.threat_hunting = None  # Will be implemented in Phase 2
        self.digital_forensics = None  # Will be implemented in Phase 2
        self.reviewer = None  # Will be implemented in Phase 2
        
        self.graph = self._build_graph()
        self.max_iterations = 3

    def _build_graph(self):
        """
        Build the supervisor-controlled investigation graph.
        
        Flow:
        1. Ingestion (extract IOCs)
        2. Supervisor (create investigation plan)
        3. Execute investigation phase (parallel agents)
        4. Check completion (supervisor decides)
        5. Loop or conclude
        """
        workflow = StateGraph(IncidentState)

        # Add nodes
        workflow.add_node("ingestion", self.node_ingestion)
        workflow.add_node("supervisor_plan", self.node_supervisor_plan)
        workflow.add_node("execute_investigation", self.node_execute_investigation)
        workflow.add_node("supervisor_check", self.node_supervisor_check)
        workflow.add_node("finalize", self.node_finalize)

        # Set entry point
        workflow.set_entry_point("ingestion")

        # Linear start: ingestion → supervisor planning
        workflow.add_edge("ingestion", "supervisor_plan")
        workflow.add_edge("supervisor_plan", "execute_investigation")
        
        # After executing agents, check with supervisor
        workflow.add_edge("execute_investigation", "supervisor_check")
        
        # Conditional edge from supervisor check
        workflow.add_conditional_edges(
            "supervisor_check",
            self.route_after_supervisor_check,
            {
                "continue": "execute_investigation",  # Loop back for more investigation
                "conclude": "finalize",  # Done investigating
                "escalate": "finalize"  # Escalate to human (mark in state)
            }
        )
        
        # Finalize and end
        workflow.add_edge("finalize", END)

        return workflow.compile()

    # ── Node Functions ────────────────────────────────────────────────────────

    async def node_ingestion(self, state: IncidentState) -> IncidentState:
        """Extract IOCs and normalize events."""
        logger.info("=== NODE: INGESTION ===")
        return await self.ingestion.run(state)

    async def node_supervisor_plan(self, state: IncidentState) -> IncidentState:
        """Supervisor creates investigation plan."""
        logger.info("=== NODE: SUPERVISOR (PLANNING) ===")
        return await self.supervisor.run(state)

    async def node_execute_investigation(self, state: IncidentState) -> IncidentState:
        """
        Execute the current investigation phase.
        
        Uses the supervisor's plan to determine which agents to run.
        Executes parallel agents concurrently where possible.
        """
        logger.info("=== NODE: EXECUTE INVESTIGATION ===")
        
        # Get the plan from state
        plan = getattr(state, 'supervisor_plan', {})
        required_agents = plan.get('required_agents', [])
        parallel_groups = plan.get('parallel_agents', [])
        
        # If no plan (shouldn't happen), fall back to basic pipeline
        if not required_agents:
            logger.warning("No investigation plan found, using default pipeline")
            required_agents = ["enrichment", "mitre", "correlation", "triage", "decision"]
            parallel_groups = [["enrichment", "mitre"], ["correlation"], ["triage"], ["decision"]]
        
        # Track which agents we've already executed
        completed = set(step.agent_name for step in state.agent_trace)
        
        # Increment iteration counter
        if not hasattr(state, 'supervisor_iteration'):
            state.supervisor_iteration = 1
        else:
            state.supervisor_iteration += 1
        
        logger.info(f"Investigation iteration {state.supervisor_iteration}/{self.max_iterations}")
        
        # Execute agents according to parallel groups
        if parallel_groups:
            for group in parallel_groups:
                # Filter to only agents that haven't been executed
                agents_to_run = [a for a in group if a not in completed]
                if not agents_to_run:
                    continue
                    
                logger.info(f"Executing parallel group: {', '.join(agents_to_run)}")
                
                # Run agents in parallel
                tasks = []
                for agent_name in agents_to_run:
                    agent = self._get_agent(agent_name)
                    if agent:
                        tasks.append(agent.run(state))
                        completed.add(agent_name)
                    else:
                        logger.warning(f"Agent '{agent_name}' not implemented yet, skipping")
                
                if tasks:
                    # Execute in parallel and update state sequentially
                    # (In practice, each agent reads state and appends to it)
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    for result in results:
                        if isinstance(result, Exception):
                            logger.error(f"Agent execution failed: {result}")
                        elif isinstance(result, IncidentState):
                            # Merge results back to state
                            # Since agents append to lists, we can just use the last result
                            state = result
        else:
            # Sequential execution (fallback)
            for agent_name in required_agents:
                if agent_name in completed:
                    continue
                    
                agent = self._get_agent(agent_name)
                if agent:
                    logger.info(f"Executing agent: {agent_name}")
                    state = await agent.run(state)
                    completed.add(agent_name)
                else:
                    logger.warning(f"Agent '{agent_name}' not implemented yet, skipping")
        
        return state

    async def node_supervisor_check(self, state: IncidentState) -> IncidentState:
        """
        Supervisor reviews findings and decides whether to continue.
        """
        logger.info("=== NODE: SUPERVISOR (CHECK) ===")
        
        # Get list of completed agents
        completed_agents = list(set(step.agent_name for step in state.agent_trace))
        
        # Ask supervisor to make a decision
        decision = await self.supervisor.should_continue_investigation(
            state,
            completed_agents,
            max_iterations=self.max_iterations
        )
        
        # Store decision in state for routing
        state.supervisor_decision = decision.model_dump()
        
        # If escalating, mark the state
        if decision.action == "escalate":
            logger.warning("Supervisor escalating to human analyst")
            state.status = "escalated"
            state.decision = state.decision or "Escalated - Requires Human Review"
            if not state.decision_reasoning:
                state.decision_reasoning = decision.reasoning
        
        return state

    async def node_finalize(self, state: IncidentState) -> IncidentState:
        """
        Final report generation and state cleanup.
        """
        logger.info("=== NODE: FINALIZE ===")
        
        # Ensure we have a decision (fallback if somehow missing)
        if not state.decision:
            logger.warning("No decision found, generating default")
            state = await self.decision.run(state)
        
        # Generate report
        state = await self.reporter.run(state)
        
        # Backward compatibility for UI
        state.soc_analysis = {
            "classification": state.decision or "Investigation Complete",
            "decision": state.decision or "Investigation Complete",
            "reasoning": state.decision_reasoning,
            "evidence": [],
            "confidence_score": state.triage.confidence if state.triage else 0.5,
            "recommended_action": "\n".join(state.recommended_actions)
        }
        
        logger.info(f"Investigation complete: {state.decision}")
        return state

    # ── Routing Logic ─────────────────────────────────────────────────────────

    def route_after_supervisor_check(self, state: IncidentState) -> Literal["continue", "conclude", "escalate"]:
        """
        Conditional routing based on supervisor's decision.
        """
        decision = getattr(state, 'supervisor_decision', {})
        action = decision.get('action', 'conclude')
        
        # Check max iterations
        iteration = getattr(state, 'supervisor_iteration', 1)
        if iteration >= self.max_iterations and action == "continue":
            logger.warning(f"Max iterations ({self.max_iterations}) reached, forcing conclusion")
            return "conclude"
        
        logger.info(f"Routing decision: {action}")
        return action

    # ── Agent Lookup ──────────────────────────────────────────────────────────

    def _get_agent(self, agent_name: str):
        """Get agent instance by name."""
        agent_map = {
            "ingestion": self.ingestion,
            "enrichment": self.enrichment,
            "mitre": self.mitre,
            "correlation": self.correlation,
            "triage": self.triage,
            "decision": self.decision,
            "reporter": self.reporter,
            "threat_hunting": self.threat_hunting,
            "digital_forensics": self.digital_forensics,
            "reviewer": self.reviewer,
        }
        return agent_map.get(agent_name)

    # ── Public API ────────────────────────────────────────────────────────────

    async def run(self, raw_alert: str) -> dict[str, Any]:
        """
        Public entry point. Creates a new IncidentState and runs it through the graph.
        Returns the final state as a dictionary.
        """
        initial_state = IncidentState(raw_alert=raw_alert)
        
        # Run graph
        final_state = await self.graph.ainvoke(initial_state)
        
        # Convert to dict for API serialization
        if isinstance(final_state, IncidentState):
            return final_state.model_dump()
        return final_state
