# NEXUS Command: Autonomous Multi-Agent SOC Platform
<img width="1536" height="1024" alt="SOC Agent" src="https://github.com/user-attachments/assets/941a7a14-3661-4ae2-bcbe-81e2a5289518" />

NEXUS Command is an AI-powered Security Operations Center (SOC) platform using **supervisor-controlled multi-agent architecture**. A central Supervisor Agent dynamically orchestrates specialist agents to investigate security threats, adapting investigation depth based on alert type and intermediate findings.

**Version 2.0** introduces intelligent routing, parallel execution, and adaptive investigation loops - transforming the platform from a linear pipeline into an autonomous security intelligence system.

## 🎯 What's New in V2

- ✅ **Supervisor Agent**: Central orchestrator that plans investigations and decides when analysis is complete
- ✅ **Dynamic Routing**: Different alert types trigger different agent combinations
- ✅ **Parallel Execution**: Independent agents (enrichment, MITRE) run concurrently
- ✅ **Adaptive Depth**: Simple alerts conclude in 1 iteration, complex threats get 2-3 deep-dive cycles
- ✅ **Bounded Loops**: Supervisor prevents infinite investigation with max 3 iterations
- ✅ **Evidence-Based Decisions**: Investigation continues until confidence threshold met or evidence complete

## System Architecture

NEXUS Command 2.0 operates on a supervisor-controlled multi-agent workflow powered by LangGraph.

### High-Level Architecture

```
Security Alert
    ↓
Ingestion (Extract IOCs)
    ↓
Supervisor (Create Investigation Plan)
    ↓
┌─────────────────────────────────┐
│   Execute Investigation Phase   │
│                                 │
│  Parallel Agents:               │
│  ├─ Enrichment (Threat Intel)   │
│  ├─ MITRE ATT&CK Mapping        │
│  ├─ Correlation                 │
│  └─ ... (dynamic selection)     │
└─────────────────────────────────┘
    ↓
Supervisor Check (Continue or Conclude?)
    ↓
┌───────┴──────┐
│              │
Continue    Conclude
(loop back)   ↓
           Finalize Report
```

**See [ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md) for complete technical documentation.**

## Multi-Agent System

### Current Agents (Phase 1 - ✅ Complete)

| Agent | Purpose | When Activated |
|-------|---------|----------------|
| **Supervisor** | Plans investigations, selects agents, monitors progress | Always |
| **Ingestion** | Extracts IOCs (IPs, domains, hashes, URLs), normalizes events | Always |
| **Enrichment** | Queries VirusTotal, AbuseIPDB, OTX, GreyNoise, IPInfo | When IOCs present |
| **MITRE** | Maps behaviors to ATT&CK tactics/techniques | When indicators present |
| **Correlation** | Deduplicates IOCs, identifies relationships | Multiple events |
| **Triage** | Calculates risk score (0-100) with severity | Always |
| **Decision** | Generates final verdict with LLM reasoning | Always |
| **Reporter** | Creates comprehensive markdown investigation report | Always |

### Future Agents (Phase 2 - 🚧 In Progress)

| Agent | Purpose | Status |
|-------|---------|--------|
| **Threat Hunting** | Searches historical incidents for patterns | Planned |
| **Digital Forensics** | Reconstructs attack timelines | Planned |
| **Response** | Generates and executes response playbooks | Planned |
| **Reviewer** | Independently validates findings | Planned |

## Investigation Examples

### Simple Alert (Port Scan)
```
Alert: Port scan from 45.33.32.156 to 10.0.0.5

Supervisor Plan:
  - Classification: port_scan
  - Urgency: low
  - Agents: enrichment, mitre, triage, decision

Execution:
  Phase 1 (parallel): Enrichment + MITRE
  Phase 2: Triage + Decision
  
Iterations: 1
Time: ~4-5 seconds
Verdict: Suspicious Activity - Monitor
```

