# 🧭 DataPilot

> **Autonomous Multimodal Dataset Readiness & Quality Auditor for AI Training Pipelines**  
> *Know your data before burning compute. Audit open-source datasets for fine-tuning readiness, catch poison samples, and export clean, curated training seeds.*

---

## 🎯 Executive Summary & Mission

Training or fine-tuning foundation models on open-source datasets (from Hugging Face or web archives) is fraught with silent risks. Real-world public datasets are frequently contaminated with:
- **Empty or Truncated Responses:** Model learns refusal loops or abrupt cutoffs.
- **Verbatim Instruction Leakage:** Model copies the prompt into the output instead of completing the task.
- **Acoustic Speech Degradation:** Clipped waveforms, excessive dead air (>1.8s), or missing terminal punctuation ruin vocoder and TTS alignment.
- **Context Window Overflow:** Outlier samples exceeding 2,048 tokens that silently get truncated during batched attention computation.
- **Semantic Drift & Hallucination:** Targets that fail to answer the user's specific prompt objective.

**DataPilot** is a local-first, multimodal dataset auditor designed to solve this dilemma. It combines **deterministic physical signal checks** with **Google Gemini 3.5 LLM-as-a-Judge semantic reasoning** to determine whether open-source datasets are genuinely suitable for training.

```
       ┌────────────────────────────────────────────────────────┐
       │                 THE DATAPILOT PROMISE                  │
       │                                                        │
       │  "Never feed unverified data into a training run.       │
       │   Audit first. Filter out defects. Train with Golden." │
       └────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

| Capability | Description |
| :--- | :--- |
| 🛡️ **Zero-Compromise Security** | Local-first architecture. Large partitions stay on your disk; only bounded sample batches are evaluated. Your `.env` and API tokens never leave your local environment. |
| 🎙️ **Multimodal Auditing** | Supports both **NLP Text** (SFT Instruction Tuning, Q&A Reasoning, Classification) and **Acoustic Audio** (Speech TTS, Voice Synthesis, Utterance Transcripts). |
| 🧠 **Autonomous Metric Planning** | Gemini 3.5 analyzes your dataset schema and training objective to generate bespoke **Qualitative Rubrics** and **Physical Threshold Blueprints** without human bias. |
| 🔬 **Transparent Prompt Studio** | Review and edit the synthesized LLM-as-a-Judge system prompt and user template before evaluation. Context chips keep metrics visible. |
| ⚡ **Resilient Chunked Evaluator** | Batch-evaluates samples in sub-chunks of 15 records to prevent token overflow, accompanied by a multi-stage self-healing JSON parser. |
| 📊 **Dynamic Good vs Bad Explorer** | Real-time Doughnut & Bar charts, 1-click partition filters (`All`, `🔴 Defective`, `🟡 Curation`, `🟢 Golden`), and deep diagnostic inspection drawer. |
| 📥 **1-Click Clean Dataset Export** | Toggle exclusions on anomalous samples and download verified, production-ready curated datasets in standard JSON format. |
| 🎨 **Frosted Glass Interactive UI** | Minimalist aesthetic on a black dot-matrix grid with interactive cursor ripples and canvas physics. |

---

## 🏗️ System Architecture

DataPilot operates on a decoupled client-server architecture:
- **Frontend:** Lightweight, zero-dependency HTML5/CSS3/Vanilla ES6+ web interface with interactive physics and Chart.js visualizations.
- **Backend:** High-performance **FastAPI** Python application orchestrating Hugging Face datasets-server streaming and Google Gemini API evaluations.

```mermaid
flowchart TD
    subgraph UI["Interactive Frosted-Glass UI (Browser)"]
        S1["Step 1: Ingestion & Objective"] --> S2["Step 2: Schema & Metric Blueprint"]
        S2 --> S3["Step 3: Prompt Studio & Manager"]
        S3 --> S4["Step 4: Good vs Bad Explorer"]
        S4 --> Export["1-Click Curated Dataset Export"]
    end

    subgraph API["DataPilot FastAPI Backend (Port 8000)"]
        RouterDS["/api/datasets/*\n(Validate, Inspect, Download)"]
        RouterPlanner["/api/planner/*\n(Generate Metrics, Eval Prompts)"]
        RouterAudits["/api/audits/*\n(Evaluate Samples, Export Curated)"]
    end

    subgraph External["External Cloud Services"]
        HF["Hugging Face API\n(datasets-server /first-rows)"]
        Gemini["Google Gemini API\n(gemini-3.5-flash-lite)"]
    end

    subgraph Storage["Local Disk Storage"]
        Cache["./data/{repo_id}/\n(Bounded Partitions)"]
        Out["./artifacts/\n(Clean Datasets)"]
    end

    S1 -->|POST /api/datasets/inspect| RouterDS
    RouterDS -->|REST| HF
    HF -->|Partition Rows| RouterDS
    RouterDS --> Cache

    S2 -->|POST /api/planner/generate-metrics| RouterPlanner
    RouterPlanner -->|Schema Context| Gemini
    Gemini -->|Metric Plan JSON| RouterPlanner

    S3 -->|POST /api/planner/generate-eval-prompt| RouterPlanner
    RouterPlanner -->|Prompt Synthesis| Gemini
    Gemini -->|System & User Templates| RouterPlanner

    S4 -->|POST /api/audits/evaluate| RouterAudits
    RouterAudits -->|Chunked Batches| Gemini
    Gemini -->|Evaluation Verdicts| RouterAudits
    RouterAudits --> S4

    Export -->|POST /api/audits/export-curated| RouterAudits
    RouterAudits --> Out
    Out --> Export
