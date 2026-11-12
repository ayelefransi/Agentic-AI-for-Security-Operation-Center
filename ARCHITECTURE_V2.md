# አውራ AI 2.0 - Multi-Agent Architecture

## Overview

አውራ AI 2.0 implements a **supervisor-controlled multi-agent architecture** where a central Supervisor Agent dynamically orchestrates specialist agents based on alert type, investigation requirements, and intermediate findings.

This replaces the linear pipeline with intelligent routing, parallel execution, and adaptive investigation depth.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Alert                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │   Ingestion    │  Extract IOCs, normalize events
            │     Agent      │
            └────────┬───────┘
                     │
                     ▼
         ┌──────────────────────┐
         │    Supervisor         │  Create investigation plan
         │  (Planning Phase)     │  - Classify alert type
         └──────────┬────────────┘  - Assess urgency
                    │               - Select agents
                    │               - Plan parallelization
                    ▼
     ┌──────────────────────────────┐
     │   Execute Investigation       │
     │                               │
     │  ┌────────────┐ ┌──────────┐ │
     │  │Enrichment  │ │  MITRE   │ │  Parallel Phase 1
     │  │   Agent    │ │  Agent   │ │
     │  └────────────┘ └──────────┘ │
     │                               │
     │  ┌────────────────────────┐  │
     │  │  Correlation Agent     │  │  Phase 2
     │  └────────────────────────┘  │
     │                               │
     │  ┌──────────┐  ┌───────────┐ │
     │  │  Triage  │  │ Decision  │ │  Phase 3
     │  │  Agent   │  │   Agent   │ │
     │  └──────────┘  └───────────┘ │
     └──────────────┬────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │    Supervisor         │  Evaluate findings
         │  (Check Phase)        │  - Review evidence
         └──────────┬────────────┘  - Check completeness
                    │               - Decide next action
                    │
            ┌───────┴───────┐
            │               │
    ┌───────▼──────┐  ┌────▼──────────┐
    │  Continue    │  │  Conclude     │
    │ Investigation│  │ Investigation │
    └───────┬──────┘  └────┬──────────┘
            │               │
            │Loop back      │
            │(max 3 times)  ▼
            │         ┌──────────┐
            └────────►│ Finalize │  Generate report
                      │  Report  │  Package results
                      └──────────┘
```

## Core Components

### 1. Supervisor Agent (`supervisor_agent.py`)

**Responsibilities:**
- **Planning Phase**: Analyze raw alert and create structured investigation plan
- **Check Phase**: Evaluate findings and decide whether to continue or conclude
- **Dynamic Routing**: Select which agents to invoke based on alert characteristics
- **Quality Control**: Detect incomplete investigations and request additional evidence

**Key Capabilities:**
- Alert classification (brute_force, malware, phishing, etc.)
- Urgency assessment (low/medium/high/critical)
- Agent selection and parallelization planning
- Investigation loop management (bounded to 3 iterations)
- Escalation to human analysts when needed

**Decision Logic:**
```python
# Supervisor evaluates:
- Evidence completeness
- Finding confidence levels
- Conflicting conclusions
- Iteration count
- Severity vs. uncertainty

# Actions:
- CONTINUE: Launch additional agents
- CONCLUDE: Investigation sufficient
- ESCALATE: Requires human review
```

### 2. Workflow V2 (`workflow_v2.py`)

**LangGraph State Machine:**

```python
# Nodes
ingestion -> supervisor_plan -> execute_investigation -> supervisor_check
                                         ↑                      │
                                         │                      │
                                         └──────(continue)──────┘
                                                     │
                                                 (conclude)
                                                     │
                                                     ▼
                                                 finalize -> END
```

**Key Features:**
- Conditional routing based on supervisor decisions
- Parallel agent execution within phases
- Bounded loops (max 3 iterations)
- State checkpointing for resume capability
- Graceful degradation when agents unavailable

### 3. Specialist Agents

#### Current Agents (Phase 1)

| Agent | Purpose | When Used | Parallel Group |
|-------|---------|-----------|----------------|
| **Ingestion** | Extract IOCs, normalize events | Always | N/A (sequential) |
| **Enrichment** | Query threat intel sources | When IOCs present | Group 1 |
| **MITRE** | Map to ATT&CK framework | When behavioral indicators present | Group 1 |
| **Correlation** | Deduplicate, relate events | When multiple events | Group 2 |
| **Triage** | Calculate risk score | Always | Group 3 |
| **Decision** | Generate final verdict | Always | Group 3 |
| **Reporter** | Create markdown report | Always | Final |

#### Future Agents (Phase 2 - Coming Soon)

| Agent | Purpose | When Used |
|-------|---------|-----------|
| **Threat Hunting** | Search historical incidents | High-severity alerts, repeated IOCs |
| **Digital Forensics** | Build attack timeline | Complex attacks, lateral movement |
| **Reviewer** | Validate findings | High-confidence requirements |
| **Response** | Generate response playbooks | True positives, critical severity |

## Investigation Flow Examples

### Example 1: Simple Port Scan

```
Alert: "Port scan from 45.33.32.156 to 10.0.0.5"