### Complex Alert (Ransomware)
```
Alert: Mass file encryption, ransom note detected

Supervisor Plan:
  - Classification: ransomware  
  - Urgency: critical
  - Agents: enrichment, mitre, hunting, forensics, triage, decision, reviewer

Execution:
  Iteration 1: Initial analysis (enrichment, MITRE)
  Supervisor: "Needs more evidence" → CONTINUE
  Iteration 2: Deep analysis (correlation, triage, decision)
  Supervisor: "High confidence, complete" → CONCLUDE

Iterations: 2
Time: ~8-10 seconds  
Verdict: True Positive - Ransomware Detected
Status: ESCALATED
```

## Components

#### 1. Frontend (Next.js & React)
- **Framework**: Next.js App Router for optimized client-side rendering and routing.
- **Design System**: A custom CSS-module based "Glassmorphism" design system utilizing dynamic CSS variables for fluid transitions, skeleton loaders, and a centralized `ThemeProvider` for Light/Dark mode toggling.
- **Key Modules**:
  - `LayoutShell`: Manages the global layout, floating sidebar, and top navigation bar.
  - `CommandPalette`: Global `⌘K` search overlay for rapid navigation.
  - `Analyze Page`: Real-time interactive UI featuring a Monaco Editor for raw alert JSON drop-in, synchronized with an AI "thinking" animation pipeline and a dynamic scoring ring.

#### 2. Backend Orchestration (FastAPI & LangGraph V2)
- **API Layer (FastAPI)**: Serves RESTful endpoints (`/api/stats`, `/api/incidents`, `/api/analyze-alert`) with async, non-blocking communication
- **Persistence (SQLite)**: Local database tracks incidents, agent verdicts, extracted IOCs, and investigation history
- **LangGraph Multi-Agent Workflow V2**: Supervisor-controlled state machine with:
  - **Supervisor Agent**: Creates investigation plans, selects agents dynamically, decides when to conclude
  - **Conditional Routing**: Different paths for different alert types (port scan vs. ransomware)
  - **Parallel Execution**: Independent agents run concurrently (enrichment + MITRE)
  - **Bounded Loops**: Max 3 investigation iterations to prevent infinite analysis
  - **Specialist Agents**: Each agent has specific expertise (threat intel, MITRE mapping, risk scoring, etc.)

#### 3. External Integrations
- **Threat Intel**: Integrates with VirusTotal, AbuseIPDB, AlienVault OTX, GreyNoise, and IPinfo.io.
- **LLM Providers**: Pluggable architecture supporting OpenAI (GPT-4) and Groq (Llama 3) for the reasoning tasks inside the LangGraph nodes.

## Project Structure

```
soc-agent/
├── app/                  # Next.js Frontend
│   ├── analyze/          # Alert ingestion interface
│   ├── components/       # Reusable Glassmorphism UI components
│   ├── incidents/        # Incident feed
│   ├── mitre/            # MITRE ATT&CK heatmap
│   └── page.tsx          # Dashboard
├── backend/              # Python Backend
│   ├── agents/           # Specialized LangGraph Agents
│   ├── api/              # FastAPI endpoints
│   ├── config/           # Environment & Settings
│   ├── data/             # Bundled datasets (MITRE, Synthetic Alerts)
│   ├── gateways/         # Threat Intel API Integrations
│   ├── graph/            # LangGraph Workflow Orchestrator
│   └── schemas/          # Pydantic state models
└── README.md
```

## Running the System

### Prerequisites
- Python 3.11+
- Node.js 18+
- GROQ API key (free at groq.com)
- (Optional) Threat intel API keys: VirusTotal, AbuseIPDB, AlienVault OTX

### Quick Start

1. **Clone and setup environment:**
```bash
git clone <repository>
cd <repository>
cp .env.example .env
```

2. **Edit `.env` with your API keys:**
```bash
# Required
GROQ_API_KEY=gsk_your_groq_key_here

# Optional (system works without these)
VT_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
OTX_API_KEY=your_alienvault_key
```

