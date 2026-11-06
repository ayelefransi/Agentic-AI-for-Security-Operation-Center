# NEXUS Command 2.0 - Developer Guide

Quick reference for developers working on the NEXUS Command platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Adding New Agents](#adding-new-agents)
4. [Testing](#testing)
5. [Common Tasks](#common-tasks)
6. [Debugging](#debugging)
7. [Code Style](#code-style)

---

## Architecture Overview

### Request Flow

```
User → Frontend (Next.js) → API (FastAPI) → Workflow (LangGraph) → Agents → Database
```

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Frontend | `app/` | Next.js pages and components |
| Backend API | `backend/api/` | FastAPI endpoints |
| Workflow | `backend/graph/` | LangGraph orchestration |
| Agents | `backend/agents/` | Specialist investigation agents |
| Schemas | `backend/schemas/` | Pydantic data models |
| Gateways | `backend/gateways/` | Threat intel integrations |

### Key Concepts

**Supervisor Pattern**: Central orchestrator dynamically selects and coordinates specialist agents

**Append-Only State**: Agents never mutate existing state, only append findings

**Parallel Execution**: Independent agents run concurrently via `asyncio.gather()`

**Bounded Loops**: Max 3 investigation iterations to prevent infinite analysis

---

## Development Setup

### Prerequisites

```bash
# Python 3.11+
python --version

# Node.js 18+
node --version

# Git
git --version
```

### Initial Setup

```bash
# 1. Clone repository
git clone <repository>
cd <repository>

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd ..
npm install

# 4. Environment configuration
cp .env.example .env
# Edit .env with your API keys
```

### Running Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Environment Variables

Required:
```bash
GROQ_API_KEY=gsk_your_groq_key_here
```

Optional (system works without these):
```bash
VT_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
OTX_API_KEY=your_alienvault_key
```

---

## Adding New Agents

### Step 1: Create Agent File

```python
# backend/agents/my_new_agent.py

from __future__ import annotations
import logging
from agents.base_agent import BaseAgent
from schemas.schemas import IncidentState

logger = logging.getLogger(__name__)


class MyNewAgent(BaseAgent):
    """
    Brief description of what this agent does.
    
    Responsibilities:
    - Task 1
    - Task 2
    """

    name = "my_new_agent"  # Unique identifier

    async def _process(self, state: IncidentState) -> IncidentState:
        """
        Core agent logic. Receives state, performs work, returns updated state.
        """
        logger.info(f"[{self.name}] Starting processing")
        
        # Your logic here
        # Read from state: state.events, state.enrichments, etc.
        # Append findings to state (don't mutate existing data)
        
        # Example: Add to recommended actions
        state.recommended_actions.append("Do something based on my analysis")
        
        logger.info(f"[{self.name}] Processing complete")
        return state
```

### Step 2: Register in Workflow

```python
# backend/graph/workflow_v2.py

from agents.my_new_agent import MyNewAgent  # Add import

class SOCWorkflowV2:
    def __init__(self):
        # ... existing agents ...
        self.my_new_agent = MyNewAgent()  # Instantiate
        
    def _get_agent(self, agent_name: str):
        agent_map = {
            # ... existing agents ...
            "my_new_agent": self.my_new_agent,  # Add to map
        }
        return agent_map.get(agent_name)
```

### Step 3: Update Supervisor Prompt

```python
# backend/agents/supervisor_agent.py

# In planning_prompt template, add your agent to the list:
"""
3. Select which specialist agents are needed:
   - enrichment: Threat intelligence lookup for IOCs
   - mitre: Map behaviors to MITRE ATT&CK framework
   - my_new_agent: Does X, Y, and Z  # <-- Add here
   ...
"""

# In InvestigationPlan schema, add to Literal type:
required_agents: list[Literal[
    "enrichment",
    "mitre",
    # ... existing agents ...
    "my_new_agent"  # <-- Add here
]]
```

### Step 4: Add Tests

```python
# backend/test_workflow_v2.py

TEST_ALERTS.append({
    "name": "Test Case for My New Agent",
    "alert": "Alert text that should trigger my agent..."
})
```

---

## Testing

### Unit Tests (Single Agent)

```python
# backend/tests/test_my_agent.py

import pytest
from agents.my_new_agent import MyNewAgent
from schemas.schemas import IncidentState

@pytest.mark.asyncio
async def test_my_agent_basic():
    agent = MyNewAgent()
    state = IncidentState(raw_alert="test alert")
    
    result = await agent.run(state)
    
    assert result.recommended_actions  # Check agent added actions
    # More assertions...
```

### Integration Tests (Full Workflow)

```bash
# Run all workflow tests
cd backend
python test_workflow_v2.py
```

### Manual Testing

```bash
# Start backend
cd backend
uvicorn api.main:app --reload --port 8000

# In another terminal, test endpoint
curl -X POST http://localhost:8000/api/analyze-alert \
  -H "Content-Type: application/json" \
  -d '{"alert": "Test alert text..."}'
```

---

## Common Tasks

### Add a New Threat Intel Gateway

```python
# backend/gateways/my_gateway.py

from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

class MyGateway(ThreatIntelGateway):
    source_name = "my_source"
    supported_types = {IOCType.IP, IOCType.DOMAIN}
    rate_limit_requests = 100
    rate_limit_window_seconds = 60
    
    def __init__(self):
        super().__init__()
        self.api_key = settings.my_api_key  # From settings
    
    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        # Your API call logic
        # Return EnrichmentResult with verdict
        pass
```

Register in EnrichmentAgent:
```python
# backend/agents/enrichment_agent.py

from gateways.my_gateway import MyGateway

class EnrichmentAgent(BaseAgent):
    def __init__(self):
        self.gateways = [
            # ... existing ...
            MyGateway(),
        ]
```

### Add a New MITRE Technique

```python
# backend/agents/mitre_agent.py

BUILTIN_TECHNIQUES.append({
    "id": "T1234",
    "name": "My New Technique",
    "tactic": "Execution",
    "keywords": ["keyword1", "keyword2", "keyword3"]
})
```

### Add a New Frontend Page

```bash
# Create page directory
mkdir -p app/my-page

# Create page file
touch app/my-page/page.tsx
touch app/my-page/page.module.css
```

```typescript
// app/my-page/page.tsx
"use client";

export default function MyPage() {
  return (
    <div>
      <h1>My New Page</h1>
    </div>
  );
}
```

Add to navigation:
```typescript
// app/components/Sidebar.tsx
// Add link in navigation items
```

---

## Debugging

### Enable Debug Logging

```python
# backend/api/main.py or any module

import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
```

### Inspect Agent Execution

```python
# View agent trace from investigation
result = await workflow.run("test alert")
for step in result['agent_trace']:
    print(f"{step['agent_name']}: {step['status']} ({step['duration_ms']}ms)")
```

### Debug Supervisor Decisions

```python
# backend/agents/supervisor_agent.py

# Add logging in _process or should_continue_investigation:
logger.debug(f"Plan: {plan.model_dump_json(indent=2)}")
logger.debug(f"Decision: {decision.model_dump_json(indent=2)}")
```

### Test LLM Prompts

```python
# backend/test_llm_prompt.py

import asyncio
from langchain_groq import ChatGroq
from config.settings import settings

async def test():
    llm = ChatGroq(model=settings.llm_model, api_key=settings.groq_api_key)
    response = await llm.ainvoke("Your test prompt here")
    print(response.content)

asyncio.run(test())
```

### Check Database

```bash
# SQLite CLI
sqlite3 backend/incidents.db

# View incidents
SELECT id, status, created_at FROM incidents ORDER BY created_at DESC LIMIT 10;

# View IOC cache
sqlite3 backend/ioc_cache.db
SELECT * FROM ioc_cache ORDER BY created_at DESC LIMIT 10;
```

### Frontend Debugging

```typescript
// Add console logging in components
console.log("State:", state);

// Use React DevTools (browser extension)
// Use Network tab to inspect API calls
```

---

## Code Style

### Python (Backend)

**Follow PEP 8:**
```python
# Good
async def process_alert(state: IncidentState) -> IncidentState:
    """Process security alert with enrichment."""
    logger.info(f"Processing alert {state.id}")
    return state

# Bad
def ProcessAlert(State):
    print("processing")
    return State
```

**Type Hints Always:**
```python
# Good
async def fetch_data(ioc: IOC) -> EnrichmentResult:
    pass

# Bad
async def fetch_data(ioc):
    pass
```

**Pydantic for Data:**
```python
# Good - use Pydantic models
class Finding(BaseModel):
    verdict: Verdict
    confidence: float

# Bad - use dicts
finding = {"verdict": "malicious", "confidence": 0.9}
```

### TypeScript (Frontend)

**Use TypeScript types:**
```typescript
// Good
interface Incident {
  id: string;
  decision: string;
  triage?: TriageScore;
}

// Bad
const incident: any = { ... }
```

**Async/await:**
```typescript
// Good
const data = await fetch('/api/incidents');
const json = await data.json();

// Bad
fetch('/api/incidents').then(r => r.json()).then(data => ...)
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Python classes | PascalCase | `SupervisorAgent` |
| Python functions | snake_case | `create_investigation_plan()` |
| Python constants | UPPER_SNAKE_CASE | `MAX_ITERATIONS = 3` |
| TypeScript interfaces | PascalCase | `IncidentState` |
| TypeScript functions | camelCase | `fetchIncidents()` |
| CSS classes | kebab-case | `.card-header` |

### Documentation

**Docstrings Required:**
```python
async def _process(self, state: IncidentState) -> IncidentState:
    """
    Process the incident state.
    
    Args:
        state: Current incident state with events and findings
        
    Returns:
        Updated state with agent's findings appended
        
    Raises:
        ValueError: If state is invalid
    """
    pass
```

**Inline Comments for Complex Logic:**
```python
# Calculate confidence based on source count and agreement
confidence = base_confidence * (1 + agreement_bonus) * source_weight
```

---

## Best Practices

### Agents

1. ✅ **DO** inherit from `BaseAgent`
2. ✅ **DO** use async/await throughout
3. ✅ **DO** append to state, never mutate
4. ✅ **DO** handle exceptions gracefully
5. ✅ **DO** log important decisions
6. ❌ **DON'T** make agents depend on execution order
7. ❌ **DON'T** return different state types
8. ❌ **DON'T** use blocking I/O

### Workflows

1. ✅ **DO** use conditional edges for routing
2. ✅ **DO** bound loops (max iterations)
3. ✅ **DO** provide fallback paths
4. ✅ **DO** preserve state history
5. ❌ **DON'T** create infinite loops
6. ❌ **DON'T** skip error handling
7. ❌ **DON'T** lose investigation context

### Frontend

1. ✅ **DO** use TypeScript strictly
2. ✅ **DO** handle loading states
3. ✅ **DO** show error messages
4. ✅ **DO** use CSS modules for styling
5. ❌ **DON'T** make synchronous API calls
6. ❌ **DON'T** hardcode backend URLs
7. ❌ **DON'T** expose API keys

---

## Troubleshooting

### "Module not found" errors

```bash
# Ensure Python path includes backend/
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"

# Or run from backend/ directory
cd backend
python api/main.py
```

### "LangGraph state mismatch" errors

Check that `IncidentState` Pydantic model matches what LangGraph expects.

### "Agent not executing" issues

1. Check agent is registered in `_get_agent()`
2. Check supervisor includes agent in prompt
3. Check agent name matches exactly
4. Check logs for errors/warnings

### Database locked errors

SQLite issue with concurrent writes. Consider:
```python
# Use check_same_thread=False for SQLite
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
```

---

## Resources

- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Next.js Docs**: https://nextjs.org/docs
- **Pydantic Docs**: https://docs.pydantic.dev/
- **MITRE ATT&CK**: https://attack.mitre.org/

---

## Getting Help

1. Check `ARCHITECTURE_V2.md` for system design
2. Review existing agent implementations in `backend/agents/`
3. Run tests to see examples: `python test_workflow_v2.py`
4. Check logs in terminal output
5. Use debugger: `import pdb; pdb.set_trace()`

---

**Happy coding! 🚀**
