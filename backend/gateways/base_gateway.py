"""
Abstract Base Gateway for Threat Intelligence Integrations.

Handles caching, rate limiting (via tokens), and provides a standard interface
for all threat intel sources.
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod

from cache import get_cache
from schemas.schemas import EnrichmentResult, IOC

logger = logging.getLogger(__name__)


class ThreatIntelGateway(ABC):
    """Abstract base class for threat intelligence API gateways."""

    # Name of the source (e.g., 'virustotal')
    source_name: str = "base_gateway"
    
    # Rate limit configuration
    # Max requests per window_seconds
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    
    # Supported IOC types (e.g., [IOCType.IP, IOCType.DOMAIN])
    supported_types: set = set()

    def __init__(self):
        self._tokens = float(self.rate_limit_requests)
        self._last_token_update = time.monotonic()
        self._rate_limit_lock = asyncio.Lock()
        
        # Token refill rate (tokens per second)
        self._refill_rate = self.rate_limit_requests / self.rate_limit_window_seconds

    async def _wait_for_token(self):
        """Token bucket rate limiting."""
        async with self._rate_limit_lock:
            now = time.monotonic()
            elapsed = now - self._last_token_update
            self._tokens = min(
                self.rate_limit_requests,
                self._tokens + elapsed * self._refill_rate
            )
            self._last_token_update = now

            if self._tokens < 1.0:
                # We need to wait
                deficit = 1.0 - self._tokens
                wait_time = deficit / self._refill_rate
                logger.debug(f"[{self.source_name}] Rate limit reached. Waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
                
                # Update after sleep
                self._tokens = 0.0
                self._last_token_update = time.monotonic()
            else:
                self._tokens -= 1.0

    @abstractmethod
    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        """
        The actual API call implementation.
        Must return an EnrichmentResult object.
        """
        ...

    async def lookup(self, ioc: IOC) -> EnrichmentResult:
        """
        Public entry point for looking up an IOC.
        Handles checking supported types, caching, and rate limiting.
        """
        if ioc.type not in self.supported_types:
            return EnrichmentResult(
                ioc=ioc,
                source=self.source_name,
                error=f"Unsupported IOC type: {ioc.type.value}"
            )

        # 1. Check Cache
        cache = get_cache()
        cached_data = cache.get(ioc.type.value, ioc.value, self.source_name)
        if cached_data:
            # Reconstruct EnrichmentResult from dict
            result = EnrichmentResult(**cached_data)
            result.cached = True
            return result

        # 2. Wait for rate limit token
        await self._wait_for_token()

        # 3. Fetch from API
        try:
            result = await self._fetch(ioc)
        except Exception as e:
            logger.error(f"[{self.source_name}] Lookup failed for {ioc.value}: {e}")
            return EnrichmentResult(
                ioc=ioc,
                source=self.source_name,
                error=str(e)
            )

        # 4. Save to Cache (if successful and not rate limited)
        if result.error is None:
            cache.set(ioc.type.value, ioc.value, self.source_name, result.model_dump())

        return result