3. **Install and run backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

4. **Install and run frontend:**
```bash
npm install
npm run dev
```

5. **Access the platform:**
Navigate to `http://localhost:3000`

### Testing the Workflow

Test the new supervisor-controlled workflow:

```bash
cd backend
python test_workflow_v2.py
```

This runs 5 different alert scenarios (port scan, brute force, malware, ransomware, PowerShell) and shows:
- Investigation planning
- Agent selection
- Parallel execution
- Adaptive iteration depth
- Final verdicts

## Docker Deployment

```bash
docker-compose up --build
```

Frontend: http://localhost:3001  
Backend API: http://localhost:8000  
API Docs: http://localhost:8000/docs

## Performance Improvements (V1 → V2)

| Alert Type | V1 (Sequential) | V2 (Parallel + Adaptive) | Improvement |
|------------|----------------|--------------------------|-------------|
| Port Scan | ~8-10s | ~4-5s | **50% faster** |
| Malware | ~10-12s | ~5-6s | **50% faster** |
| Ransomware | ~12-15s | ~8-10s | **35% faster** |

**Why faster?**
- Enrichment + MITRE run in parallel (saves 2-3s)
- Simple alerts skip unnecessary deep analysis (saves 2-4s)
- Supervisor overhead: only +0.5-1s for planning

## API Compatibility

V2 maintains **100% backward compatibility** with V1 API:

```python
POST /api/analyze-alert
{
  "alert": "Raw security alert text..."
}

Response:
{
  "structured_json": { ... },  # Same format
  "report": "...",             # Enhanced with supervisor details
  "iterations": 2,             # Now shows actual investigation depth
  "telemetry_data": [ ... ]
}
```

**New fields in V2:**
- `investigation_plan_summary`: Alert classification and urgency
- `supervisor_iteration`: How many investigation cycles ran
- `supervisor_decision`: Why the investigation concluded

## Roadmap

### ✅ Phase 1: Core Multi-Agent Architecture (Complete)
- Supervisor Agent with dynamic routing
- Parallel agent execution
- Adaptive investigation depth (1-3 iterations)
- Conditional workflow with bounded loops

### 🚧 Phase 2: Specialist Agents (Next)
- Threat Hunting Agent (historical pattern search)
- Digital Forensics Agent (attack timeline reconstruction)
- Response Agent (automated playbook execution)
- Reviewer Agent (independent validation)

### 🔮 Phase 3: Advanced Features
- PostgreSQL + pgvector (investigation memory)
- Real-time WebSocket updates
- Agent Control Room UI (live monitoring)
- Investigation graph visualization (React Flow)

### 🔮 Phase 4: Enterprise Features
- Authentication & RBAC
- Response action approval workflow
- Audit logging
- OpenTelemetry observability
- Cost tracking (LLM tokens)

## Documentation

- **[ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md)** - Complete technical architecture
- **[API Documentation](http://localhost:8000/docs)** - Interactive API docs (when backend running)
- **[MITRE ATT&CK](https://attack.mitre.org/)** - Framework reference

## Contributing

NEXUS Command is under active development. Phase 1 (Supervisor Architecture) is complete.

**How to contribute:**
1. Phase 2 agents need implementation (see `backend/agents/`)
2. Frontend Agent Control Room needs UI (see `app/agents/`)
3. Test coverage expansion (see `backend/test_workflow_v2.py`)

## License

[Your License Here]

## Acknowledgments

- **LangGraph**: Multi-agent orchestration framework
- **MITRE ATT&CK**: Threat intelligence framework
- **Groq**: Fast LLM inference
- **Next.js**: Frontend framework
- **FastAPI**: Backend framework

---

**Version**: 2.0.0 (Phase 1 Complete)  
**Last Updated**: November 6, 2026  
**Status**: Production-Ready Core, Additional Agents In Development
