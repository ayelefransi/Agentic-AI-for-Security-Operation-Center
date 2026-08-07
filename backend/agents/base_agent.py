"""
Abstract base class for all SOC pipeline agents.

Every agent implements the same interface so nodes are swappable
without touching the orchestrator graph.
"""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Optional

from schemas.schemas import AgentNodeStatus, AgentStepLog, IncidentState

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Abstract base for every agent node in the SOC pipeline.
    
    Subclasses must implement `_process(state)` with their specific logic.
    The `run()` wrapper handles logging, timing, error capture, and trace appending.
    """

    name: str = "base_agent"

    @abstractmethod
    async def _process(self, state: IncidentState) -> IncidentState:
        """
        Core agent logic. Receives the current incident state,
        performs work, and returns the updated state.
        """
        ...

    async def run(self, state: IncidentState) -> IncidentState:
        """
        Execute the agent with full audit tracing.
        Wraps _process with timing, logging, and error handling.
        """
        step = AgentStepLog(
            agent_name=self.name,
            status=AgentNodeStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        logger.info(f"[{self.name}] Starting execution")
        start = time.monotonic()

        try:
            state = await self._process(state)
            elapsed = (time.monotonic() - start) * 1000
            step.status = AgentNodeStatus.DONE
            step.completed_at = datetime.utcnow()
            step.duration_ms = round(elapsed, 2)
            step.output_summary = f"Completed in {elapsed:.0f}ms"
            logger.info(f"[{self.name}] Done in {elapsed:.0f}ms")
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            step.status = AgentNodeStatus.ERROR
            step.completed_at = datetime.utcnow()
            step.duration_ms = round(elapsed, 2)
            step.error = str(e)
            logger.error(f"[{self.name}] Error: {e}", exc_info=True)

        state.agent_trace.append(step)
        return state


# ── Utility: retry with exponential backoff ───────────────────────────────────

async def retry_with_backoff(
    func,
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    timeout: float = 15.0,
    **kwargs,
) -> Any:
    """
    Call an async function with exponential backoff retries.
    
    Used by gateways and agents wrapping external API calls.
    Raises the last exception if all retries are exhausted.
    """
    last_exception: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout)
        except asyncio.TimeoutError:
            last_exception = TimeoutError(f"Call timed out after {timeout}s")
            logger.warning(f"Attempt {attempt + 1}/{max_retries} timed out")
        except Exception as e:
            last_exception = e
            logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {e}")

        if attempt < max_retries - 1:
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.info(f"Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)

    raise last_exception  # type: ignore[misc]