1. Ingestion: Extract IP, event type
2. Supervisor Plan:
   - Classification: port_scan
   - Urgency: low
   - Agents: [enrichment, mitre, triage, decision]
   - Complexity: simple

3. Execute Phase 1:
   - Enrichment (parallel): Lookup 45.33.32.156
   - MITRE (parallel): Map to T1046 (Network Service Discovery)

4. Execute Phase 2:
   - Triage: Score 35/100 (Medium)
   - Decision: "Suspicious Activity - Monitor"

5. Supervisor Check:
   - Confidence: 0.85
   - Decision: CONCLUDE (simple scan, clear verdict)

6. Finalize: Generate report

Total Iterations: 1
```

### Example 2: Suspected Ransomware

```
Alert: "Mass file encryption on host, ransom note detected"

1. Ingestion: Extract process, file paths, indicators
2. Supervisor Plan:
   - Classification: ransomware
   - Urgency: critical
   - Agents: [enrichment, mitre, threat_hunting, digital_forensics, triage, decision, reviewer]
   - Complexity: complex

3. Execute Phase 1:
   - Enrichment: Lookup file hashes
   - MITRE: Map to T1486 (Data Encrypted for Impact)
   - Threat Hunting: Search for similar incidents (not yet implemented → skipped)

4. Supervisor Check (Iteration 1):
   - Confidence: 0.6 (no historical context)
   - Decision: CONTINUE → request digital_forensics

5. Execute Phase 2:
   - Digital Forensics: Timeline reconstruction (not yet implemented → skipped)
   - Correlation: Analyze attack chain
   - Triage: Score 95/100 (Critical)

6. Supervisor Check (Iteration 2):
   - Confidence: 0.9
   - Decision: CONCLUDE

7. Execute Phase 3:
   - Decision: "True Positive - Ransomware"
   - Reviewer: Validate findings (not yet implemented → skipped)

8. Finalize: Generate report, mark as ESCALATED

Total Iterations: 2
```

## State Management

### IncidentState Schema (Enhanced)

```python
class IncidentState(BaseModel):
    # Core incident data
    id: str
    raw_alert: str
    events: list[SecurityEvent]
    
    # Agent findings
    enrichments: list[IOCEnrichmentSummary]
    mitre_mappings: list[MITREMapping]
    triage: TriageScore
    decision: str
    decision_reasoning: str
    recommended_actions: list[str]
    
    # Supervisor state (NEW in V2)
    investigation_plan_summary: str
    supervisor_plan: dict  # Full InvestigationPlan
    supervisor_iteration: int  # Current iteration (1-3)
    supervisor_decision: dict  # Last SupervisorDecision
    
    # Audit trail
    agent_trace: list[AgentStepLog]
    
    # Report
    report: str
```

### Append-Only Philosophy

**Design Principle**: Agents never mutate existing state, they only append findings.

**Benefits:**
- Complete audit trail
- Reproducible investigations
- Easy debugging (replay from checkpoint)
- No race conditions in parallel execution

**Example:**
```python
# ❌ BAD (mutation)
state.events[0].severity = "Critical"

# ✅ GOOD (append)
state.triage = TriageScore(severity=Severity.CRITICAL, ...)
```

## Parallel Execution

### How It Works

The Supervisor creates parallelization groups in the investigation plan:

```python
plan.parallel_agents = [
    ["enrichment", "mitre"],  # Group 1: Independent lookups
    ["correlation"],          # Group 2: Depends on Group 1
    ["triage", "decision"]    # Group 3: Depends on Group 2
]
```

The workflow executes each group concurrently using `asyncio.gather()`:

```python
# Execute Group 1 in parallel
tasks = [enrichment_agent.run(state), mitre_agent.run(state)]
results = await asyncio.gather(*tasks)
```

### Parallelization Rules

**Can Run in Parallel If:**
- Agents read the same state
- Agents append to different state fields
- No data dependencies between agents

**Must Run Sequentially If:**
- Agent B needs Agent A's output
- Agents modify the same state field
- Ordering affects results

**Example Dependencies:**
```
Enrichment ─┐
            ├─> Triage ──> Decision
MITRE ──────┘

Enrichment and MITRE: PARALLEL (independent IOC lookup vs. behavior mapping)
Triage and Decision: SEQUENTIAL (decision needs risk score)
```

## Configuration

### Supervisor Behavior

```python
# Max investigation iterations (prevents infinite loops)
max_iterations = 3

# LLM temperature for planning (higher = more creative plans)
planning_temperature = 0.2

# Confidence threshold for auto-conclusion
auto_conclude_confidence = 0.7
```

### Agent Selection Rules

```python
# Built into Supervisor's LLM prompt:

Simple Investigation (port scan, basic recon):
- enrichment, mitre, triage, decision

Moderate Investigation (malware, phishing):
- enrichment, mitre, threat_hunting, correlation, triage, decision, reviewer