```

---

## 🔄 End-to-End Request-Response Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as ML Engineer
    participant UI as DataPilot Web Client
    participant API as FastAPI Backend
    participant HF as Hugging Face Datasets
    participant LLM as Google Gemini 3.5

    User->>UI: Enter Repo ID & Training Objective (e.g. tatsu-lab/alpaca, 100 samples)
    UI->>API: POST /api/datasets/inspect {url, hf_token}
    API->>HF: Inspect Repo Metadata & Splits
    HF-->>API: Total Rows, Gated Status, Columns
    API-->>UI: Schema & Partition Info

    UI->>API: POST /api/datasets/download {max_rows: 100}
    API->>HF: Fetch partition rows via /first-rows
    HF-->>API: 100 Dataset Records
    API->>API: Save locally in ./data/{repo_id}/
    API-->>UI: 100 Downloaded Sample Rows

    UI->>API: POST /api/planner/generate-metrics {schema, sample_records}
    API->>LLM: Formulate domain, qualitative metrics, physical metrics
    LLM-->>API: Structured MetricPlanResponse JSON
    API-->>UI: Render Screen 2 (Qualitative & Physical Tables)

    User->>UI: Click "Synthesize Evaluation Prompt"
    UI->>API: POST /api/planner/generate-eval-prompt
    API->>LLM: Synthesize LLM Judge Persona & Template
    LLM-->>API: EvalPromptResponse (System + User Template)
    API-->>UI: Render Screen 3 Prompt Studio (Editable)

    User->>UI: Click "Run Live Evaluation"
    UI->>API: POST /api/audits/evaluate {samples: 100, prompt_templates}
    loop Chunked Evaluation (15 samples / batch)
        API->>LLM: Sub-batch evaluation prompt + JSON schema
        LLM-->>API: Sample verdicts, scores, and defect quotes
    end
    API->>API: Calculate defect rate %, readiness verdict & metric pass rates
    API-->>UI: AuditEvaluationResponse (100 Sample Items)

    UI->>UI: Render Screen 4 Charts & Dynamic Good vs Bad Table
    User->>UI: Click "Export Curated Clean Dataset"
    UI->>API: POST /api/audits/export-curated {excluded_indices}
    API-->>User: Download verified clean JSON dataset!
```

---

## 🖥️ Frontend Walkthrough (Step-by-Step)

The interface is structured into four sequential screens, ensuring full human-in-the-loop oversight:

### Screen 1: Prompt & Ingestion Setup
```
┌────────────────────────────────────────────────────────────────────────┐
│  DATASET AUDIT INGESTION                                               │
│                                                                        │
│  Hugging Face Dataset URL / ID:                                        │
│  [ tatsu-lab/alpaca                                                  ] │
│                                                                        │
│  Training Objective Prompt:                                            │
│  [ Fine-tune an instruction-following LLM. Audit instruction-output   ] │
│  [ alignment, detect empty responses, and check token lengths.         ] │
│                                                                        │
│  Modality: [LLM Instruction Tuning ▼]  Budget: [100 Samples (Standard)▼]│
│                                                                        │
│                                           [ Inspect Dataset &rarr; ]      │
└────────────────────────────────────────────────────────────────────────┘
```
- **Inputs:** Hugging Face URL or identifier, free-form training objective description, modality selector, and sample budget (25, 50, 100, 250).
- **History Sidebar:** 1-click audit history presets for `tatsu-lab/alpaca`, `mozilla-foundation/common_voice_11_0`, `databricks/dolly`, and `stanfordnlp/imdb`.
- **Canvas Physics:** Click anywhere on the background to send animated energy waves across the charcoal dot matrix.

---

