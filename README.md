# Agentic RAG for Security Operations Center (SOC)

A production-ready Multi-Agent Retrieval-Augmented Generation system designed for analyzing and classifying SOC alerts based on internal policies and logs.

## Architecture Update

This repository has been fully upgraded to a separated Django backend and a modern Next.js frontend!
- **Backend (Django)**: Wraps the LangGraph workflow in native async views.
- **Frontend (Next.js)**: A sleek, dark-mode cybersecurity dashboard created using Vanilla CSS modules and Next.js.

## Installation

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure API Key
Create a `.env` file in the `backend/` root:
```
GOOGLE_API_KEY=your_gemini_api_key
```
Note: If this key is missing or invalid, the backend will return a 500 Internal Server Error when you attempt to analyze an alert.

### 3. Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

## Running the Servers

### Django API
**Crucial Note for Local Qdrant**: Because the vector database (Qdrant) relies on local files that cannot be locked by multiple processes, you MUST run Django without the auto-reloader:
```bash
cd backend
python manage.py runserver 8000 --noreload
```

### Next.js UI
In a separate terminal:
```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:3000` to interact with the Multi-Agent system!

## Agentic Workflow Architecture

The core of this system operates via a multi-agent orchestrated pipeline using **LangGraph**. The workflow acts as a state graph, dynamically branching and evaluating its own retrieval logic before coming to a final decision. It mimics a highly sophisticated SOC Analyst. 

### System Workflow Diagram




### 1. Agents at Work
- **Query Rewriter Agent**: Ingests raw alerts or previously failed queries and extracts high-value technical indicators (CVEs, IPs, file hashes) to craft an optimized, strict query for the vector database.
- **Retriever Agent**: Takes the optimized query and pulls the top semantically relevant security contexts (playbooks, logs, policies) from the local **Qdrant** vector database, using `all-MiniLM-L6-v2` embeddings.
- **Evaluator Agent (Self-RAG)**: Judges whether the retrieved documents actually contain enough technical detail to classify the alert. If it detects missing aspects, it overrides the flow and routes it *back* to the Query Rewriter (with a maximum of 1 retry loop) to fetch better data.
- **SOC Reasoning Agent**: The primary analyst. It correlates the raw alert with the securely retrieved organizational context to determine the incident severity, perform root cause analysis, and dictate mitigation strategies.
- **Reporter Agent**: Formats the final verdict into a highly structured, evidence-backed JSON report, ready for dashboard consumption.

### 2. Workflow Example 

**The Input Alert**: 
> "EDR detection malware invoice.exe hash a94a8fe5ccb19ba61c4c0873d391e987982fbbd3 WORKSTATION-22 asmith"

**Step-by-Step Execution**:
1. **Query Rewriter**: Strips fluff and prioritizes technical indicators: `invoice.exe a94a8fe5... WORKSTATION-22 policy`.
2. **Retriever**: Queries the Qdrant DB. _(Let's assume it finds general EDR rules, but misses the specific hash policy)_.
3. **Evaluator**: Sees the retrieved docs contain general EDR rules but explicitly flags: *"Missing playbook response for known malicious hashes."* It sets `is_sufficient=False`.
4. **Router**: Sees the rejection and triggers a **Retry**. 
5. **Query Rewriter (Iteration 2)**: Reformulates query using evaluator feedback: `Playbook response for malicious hash a94a8fe...`.
6. **Retriever**: Successfully finds the specific Hash Quarantine Playbook in Qdrant.
7. **Evaluator**: Approves context (`is_sufficient=True`). Routes forward.
8. **SOC Reasoner**: Reads the Hash Quarantine Playbook, classifies the alert as **CRITICAL**, and mandates immediate endpoint isolation of `WORKSTATION-22`.
9. **Reporter**: Generates a structured `CRITICAL` JSON payload with citations for the UI dashboard.
