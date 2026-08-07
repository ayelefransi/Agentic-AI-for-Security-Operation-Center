"""
GreyNoise Community API Gateway.

Excellent for identifying benign scanners and background internet noise,
preventing false positives.
"""

import logging
import httpx

from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

logger = logging.getLogger(__name__)


class GreyNoiseGateway(ThreatIntelGateway):
    """GreyNoise Community API (unauthenticated)."""

    source_name = "greynoise"
    # Unauth limits are strict
    rate_limit_requests = 10
    rate_limit_window_seconds = 60
    
    supported_types = {IOCType.IP}
    
    _url = "https://api.greynoise.io/v3/community"

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        # GreyNoise community API doesn't require a key
        url = f"{self._url}/{ioc.value}"
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            
            if resp.status_code == 404:
                return EnrichmentResult(ioc=ioc, source=self.source_name, verdict=Verdict.UNKNOWN)
            if resp.status_code == 429:
                return EnrichmentResult(ioc=ioc, source=self.source_name, error="Rate limited by API")
                
            resp.raise_for_status()
            data = resp.json()
            
        noise = data.get("noise", False)
        riot = data.get("riot", False)
        classification = data.get("classification", "unknown")
        
        tags = []
        if data.get("name"):
            tags.append(data["name"])
            
        if riot:
            # Rule It Out - known benign service (e.g. Googlebot)
            verdict = Verdict.BENIGN
            confidence = 0.95
            tags.append("riot")
        elif noise and classification == "malicious":
            verdict = Verdict.MALICIOUS
            confidence = 0.8
            tags.append("scanner")
        elif noise and classification == "benign":
            verdict = Verdict.BENIGN
            confidence = 0.8
            tags.append("benign_scanner")
        else:
            verdict = Verdict.UNKNOWN
            confidence = 0.0
            
        raw_data = {
            "noise": noise,
            "riot": riot,
            "classification": classification,
            "name": data.get("name")
        }

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=tags[:3]
        )