### Screen 2: Schema Inspection & AI Metric Blueprint
```
┌────────────────────────────────────────────────────────────────────────┐
│  DETECTED SCHEMA & PROFILE                  Total Profiled: 52,002 rows │
│                                                                        │
│  Column Name     Detected Role        Data Type   Null (%)  Preview    │
│  ───────────     ─────────────        ─────────   ────────  ───────    │
│  instruction     Prompt / Query       string      0.0%      "Give 3..."│
│  input           Context / Auxiliary  string      0.0%      ""         │
│  output          Target Response      string      0.0%      "1. Eat..."│
│                                                                        │
│  QUALITATIVE METRICS (Evaluated via Gemini LLM-as-a-Judge)             │
│  • QUAL_01: Instruction-Response Semantic Alignment                    │
│  • QUAL_02: Reasoning Depth & Hallucination Avoidance                  │
│                                                                        │
│  PHYSICAL METRICS (Deterministic Signal Blueprint)                     │
│  • PHYS_01: Sequence Token Length (tiktoken / 50-2048 tokens)          │
│  • PHYS_02: Signal-to-Noise Ratio (librosa / >20 dB)                   │
│                                                                        │
│                                    [ Synthesize Evaluation Prompt &rarr; ]│
└────────────────────────────────────────────────────────────────────────┘
```
- **Semantic Tagging:** Columns are automatically tagged with badges (`Prompt / Query`, `Context`, `Target Output`, `Acoustic Stream`).
- **No Premature Verdicts:** Gemini does NOT guess dataset suitability before looking at samples; it only establishes domain-specific quality rubrics.

---

### Screen 3: Prompt Studio & Evaluation Manager
```
┌────────────────────────────────────────────────────────────────────────┐
│  PROMPT STUDIO & EVALUATION SUITE                                      │
│                                                                        │
│  Embedded Metrics: [QUAL_01: Alignment] [QUAL_02: Fluency]             │
│                                                                        │
│  SYSTEM PROMPT:                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ You are an expert AI Data Quality Auditor. Strictly evaluate     │  │
│  │ each sample against the qualitative criteria. Return valid JSON. │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  USER TEMPLATE:                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ### TRAINING OBJECTIVE: "Fine-tune instruction LLM..."           │  │
│  │ ### DATA SAMPLES: {{SAMPLE_RECORDS}}                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [ Copy Prompt ]                     [ Run Live Evaluation on 100 &rarr; ]│
└────────────────────────────────────────────────────────────────────────┘
```
- **Editable & Transparent:** You can modify instructions, rubrics, or formatting rules before hitting the model.
- **Variable Interpolation:** `{{SAMPLE_RECORDS}}` dynamically injects the downloaded bounded sample batch at execution time.

---

### Screen 4: Findings & Dynamic Good vs Bad Explorer
```
┌────────────────────────────────────────────────────────────────────────┐
│  EXECUTIVE AUDIT SUMMARY                                               │
│                                                                        │
│  Profiled Rows     Audited Samples     Defects Detected    Readiness   │
│     52,002               100                  8         Needs Filter   │
│                                                                        │
│  [ Quality Breakdown Doughnut ]      [ Qualitative Pass-Rate Bar ]     │
│  • 88 Golden Seed Samples            • QUAL_01: 94.0% Pass             │
│  •  8 Needs Curation                 • QUAL_02: 92.0% Pass             │
│  •  4 Critical Defects                                                 │
│                                                                        │
│  PARTITION FILTERS:                                                    │
│  [All Samples (100)] [🔴 Defective (4)] [🟡 Curation (8)] [🟢 Golden (88)]│
│                                                                        │
│  SAMPLE EXPLORER TABLE:                                                │
│  Record ID    Status          Preview Snippet             Action       │
│  ─────────    ──────          ───────────────             ──────       │
│  rec_0001     🟢 GOLDEN PASS  "Give 3 tips for health..." [ Inspect ➔ ]│
│  rec_0014     🔴 CRITICAL     "[TODO]"                    [ Inspect ➔ ]│
│  rec_0038     🟡 CURATION     "Verbatim repetition..."    [ Inspect ➔ ]│
│                                                                        │
│                            [ 📥 Export Curated Clean Dataset ]         │
└────────────────────────────────────────────────────────────────────────┘
```
- **Partition Filtering:** Instantly isolate good vs bad samples with 1 click.
- **Deep Diagnostic Drawer:** Clicking any sample slides open a drawer containing:
  - Exact **Cited Defect Quote** (the smoking gun in the sample).
  - Evaluator **Rationale & Failing Metric**.
  - Formatted **Raw Record JSON**.
  - **Audio Waveform Stream Player** (for speech/audio datasets).
  - `[ 🗑️ Exclude from Clean Dataset ]` toggle button.
- **Curated Clean Export:** Automatically excludes critical defects and downloads a ready-to-train JSON dataset.

---

## 🚀 Quickstart & How to Run