Complex Investigation (ransomware, APT, data exfil):
- enrichment, mitre, threat_hunting, digital_forensics, correlation, triage, decision, reviewer
```

## Testing

### Run V2 Workflow Tests

```bash
cd backend
python test_workflow_v2.py
```

**Test Coverage:**
- Port scan (simple)
- Brute force (moderate)
- Malware detection (moderate)
- Ransomware (complex)
- Suspicious PowerShell (moderate)

**Expected Behavior:**
- Simple alerts: 1 iteration, fast conclusion
- Complex alerts: 2-3 iterations, thorough investigation
- All alerts: Complete reports with evidence

## Migration Guide

### From V1 (Linear) to V2 (Supervisor)

**API Compatibility**: 100% backward compatible

The V2 workflow produces the same output schema as V1:

```python
# Both return:
{
    "id": "...",
    "decision": "True Positive",
    "triage": { "score": 85, "severity": "High" },
    "report": "...",
    "soc_analysis": { ... },  # UI compatibility
    ...
}
```

**Differences:**

| Aspect | V1 | V2 |
|--------|----|----|
| Execution | All agents, always | Dynamic selection |
| Parallelization | None | Multi-group |
| Iterations | 1 (fixed) | 1-3 (adaptive) |
| Planning | Implicit | Explicit (Supervisor) |
| Routing | Linear | Conditional |

**New Features in V2:**
- `investigation_plan_summary`: Alert classification
- `supervisor_iteration`: Investigation depth
- `supervisor_decision`: Why investigation concluded
- Enhanced agent trace with planning/checking nodes

## Performance Characteristics

### Latency Improvements (Expected)

| Alert Type | V1 (Sequential) | V2 (Parallel) | Improvement |
|------------|----------------|---------------|-------------|
| Port Scan | 8-10s | 4-5s | **50% faster** |
| Malware | 10-12s | 5-6s | **50% faster** |
| Ransomware | 12-15s | 8-10s | **30% faster** |

**Why:**
- Enrichment + MITRE run in parallel (saves 2-3s)
- Simple alerts skip unnecessary agents (saves 2-4s)
- Supervisor overhead: +0.5-1s (LLM planning calls)

### Resource Usage

| Metric | V1 | V2 | Notes |
|--------|----|----|-------|
| LLM Calls | 1-2 | 3-5 | Supervisor planning + decision |
| Token Usage | 5k-8k | 8k-12k | Supervisor prompts are verbose |
| Database Queries | 5-10 | 5-10 | No change |
| API Calls | 5-15 | 5-15 | No change (same gateways) |

## Future Enhancements (Phase 2+)

### Phase 2: Additional Specialist Agents
- ✅ Supervisor (DONE)
- 🚧 Threat Hunting Agent
- 🚧 Digital Forensics Agent
- 🚧 Response Agent
- 🚧 Reviewer Agent

### Phase 3: Advanced Features
- 🔮 Investigation checkpointing (pause/resume)
- 🔮 Human-in-the-loop approval gates
- 🔮 Confidence-based agent selection
- 🔮 Cost-aware investigation (token budgets)
- 🔮 Multi-alert correlation

### Phase 4: Observability
- 🔮 Real-time investigation visualization (React Flow)
- 🔮 Agent performance metrics
- 🔮 Investigation replay (debugging)
- 🔮 Token usage tracking per investigation

## Troubleshooting

### Investigation Loops Forever

**Symptom**: Max iterations reached, still no conclusion

**Causes:**
- Supervisor confidence threshold too high
- Missing evidence that can't be obtained
- Unimplemented agents causing uncertainty

**Fix:**
```python
# Lower confidence threshold
auto_conclude_confidence = 0.6  # Was 0.7

# Or reduce max iterations
max_iterations = 2  # Was 3
```

### Agents Not Running in Parallel

**Symptom**: Agent trace shows sequential execution

**Check:**
1. Supervisor's `parallel_agents` plan
2. Python event loop (must be async context)
3. Agent errors (failures force sequential fallback)

**Debug:**
```python
# Enable debug logging
logging.getLogger("agents.supervisor_agent").setLevel(logging.DEBUG)
logging.getLogger("graph.workflow_v2").setLevel(logging.DEBUG)
```

### Supervisor Planning Failures

**Symptom**: Generic investigation plan, "Fallback plan due to error"

**Causes:**
- LLM API timeout
- Invalid structured output
- GROQ_API_KEY not set

**Fix:**
```python
# Check logs for LLM errors
# Ensure .env has valid GROQ_API_KEY
# Test LLM connection:
from langchain_groq import ChatGroq
llm = ChatGroq(model="llama3-8b-8192", api_key="...")
llm.invoke("test")
```

## References

- LangGraph Documentation: https://langchain-ai.github.io/langgraph/
- MITRE ATT&CK Framework: https://attack.mitre.org/
- Multi-Agent Systems: https://en.wikipedia.org/wiki/Multi-agent_system
- Supervisor Pattern: https://en.wikipedia.org/wiki/Supervisor_pattern

---

**Last Updated**: 2026-11-06  
**Version**: 2.0.0  
**Status**: Phase 1 Complete ✅
