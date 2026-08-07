"""
Enrichment Agent — Takes extracted IOCs and fans out to all configured
Threat Intel Gateways in parallel. Aggregates results into an IOCEnrichmentSummary.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from agents.base_agent import BaseAgent
from gateways import (
    AbuseIPDBGateway,
    AlienVaultOTXGateway,
    DemoGateway,
    GreyNoiseGateway,
    IPInfoGateway,
    ThreatIntelGateway,
    VirusTotalGateway,
)
from schemas.schemas import (
    EnrichmentResult,
    IncidentState,
    IOCEnrichmentSummary,
    Verdict,
)

logger = logging.getLogger(__name__)


class EnrichmentAgent(BaseAgent):
    """
    Fans out IOCs to all configured Gateways.
    Aggregates results into a single Verdict per IOC.
    """

    name = "enrichment_agent"

    def __init__(self):
        # Instantiate all gateways
        # In a real app with DI, these would only be instantiated if keys exist
        self.gateways: list[ThreatIntelGateway] = [
            VirusTotalGateway(),
            AbuseIPDBGateway(),
            AlienVaultOTXGateway(),
            GreyNoiseGateway(),
            IPInfoGateway(),
        ]
        
        # If no live gateways have keys, we'll fall back to DemoGateway
        self.demo_gateway = DemoGateway()

    async def _process(self, state: IncidentState) -> IncidentState:
        # Collect all unique IOCs across all events
        unique_iocs = {}
        for event in state.events:
            for ioc in event.extracted_iocs:
                key = f"{ioc.type.value}:{ioc.value.lower()}"
                if key not in unique_iocs:
                    unique_iocs[key] = ioc

        if not unique_iocs:
            logger.info("No IOCs to enrich.")
            return state

        # Determine which gateways to use
        # Filter for gateways that actually have API keys configured
        active_gateways = [g for g in self.gateways if hasattr(g, 'api_key') and g.api_key]
        
        # GreyNoise and IPInfo are unauthenticated, they can always run
        active_gateways.extend([g for g in self.gateways if not hasattr(g, 'api_key')])
        
        # If no authenticated gateways are configured, add DemoGateway for consistent results
        if not any(hasattr(g, 'api_key') and g.api_key for g in self.gateways):
            logger.info("No authenticated API keys found. Using DemoGateway alongside unauth gateways.")
            active_gateways.append(self.demo_gateway)

        # Fan-out enrichment
        tasks = []
        for ioc in unique_iocs.values():
            for gateway in active_gateways:
                if ioc.type in gateway.supported_types:
                    tasks.append(gateway.lookup(ioc))

        if not tasks:
            logger.info("No supported gateways for any extracted IOCs.")
            return state

        # Wait for all gateway lookups to complete concurrently
        logger.info(f"Firing {len(tasks)} enrichment tasks...")
        results: tuple[EnrichmentResult | Exception, ...] = await asyncio.gather(*tasks, return_exceptions=True)

        # Group results by IOC
        ioc_results: dict[str, list[EnrichmentResult]] = {key: [] for key in unique_iocs}
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Gateway threw unhandled exception: {result}")
                continue
            if result.error:
                logger.debug(f"Gateway {result.source} returned error: {result.error}")
                # We still keep the result object as it shows we tried
                
            key = f"{result.ioc.type.value}:{result.ioc.value.lower()}"
            if key in ioc_results:
                ioc_results[key].append(result)

        # Summarize per IOC
        for key, ioc in unique_iocs.items():
            res_list = ioc_results[key]
            
            summary = IOCEnrichmentSummary(
                ioc=ioc,
                results=res_list
            )
            
            # Determine overall verdict across sources
            # Very simple logic: highest severity wins
            highest_verdict = Verdict.UNKNOWN
            max_confidence = 0.0
            all_tags = set()
            
            verdict_scores = {
                Verdict.UNKNOWN: 0,
                Verdict.BENIGN: 1,
                Verdict.SUSPICIOUS: 2,
                Verdict.MALICIOUS: 3
            }
            
            for r in res_list:
                all_tags.update(r.tags)
                if r.error:
                    continue
                    
                score = verdict_scores[r.verdict]
                highest_score = verdict_scores[highest_verdict]
                
                if score > highest_score:
                    highest_verdict = r.verdict
                    max_confidence = r.confidence
                elif score == highest_score:
                    max_confidence = max(max_confidence, r.confidence)
            
            summary.final_verdict = highest_verdict
            summary.final_confidence = max_confidence
            summary.tags = list(all_tags)[:10]
            
            state.enrichments.append(summary)

        logger.info(f"Enrichment complete for {len(state.enrichments)} unique IOCs")
        return state
