"""
Reporter Agent — Generates comprehensive investigation reports.

Creates markdown reports with all findings, evidence, and recommendations.
"""

from __future__ import annotations

import logging

from agents.base_agent import BaseAgent
from schemas.schemas import IncidentState

logger = logging.getLogger(__name__)


class ReporterAgent(BaseAgent):
    """
    Generates final investigation reports in markdown format.
    Synthesizes all agent findings into a readable analyst report.
    """

    name = "reporter_agent"

    async def _process(self, state: IncidentState) -> IncidentState:
        """Generate comprehensive markdown report."""
        
        report_lines = []
        
        # Header
        report_lines.append("# 🚨 Security Investigation Report\n")
        report_lines.append(f"**Incident ID:** `{state.id}`")
        report_lines.append(f"**Status:** `{state.status.value}`")
        report_lines.append(f"**Created:** {state.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
        
        # Executive Summary
        report_lines.append("## Executive Summary\n")
        if state.decision:
            report_lines.append(f"**Verdict:** `{state.decision}`")
        if state.triage:
            report_lines.append(
                f"**Severity:** `{state.triage.severity.value}` "
                f"(Risk Score: {state.triage.score}/100, "
                f"Confidence: {state.triage.confidence:.0%})"
            )
        
        if state.decision_reasoning:
            report_lines.append(f"\n{state.decision_reasoning}\n")
        
        # Investigation Plan (if available)
        if hasattr(state, 'investigation_plan_summary'):
            report_lines.append("## Investigation Approach\n")
            report_lines.append(f"**Classification:** {state.investigation_plan_summary}")
            
            if hasattr(state, 'supervisor_iteration'):
                report_lines.append(f"**Investigation Depth:** {state.supervisor_iteration} iteration(s)\n")
        
        # Extracted Entities
        if state.events:
            report_lines.append("## 📝 Extracted Entities\n")
            for idx, event in enumerate(state.events, 1):
                report_lines.append(f"### Event {idx}: {event.event_type}")
                report_lines.append(f"- **Source:** {event.source}")
                report_lines.append(f"- **Timestamp:** {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                
                if event.src_ip:
                    report_lines.append(f"- **Source IP:** `{event.src_ip}`")
                if event.dst_ip:
                    report_lines.append(f"- **Destination IP:** `{event.dst_ip}`")
                if event.user:
                    report_lines.append(f"- **User:** `{event.user}`")
                if event.hostname:
                    report_lines.append(f"- **Hostname:** `{event.hostname}`")
                
                if event.extracted_iocs:
                    report_lines.append(f"\n**Indicators of Compromise ({len(event.extracted_iocs)}):**")
                    for ioc in event.extracted_iocs:
                        context = f" ({ioc.context})" if ioc.context else ""
                        report_lines.append(f"- `{ioc.type.value}`: {ioc.value}{context}")
                
                report_lines.append("")
        
        # Threat Intelligence Enrichment
        if state.enrichments:
            report_lines.append("## 🔬 Threat Intelligence Analysis\n")
            report_lines.append(f"Analyzed {len(state.enrichments)} indicators across multiple threat intelligence sources.\n")
            
            for enr in state.enrichments:
                # Icon based on verdict
                icon_map = {
                    "malicious": "🔴",
                    "suspicious": "🟡",
                    "benign": "🟢",
                    "unknown": "⚪"
                }
                icon = icon_map.get(enr.final_verdict.value, "⚪")
                
                report_lines.append(f"### {icon} {enr.ioc.type.value.upper()}: `{enr.ioc.value}`")
                report_lines.append(f"**Verdict:** {enr.final_verdict.value.upper()} (Confidence: {enr.final_confidence:.0%})")
                
                if enr.tags:
                    report_lines.append(f"**Tags:** {', '.join(enr.tags[:5])}")
                
                # Show source breakdown
                if enr.results:
                    report_lines.append("\n**Source Analysis:**")
                    for result in enr.results:
                        if result.error:
                            report_lines.append(f"- _{result.source}_: Error - {result.error}")
                        else:
                            cached_indicator = " (cached)" if result.cached else ""
                            report_lines.append(
                                f"- _{result.source}_: {result.verdict.value} "
                                f"(confidence: {result.confidence:.0%}){cached_indicator}"
                            )
                
                report_lines.append("")
        
        # MITRE ATT&CK Mappings
        if state.mitre_mappings:
            report_lines.append("## 🗺️ MITRE ATT&CK Framework Mapping\n")
            report_lines.append(f"Identified {len(state.mitre_mappings)} tactics and techniques.\n")
            
            # Group by tactic
            tactics_map = {}
            for mapping in state.mitre_mappings:
                if mapping.tactic not in tactics_map:
                    tactics_map[mapping.tactic] = []
                tactics_map[mapping.tactic].append(mapping)
            
            for tactic, mappings in tactics_map.items():
                report_lines.append(f"### {tactic}")
                for mapping in mappings:
                    report_lines.append(
                        f"- **{mapping.technique_id}** - {mapping.technique_name} "
                        f"(Confidence: {mapping.confidence:.0%})"
                    )
                    if mapping.evidence:
                        report_lines.append(f"  - _Evidence:_ {mapping.evidence}")
                report_lines.append("")
        
        # Risk Assessment
        if state.triage:
            report_lines.append("## ⚖️ Risk Assessment\n")
            report_lines.append(f"**Overall Risk Score:** {state.triage.score}/100")
            report_lines.append(f"**Severity Level:** {state.triage.severity.value}")
            report_lines.append(f"**Assessment Confidence:** {state.triage.confidence:.0%}\n")
            
            if state.triage.breakdown:
                report_lines.append("**Risk Score Breakdown:**")
                for factor, score in state.triage.breakdown.items():
                    factor_name = factor.replace("_", " ").title()
                    report_lines.append(f"- {factor_name}: {score:.1f} points")
                report_lines.append("")
        
        # Recommended Actions
        if state.recommended_actions:
            report_lines.append("## ⚡ Recommended Actions\n")
            for idx, action in enumerate(state.recommended_actions, 1):
                report_lines.append(f"{idx}. {action}")
            report_lines.append("")
        
        # Investigation Timeline
        if state.agent_trace:
            report_lines.append("## 🕐 Investigation Timeline\n")
            report_lines.append("| Agent | Status | Duration | Output |")
            report_lines.append("|-------|--------|----------|--------|")
            
            for step in state.agent_trace:
                duration = f"{step.duration_ms:.0f}ms" if step.duration_ms else "N/A"
                output = step.output_summary[:50] + "..." if len(step.output_summary) > 50 else step.output_summary
                status_icon = {
                    "done": "✅",
                    "running": "⏳",
                    "error": "❌",
                    "skipped": "⏭️"
                }.get(step.status.value, "❓")
                
                report_lines.append(
                    f"| {step.agent_name} | {status_icon} {step.status.value} | {duration} | {output} |"
                )
            report_lines.append("")
        
        # Raw Alert (collapsed)
        if state.raw_alert:
            report_lines.append("## 📄 Raw Alert Data\n")
            report_lines.append("```")
            report_lines.append(state.raw_alert[:500])
            if len(state.raw_alert) > 500:
                report_lines.append("... (truncated)")
            report_lines.append("```\n")
        
        # Footer
        report_lines.append("---")
        report_lines.append("_Generated by NEXUS Command Multi-Agent SOC Platform_")
        
        # Join all lines
        state.report = "\n".join(report_lines)
        
        # Set rewrite_iterations for backward compatibility
        if not hasattr(state, 'rewrite_iterations') or state.rewrite_iterations == 0:
            state.rewrite_iterations = getattr(state, 'supervisor_iteration', 1)
        
        logger.info(f"Report generated ({len(state.report)} characters)")
        return state