### 1. Prerequisites
- **Python:** 3.10 or higher
- **Modern Browser:** Chrome, Edge, Firefox, or Safari
- **API Keys:**
  - [Google Gemini API Key](https://aistudio.google.com/app/apikey) (Free tier supported)
  - [Hugging Face Token](https://huggingface.co/settings/tokens) (Optional, for gated datasets like Common Voice)

### 2. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/your-username/datapilot.git
cd datapilot

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and insert your credentials:
```bash
cp .env.example .env
```
Edit `.env`:
```env
# Hugging Face Access Token
HF_TOKEN=hf_your_token_here

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

> [!IMPORTANT]
> The `.env` file is explicitly ignored in `.gitignore`. Never commit your API keys to version control!

### 4. Start the Application

Start the FastAPI backend with hot-reload enabled:
```bash
uvicorn app.main:app --reload --port 8000
```

Verify backend health:
```bash
curl http://127.0.0.1:8000/api/health
# Response: {"status":"healthy","version":"1.0.0","service":"DataPilot Backend"}
```

### 5. Launch the Web Interface
You can access the UI in two ways:
1. **Via Backend:** Open `http://localhost:8000` in your browser.
2. **Direct File Open:** Double-click `app/static/index.html` directly in your file explorer. DataPilot dynamically binds to `http://127.0.0.1:8000` regardless of origin.

---

## 🧪 Running Automated Tests

Run the end-to-end API test suite using `pytest`:
```bash
# Ensure virtual environment is active
pytest -v tests/test_api_endpoints.py
```

The test suite validates:
- `GET /api/health` service status.
- `POST /api/datasets/validate-url` security and input sanitization.
- `POST /api/datasets/inspect` schema reflection.
- `POST /api/datasets/download` bounded partition caching.
- `POST /api/planner/generate-metrics` AI rubric planning.
- `POST /api/planner/generate-eval-prompt` LLM judge prompt assembly.

---

## 📡 REST API Reference

| Endpoint | Method | Request Payload | Description |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | *None* | Heartbeat and service health ping. |
| `/api/datasets/validate-url` | `POST` | `{"url": "str"}` | Validates HF URL syntax and sanitizes malicious characters. |
| `/api/datasets/inspect` | `POST` | `{"url": "str", "hf_token": "opt"}` | Inspects repository metadata, splits, and schema. |
| `/api/datasets/download` | `POST` | `{"url": "str", "max_rows": 100}` | Downloads and locally caches bounded sample partitions. |
| `/api/planner/generate-metrics`| `POST` | `{"training_objective": "str", "schema_definitions": {}, "sample_records": []}` | Generates qualitative and physical audit blueprints via Gemini. |
| `/api/planner/generate-eval-prompt` | `POST` | `{"training_objective": "str", "qualitative_metrics": []}` | Synthesizes LLM-as-a-Judge system & user prompts. |
| `/api/audits/evaluate` | `POST` | `{"samples": [], "eval_system_prompt": "str", "eval_user_prompt_template": "str"}` | Runs chunked evaluation across samples and compiles stats. |
| `/api/audits/export-curated` | `POST` | `{"repo_id": "str", "samples": [], "excluded_indices": []}` | Drops defective records and returns clean training dataset. |

---

## 📂 Project Repository Structure

```
datapilot/
├── .env.example              # Credentials & configuration template
├── .gitignore                # Strictly excludes .env, data/, and caches
├── requirements.txt          # Python production & test dependencies
├── README.md                 # Complete documentation & architectural guide
│
├── app/                      # Application Source Code
│   ├── main.py               # FastAPI entrypoint & router mounts
│   ├── config.py             # Settings, paths, and environment loader
│   │
│   ├── api/                  # REST API Route Controllers
│   │   ├── audits.py         # /api/audits endpoints (evaluate & export)
│   │   ├── datasets.py       # /api/datasets endpoints (inspect & download)
│   │   └── planner.py        # /api/planner endpoints (metrics & prompts)
│   │
│   ├── services/             # Core Business Logic & AI Engines
│   │   ├── evaluator.py      # Chunked LLM-as-a-Judge & fallback heuristics
│   │   ├── gemini_service.py # Gemini 3.5 Flash Lite client & normalizers
│   │   └── hf_service.py     # Hugging Face datasets-server streaming
│   │
│   └── static/               # Client-Side Web UI
│       ├── index.html        # 4-Screen Frosted Glass Layout
│       ├── styles.css        # Minimalist aesthetic & interactive waves
│       └── app.js            # Reactive state, charts, and API orchestrator
│
└── tests/                    # Verification & Automated Test Suites
    └── test_api_endpoints.py # End-to-end API route tests
```

---

## 🤝 Contributing

Contributions are welcome! If you want to add new modality evaluators (e.g., Computer Vision / Video), deterministic physical metric calculators, or new LLM backends:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/NewModality`).
3. Commit your Changes (`git commit -m 'Add Vision readiness auditor'`).
4. Push to the Branch (`git push origin feature/NewModality`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.
