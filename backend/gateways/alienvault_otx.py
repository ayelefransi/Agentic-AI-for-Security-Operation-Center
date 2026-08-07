"""
AlienVault OTX Gateway.

Retrieves threat pulses associated with an IOC.
"""

import logging
import os
import httpx

from config.settings import settings
from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

logger = logging.getLogger(__name__)


class AlienVaultOTXGateway(ThreatIntelGateway):
    """AlienVault OTX API wrapper."""

    source_name = "alienvault_otx"
    rate_limit_requests = 20
    rate_limit_window_seconds = 60
    
    supported_types = {IOCType.IP, IOCType.DOMAIN, IOCType.HASH}
    
    _base_url = "https://otx.alienvault.com/api/v1/indicators"

    def __init__(self):
        super().__init__()
        self.api_key = settings.alienvault_api_key or os.environ.get("OTX_API_KEY")

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        if not self.api_key:
            return EnrichmentResult(ioc=ioc, source=self.source_name, error="No OTX_API_KEY configured")

        headers = {"X-OTX-API-KEY": self.api_key}
        
        type_map = {
            IOCType.IP: "IPv4",
            IOCType.DOMAIN: "domain",
            IOCType.HASH: "file" # generic for hashes in OTX
        }
        
        otx_type = type_map.get(ioc.type)
        if not otx_type:
            return EnrichmentResult(ioc=ioc, source=self.source_name, error="Unsupported type")

        url = f"{self._base_url}/{otx_type}/{ioc.value}/general"
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code == 404:
                return EnrichmentResult(ioc=ioc, source=self.source_name, verdict=Verdict.UNKNOWN)
            resp.raise_for_status()
            data = resp.json()
            
        pulse_info = data.get("pulse_info", {})
        pulse_count = pulse_info.get("count", 0)
        
        # OTX pulses aren't an absolute measure of maliciousness, but >3 usually means it's bad
        if pulse_count >= 3:
            verdict = Verdict.MALICIOUS
            confidence = min(0.5 + (pulse_count * 0.1), 0.95)
        elif pulse_count > 0:
            verdict = Verdict.SUSPICIOUS
            confidence = 0.6
        else:
            verdict = Verdict.UNKNOWN
            confidence = 0.0
            
        raw_data = {
            "pulse_count": pulse_count,
            "reputation": data.get("reputation", 0)
        }
        
        # Extract tags from the first few pulses
        tags = set()
        for pulse in pulse_info.get("pulses", [])[:3]:
            for tag in pulse.get("tags", []):
                tags.add(tag.lower())

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=list(tags)[:5]
        )
