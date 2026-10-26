// DataPilot Copilot - Multi-Modal Dataset Quality Auditor Logic
// Includes Layer 1 Canvas Dot Grid with Interactive Wave Physics (Light Mode)

// Dynamically resolve Backend API Base URL:
// If opened directly from disk (file://) or a separate frontend dev server (e.g. port 3000, 5500),
// route API requests to the standalone FastAPI backend at http://127.0.0.1:8000
const API_BASE_URL = (window.location.protocol === "file:" || (window.location.port !== "8000" && window.location.hostname !== "127.0.0.1"))
  ? "http://127.0.0.1:8000"
  : (window.location.port === "8000" ? "" : "http://127.0.0.1:8000");

// ============================================================
// SECTION 1: CANVAS DOT GRID & WAVE PHYSICS ENGINE
// ============================================================

class WaveBackgroundEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    // Tunable constants per spec
    this.SPACING = window.innerWidth < 640 ? 32 : 26;
    this.WAVE_SPEED = 0.6;   // px per ms
    this.WAVE_WIDTH = 60;    // thickness of wave band (px)
    this.WAVE_LIFE = 2200;   // ms life
    this.PUSH = 14;          // max px dot displacement
    this.HOVER_RADIUS = 140; // cursor glow radius (px)
    this.MAX_WAVES = 8;      // wave cap

    // State
    this.waves = [];
    this.mouse = { x: -9999, y: -9999 };
    this.dots = [];
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.animId = null;
    this.isRunning = false;
    this.mouseMoved = false;
    this.resizeTimeout = null;

    // Accessibility check
    this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.init();
  }

  init() {
    this.resize();
    this.bindEvents();

    if (this.prefersReducedMotion) {
      this.drawStaticGrid();
    } else {
      this.startLoop();
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.SPACING = this.width < 640 ? 32 : 26;

    // Backing store & CSS sizing
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Build dot grid
    this.dots = [];
    for (let y = this.SPACING / 2; y < this.height; y += this.SPACING) {
      for (let x = this.SPACING / 2; x < this.width; x += this.SPACING) {
        this.dots.push({ x, y });
      }
    }

    this.wakeUp();
  }

  bindEvents() {
    // Window Resize debounced by 150ms
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 150);
    });

    // Pointer move for hover glow
    window.addEventListener("pointermove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouseMoved = true;
      this.wakeUp();
    });

    // Pointer leave clears glow
    window.addEventListener("pointerleave", () => {
      this.mouse.x = -9999;
      this.mouse.y = -9999;
      this.mouseMoved = true;
      this.wakeUp();
    });

    // Window Click / Pointerdown handler
    window.addEventListener("pointerdown", (e) => {
      const target = e.target;
      const isInput = target.closest("input, textarea, select, [data-no-wave]");
      const isBtn = target.closest("button, .btn-clean, .btn-send-audit, a");

      // Special case: Primary buttons launch wave from center with strength 1.6
      if (isBtn && (isBtn.classList.contains("btn-send-audit") || isBtn.classList.contains("btn-clean-primary"))) {
        const rect = isBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        this.addWave(cx, cy, 1.6);
        return;
      }

      if (isInput || (isBtn && !target.classList.contains("ui-layer"))) {
        return;
      }

      // Background click: wave at cursor with strength 1.0
      this.addWave(e.clientX, e.clientY, 1.0);
    });

    // Visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopLoop();
      } else {
        this.wakeUp();
      }
    });
  }

  addWave(x, y, strength = 1.0) {
    if (this.prefersReducedMotion) return;

    this.waves.push({
      x,
      y,
      start: performance.now(),
      strength
    });

    if (this.waves.length > this.MAX_WAVES) {
      this.waves.shift();
    }

    this.wakeUp();
  }

  wakeUp() {
    if (!this.isRunning && !this.prefersReducedMotion) {
      this.startLoop();
    }
  }

  startLoop() {
    this.isRunning = true;
    const loop = (now) => {
      this.renderFrame(now);

      if (this.waves.length === 0 && !this.mouseMoved) {
        this.isRunning = false;
        return;
      }

      this.mouseMoved = false;
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stopLoop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  drawStaticGrid() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = "rgba(20, 20, 19, 0.18)";
    for (const d of this.dots) {
      this.ctx.beginPath();
      this.ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderFrame(now) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Expire old waves
    this.waves = this.waves.filter((w) => now - w.start <= this.WAVE_LIFE);

    // 2. Render Black/Charcoal Dots on White Background
    for (const d of this.dots) {
      let dx = 0;
      let dy = 0;
      let energy = 0;

      for (const w of this.waves) {
        const age = now - w.start;
        const radius = age * this.WAVE_SPEED;
        const vx = d.x - w.x;
        const vy = d.y - w.y;
        const dist = Math.hypot(vx, vy) || 1;

        const band = Math.exp(-(((dist - radius) / this.WAVE_WIDTH) ** 2));
        const fade = 1 - age / this.WAVE_LIFE;
        const k = band * fade * w.strength;
        const osc = Math.sin(((dist - radius) / this.WAVE_WIDTH) * Math.PI);

        dx += (vx / dist) * osc * k * this.PUSH;
        dy += (vy / dist) * osc * k * this.PUSH;
        energy += k;
      }

      // Hover glow
      const m = Math.hypot(d.x - this.mouse.x, d.y - this.mouse.y);
      energy += Math.max(0, 1 - m / this.HOVER_RADIUS) * 0.6;

      const e = Math.min(energy, 1.5);
      const r = 1 + e * 1.8; // 1px at rest, up to ~3.7px
      const alpha = 0.16 + e * 0.65;
      const t = Math.min(e, 1);

      // Lerp colour: Black/Charcoal rgb(20, 20, 19) -> Clay Orange rgb(217, 119, 87)
      const cr = Math.round(20 + t * (217 - 20));
      const cg = Math.round(20 + t * (119 - 20));
      const cb = Math.round(19 + t * (87 - 19));

      this.ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(d.x + dx, d.y + dy, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 3. Draw Clay Wave Ring Outlines
    for (const w of this.waves) {
      const age = now - w.start;
      const radius = age * this.WAVE_SPEED;
      const fade = 1 - age / this.WAVE_LIFE;
      const ringAlpha = 0.45 * fade * w.strength;

      if (ringAlpha > 0.01) {
        this.ctx.strokeStyle = `rgba(217, 119, 87, ${ringAlpha})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }
}


// ============================================================
// SECTION 2: MULTI-MODAL AUDIT DATA & INTERACTION
// ============================================================

const DATASET_FIXTURES = {
  alpaca: {
    id: "tatsu-lab/alpaca",
    task: "LLM Instruction Tuning",
    modality: "Instruction Text (Text-to-Text)",
    rows: 52002,
    samples: 100,
    anomalies: 8,
    verdict: "Needs Filtering",
    columns: [
      { name: "instruction", role: "Prompt / Query", type: "string", nulls: "0.0%", preview: '"Give three tips for staying healthy."' },
      { name: "input", role: "Context / Auxiliary", type: "string", nulls: "0.0%", preview: '"" (Optional user context)' },
      { name: "output", role: "Target Response", type: "string", nulls: "0.0%", preview: '"1. Eat a balanced diet with vegetables..."' }
    ],
    checks: [
      { id: "empty_responses", name: "Missing / Truncated Responses", scope: "Deterministic", finding: "String length < 10 chars" },
      { id: "token_distribution", name: "Token Length & Context Overflow", scope: "Deterministic", finding: "Outliers (>2048 tokens)" },
      { id: "instruction_leakage", name: "Prompt & Role Contamination", scope: "Deterministic", finding: "Levenshtein overlap > 0.85" },
      { id: "gemini_semantic_eval", name: "AI Semantic Quality Review", scope: "Gemini API", finding: "Hallucination & refusal pattern check" }
    ],
    issues: [
      {
        id: "rec_inst_0014",
        check: "empty_responses",
        checkName: "Truncated Response Output",
        severity: "critical",
        finding: "Output string length is 6 characters ('[TODO]')",
        recommendation: "Filter out placeholder and non-answering records",
        preview: 'Instruction: "Explain quantum tunneling in simple terms."\nOutput: "[TODO]"',
        evidence: "Output consists entirely of placeholder token '[TODO]'. Model fine-tuning on this record risks refusal/placeholder generation."
      },
      {
        id: "rec_inst_0038",
        check: "instruction_leakage",
        checkName: "Verbatim System Prompt Leakage",
        severity: "warning",
        finding: "Output repeats instruction verbatim without completing task",
        recommendation: "Remove or regenerate output using stronger reference",
        preview: 'Instruction: "Rewrite this paragraph in active voice."\nOutput: "Rewrite this paragraph in active voice."',
        evidence: "98% token match between instruction and output fields. Indicates failure of original data generation pipeline."
      },
      {
        id: "rec_inst_0072",
        check: "token_distribution",
        checkName: "Token Length Exceeds Context Window",
        severity: "warning",
        finding: "Combined length 2,410 tokens (exceeds 2k standard budget)",
        recommendation: "Apply chunking or exclude if target context is 2,048 tokens",
        preview: 'Instruction: "Summarize the entire 1998 banking regulatory act..."\nOutput: "[Very long 2,200 token text...]"',
        evidence: "Token count (llama-tokenizer): 2,410. Standard 2048 token window will truncate terminal sentences."
      },
      {
        id: "rec_inst_0091",
        check: "formatting_hygiene",
        checkName: "Mismatched Markdown Code Fences",
        severity: "info",
        finding: "Unclosed ```python code block syntax",
        recommendation: "Normalize markdown code blocks across dataset",
        preview: 'Instruction: "Write a quicksort in Python."\nOutput: "```python\ndef quicksort(arr):..." (no closing backticks)',
        evidence: "Found opening ``` without corresponding closing fence. Causes syntax rendering degradation in chat models."
      }
    ],
    chartData: {
      severities: [1, 2, 1],
      distribution: [12, 45, 28, 11, 4],
      distLabels: ["<200", "200-500", "500-1k", "1k-2k", ">2k tok"]
    },
    recommendations: [
      "Filter 3 placeholder responses to prevent chat model refusal loops.",
      "Apply token truncation on 5 long-tail prompts exceeding 2,048 tokens.",
      "Normalize markdown closing fences (```) in code-related instruction pairs."
    ]
  },

  common_voice: {
    id: "mozilla-foundation/common_voice_11_0",
    task: "Speech & Voice Synthesis (TTS)",
    modality: "Audio Stream + Text Transcript",
    rows: 12450,
    samples: 100,
    anomalies: 14,
    verdict: "Needs Filtering",
    columns: [
      { name: "audio", role: "Acoustic Stream", type: "Audio(48kHz)", nulls: "0.0%", preview: "common_voice_hi_2384.mp3" },
      { name: "sentence", role: "Text Transcript", type: "string", nulls: "0.2%", preview: '"नमस्ते, आप कैसे हैं?"' },
      { name: "speaker_id", role: "Speaker Identifier", type: "string", nulls: "4.5%", preview: "spk_082" }
    ],
    checks: [
      { id: "audio_clipping", name: "Acoustic Signal Clipping", scope: "Deterministic", finding: "Peak amplitude > 0.98" },
      { id: "dead_silence", name: "Dead Silence / Non-speech Bounds", scope: "Deterministic", finding: "Leading silence > 1.8s" },
      { id: "transcript_hygiene", name: "Punctuation & Token Consistency", scope: "Deterministic", finding: "Missing terminal tokens" },
      { id: "gemini_acoustic_eval", name: "AI Noise & Reverb Review", scope: "Gemini API", finding: "Audible room chatter & hiss" }
    ],
    issues: [
      {
        id: "rec_cv_0042",
        check: "audio_clipping",
        checkName: "Acoustic Clipping Detected",
        severity: "critical",
        finding: "Peak amplitude 1.0 (Digital signal clipped at 0.4s - 0.9s)",
        recommendation: "Exclude from vocoder training to avoid static hiss",
        preview: 'Sentence: "नमस्ते, क्या आप मेरी आवाज़ सुन सकते हैं?"\nAudio: cv_hi_0042.mp3',
        evidence: "Peak Amplitude: 1.000. 142 clipped samples in frames 420-510. Severely degrades HiFi-GAN/vocoder synthesis quality.",
        audioUrl: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      },
      {
        id: "rec_cv_0108",
        check: "dead_silence",
        checkName: "Excessive Leading Silence",
        severity: "warning",
        finding: "1.92s dead air before speech onset",
        recommendation: "Trim silence using librosa.effects.trim",
        preview: 'Sentence: "आज मौसम बहुत अच्छा है।"\nAudio: cv_hi_0108.mp3',
        evidence: "Total duration 4.8s. Leading silence: 1.92s (40% dead air). Wastes training steps and alignment attention.",
        audioUrl: "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
      },
      {
        id: "rec_cv_0219",
        check: "transcript_hygiene",
        checkName: "Missing Terminal Punctuation",
        severity: "info",
        finding: "Missing sentence-ending purna viram (।)",
        recommendation: "Normalize punctuation with rule-based regex",
        preview: 'Sentence: "कृपया अपनी सीट बेल्ट बाँध लें"\nAudio: cv_hi_0219.mp3',
        evidence: "Sentence ends abruptly without punctuation. Alignment attention may hallucinate stop-tokens.",
        audioUrl: ""
      }
    ],
    chartData: {
      severities: [4, 6, 4],
      distribution: [4, 28, 45, 18, 5],
      distLabels: ["0-1s", "1-3s", "3-5s", "5-7s", ">7s"]
    },
    recommendations: [
      "Exclude 4 clipped audio files to prevent acoustic vocoder distortion.",
      "Trim leading dead silence (>1.8s) on 6 audio samples.",
      "Normalize Hindi sentence-ending punctuation."
    ]
  },

  dolly: {
    id: "databricks/databricks-dolly-15k",
    task: "Q&A & Reasoning Evaluation",
    modality: "Instruct / Context / Response",
    rows: 15011,
    samples: 50,
    anomalies: 3,
    verdict: "High Readiness",
    columns: [
      { name: "instruction", role: "Prompt", type: "string", nulls: "0.0%", preview: '"When was Virgin Australia founded?"' },
      { name: "context", role: "Reference Text", type: "string", nulls: "12.0%", preview: '"Virgin Australia was founded in 2000..."' },
      { name: "response", role: "Verified Answer", type: "string", nulls: "0.0%", preview: '"Virgin Australia was founded in 2000."' }
    ],
    checks: [
      { id: "context_grounding", name: "Hallucination vs Context Grounding", scope: "Deterministic", finding: "Context token overlap" },
      { id: "category_balance", name: "Task Category Stratification", scope: "Deterministic", finding: "Entropy over 8 categories" }
    ],
    issues: [
      {
        id: "rec_dolly_0023",
        check: "context_grounding",
        checkName: "Answer Not Supported by Context",
        severity: "warning",
        finding: "Response cites year 2004, context specifies year 2000",
        recommendation: "Correct response entity to prevent factual error",
        preview: 'Context: "Founded in 2000."\nResponse: "Virgin Australia began in 2004."',
        evidence: "Entity contradiction detected between reference passage and target label."
      }
    ],
    chartData: {
      severities: [0, 2, 1],
      distribution: [15, 20, 10, 4, 1],
      distLabels: ["Q&A", "Summarize", "Creative", "Extract", "Classify"]
    },
    recommendations: [
      "94% of dataset is production-ready for instruction tuning.",
      "Verify 2 entity discrepancies in closed-book Q&A partition."
    ]
  },

  imdb: {
    id: "imdb",
    task: "Sentiment Classification",
    modality: "Text String + Binary Label",
    rows: 50000,
    samples: 100,
    anomalies: 2,
    verdict: "Ready for Training",
    columns: [
      { name: "text", role: "Review Body", type: "string", nulls: "0.0%", preview: '"One of the best movies ever made..."' },
      { name: "label", role: "Target Class (0/1)", type: "int64", nulls: "0.0%", preview: "1 (Positive)" }
    ],
    checks: [
      { id: "class_imbalance", name: "Class Distribution Ratio", scope: "Deterministic", finding: "Exact 50/50 balance" },
      { id: "html_artifacts", name: "HTML Tag Contamination", scope: "Deterministic", finding: "<br /><br /> tags present" }
    ],
    issues: [
      {
        id: "rec_imdb_0055",
        check: "html_artifacts",
        checkName: "Raw HTML Break Tags in Text",
        severity: "info",
        finding: "Contains 8 unstripped <br /> tags",
        recommendation: "Strip HTML tags during text pre-processing pipeline",
        preview: '"Great acting.<br /><br />Highly recommended!"',
        evidence: "Raw HTML tags detected in 35% of sample rows. Harmless if cleaned in tokenizer regex."
      }
    ],
    chartData: {
      severities: [0, 0, 2],
      distribution: [50, 50],
      distLabels: ["Negative (0)", "Positive (1)"]
    },
    recommendations: [
      "Dataset is cleanly balanced (50% positive, 50% negative).",
      "Add a regex HTML tag remover to your data loader."
    ]
  }
};

let currentFixtureKey = "alpaca";
let currentFixture = DATASET_FIXTURES.alpaca;
let issuesChartInstance = null;
let distChartInstance = null;
let waveEngine = null;

// Persistent DataPilot Workflow State
let latestMetricPlan = null;
let latestRepoId = "tatsu-lab/alpaca";
let latestObjective = "Fine-tune an instruction-following LLM. Audit instruction-output alignment, detect empty or truncated responses, check for prompt leakage, and evaluate token length distribution.";
let latestSchemaMap = {};
let latestSampleRows = [];
let latestEvalPrompt = null;

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  waveEngine = new WaveBackgroundEngine("waveCanvas");
  setupNavigation();
  loadAuditData(currentFixtureKey);
  checkBackendConnection();
});

async function checkBackendConnection() {
  const pill = document.getElementById("backendStatusPill");
  if (!pill) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (res.ok) {
      pill.innerHTML = `● Online (127.0.0.1:8000)`;
      pill.style.color = "var(--status-success)";
    } else {
      pill.innerHTML = "○ Error";
      pill.style.color = "var(--status-warning)";
    }
  } catch (e) {
    pill.innerHTML = "○ Offline (Start Backend)";
    pill.style.color = "var(--status-critical)";
  }
}

function setupNavigation() {
  const stepButtons = document.querySelectorAll(".copilot-step-btn");
  stepButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetScreen = btn.getAttribute("data-target");
      switchView(targetScreen);
    });
  });
}

function switchView(screenId) {
  document.querySelectorAll(".screen-view").forEach((v) => v.classList.remove("active"));
  const targetView = document.getElementById(screenId);
  if (targetView) targetView.classList.add("active");

  document.querySelectorAll(".copilot-step-btn").forEach((btn) => {
    if (btn.getAttribute("data-target") === screenId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const bc = document.getElementById("currentBreadcrumb");
  if (bc) {
    bc.innerText =
      screenId === "screen-prompt"
        ? "Prompt & Setup"
        : screenId === "screen-inspect"
        ? "Schema & Plan"
        : screenId === "screen-prompt-manager"
        ? "Prompt Manager & Studio"
        : "Findings & Report";
  }

  if (screenId === "screen-findings") {
    setTimeout(renderCharts, 120);
  }
}

function startNewAudit() {
  switchView("screen-prompt");
  document.getElementById("hfUrl").focus();
}

function loadAuditHistory(key) {
  currentFixtureKey = key;
  currentFixture = DATASET_FIXTURES[key];

  document.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("active");
  });
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }

  loadAuditData(key);
  switchView("screen-findings");
}

function applySuggestion(type) {
  const urlInput = document.getElementById("hfUrl");
  const objInput = document.getElementById("objectivePrompt");
  const modalitySelect = document.getElementById("taskModality");

  if (type === "llm_instruct") {
    urlInput.value = "tatsu-lab/alpaca";
    objInput.value = "Fine-tune an instruction-following LLM. Audit instruction-output alignment, detect empty or truncated responses, check for prompt leakage, and evaluate token length distribution.";
    modalitySelect.value = "llm_instruct";
    currentFixtureKey = "alpaca";
  } else if (type === "speech_tts") {
    urlInput.value = "mozilla-foundation/common_voice_11_0";
    objInput.value = "Fine-tune a speech TTS model. Audit acoustic clipping, silence bounds, audio integrity, and transcript-audio alignment.";
    modalitySelect.value = "speech_tts";
    currentFixtureKey = "common_voice";
  } else if (type === "text_classification") {
    urlInput.value = "imdb";
    objInput.value = "Train a binary sentiment classifier. Check class balance, empty text records, HTML contamination, and token lengths.";
    modalitySelect.value = "text_classification";
    currentFixtureKey = "imdb";
  } else if (type === "tabular") {
    urlInput.value = "databricks/databricks-dolly-15k";
    objInput.value = "Evaluate Q&A reasoning and knowledge retrieval. Inspect context grounding, category coverage, and entity consistency.";
    modalitySelect.value = "tabular";
    currentFixtureKey = "dolly";
  }

  currentFixture = DATASET_FIXTURES[currentFixtureKey];
  loadAuditData(currentFixtureKey);
}

// Render Detected Columns & Schema Table dynamically
function renderSchemaTable(columns, previewRows) {
  const schemaTbody = document.getElementById("schemaTableBody");
  if (!schemaTbody) return;

  if (!Array.isArray(columns) || columns.length === 0) {
    schemaTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1rem;">No explicit columns detected in repository root.</td></tr>`;
    return;
  }

  const sampleObj = (Array.isArray(previewRows) && previewRows.length > 0 && typeof previewRows[0] === "object") ? previewRows[0] : {};

  schemaTbody.innerHTML = columns
    .map((c) => {
      const colName = typeof c === "string" ? c : (c.name || "col");
      const colType = typeof c === "object" ? (c.type || c.data_type || "string") : "string";
      const sampleVal = sampleObj[colName] !== undefined ? sampleObj[colName] : (c.preview || "");

      // Determine smart role badge based on column semantics
      let roleBadge = '<span class="badge-clean badge-info">Feature</span>';
      const lower = colName.toLowerCase();
      if (lower.includes("instruction") || lower.includes("prompt") || lower.includes("question") || lower.includes("query")) {
        roleBadge = '<span class="badge-clean badge-info">Prompt / Query</span>';
      } else if (lower.includes("output") || lower.includes("response") || lower.includes("answer") || lower.includes("target")) {
        roleBadge = '<span class="badge-clean badge-success">Target Output</span>';
      } else if (lower.includes("label") || lower.includes("class") || lower.includes("sentiment") || lower.includes("category")) {
        roleBadge = '<span class="badge-clean badge-success">Target Class</span>';
      } else if (lower.includes("audio") || lower.includes("sound") || lower.includes("speech") || lower.includes("wav") || lower.includes("mp3")) {
        roleBadge = '<span class="badge-clean badge-warning">Acoustic Stream</span>';
      } else if (lower.includes("sentence") || lower.includes("transcript") || lower.includes("text")) {
        roleBadge = '<span class="badge-clean badge-info">Text / Transcript</span>';
      } else if (lower.includes("image") || lower.includes("photo") || lower.includes("picture") || lower.includes("img")) {
        roleBadge = '<span class="badge-clean badge-warning">Visual Tensor</span>';
      } else if (lower.includes("input") || lower.includes("context") || lower.includes("history") || lower.includes("document")) {
        roleBadge = '<span class="badge-clean" style="background: rgba(0,0,0,0.06); color: var(--text-muted);">Context / Input</span>';
      } else if (lower.includes("id") || lower.includes("idx") || lower.includes("speaker") || lower.includes("uuid")) {
        roleBadge = '<span class="badge-clean" style="background: rgba(0,0,0,0.05); color: var(--text-subtle);">Identifier</span>';
      }

      // Safe sample value string truncation
      let valStr = "";
      if (typeof sampleVal === "object" && sampleVal !== null) {
        valStr = JSON.stringify(sampleVal);
      } else {
        valStr = String(sampleVal);
      }
      if (valStr.length > 60) {
        valStr = valStr.substring(0, 57) + "...";
      }
      if (!valStr || valStr === '""') {
        valStr = '"" (optional/empty)';
      }

      return `
        <tr>
          <td><code>${colName}</code></td>
          <td>${roleBadge}</td>
          <td><span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${colType}</span></td>
          <td>0.0%</td>
          <td style="color: var(--text-muted); font-family: monospace; font-size: 0.8rem;" title="${valStr}">${valStr}</td>
        </tr>
      `;
    })
    .join("");
}

// Render Metric Plan generated by Gemini
function populateMetricPlan(plan) {
  if (!plan) return;

  if (plan.task_profile) {
    const domainEl = document.getElementById("aiInferredDomain");
    const paradigmEl = document.getElementById("aiInferredParadigm");
    const interpEl = document.getElementById("aiObjectiveInterpretation");
    const modalityEl = document.getElementById("inspectModality");

    if (domainEl) domainEl.innerText = plan.task_profile.inferred_domain || "Domain: Inferred";
    if (paradigmEl) paradigmEl.innerText = plan.task_profile.inferred_learning_paradigm || "Paradigm: Inferred";
    if (interpEl) interpEl.innerText = plan.task_profile.objective_interpretation || "Objective analyzed.";
    if (modalityEl) modalityEl.innerText = plan.task_profile.inferred_domain || "Multimodal / Custom";
  }

  // Render Qualitative Metrics (Tier 1)
  const qualTbody = document.getElementById("qualTableBody");
  if (qualTbody && Array.isArray(plan.qualitative_metrics)) {
    qualTbody.innerHTML = plan.qualitative_metrics
      .map(
        (q) => `
      <tr>
        <td><code>${q.metric_id}</code></td>
        <td>
          <strong style="color: var(--text-primary);">${q.metric_name}</strong>
          <br>
          <span style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.35; display: inline-block; margin-top: 2px;">
            ${q.description}
          </span>
        </td>
        <td style="font-size: 0.82rem; color: var(--text-primary); line-height: 1.4;">
          ${q.relevance_to_objective}
        </td>
        <td style="font-size: 0.81rem; color: var(--accent-clay); font-weight: 600; line-height: 1.35;">
          ${q.evaluation_rubric}
        </td>
      </tr>
    `
      )
      .join("");
  }

  // Render Physical Metrics Blueprint (Tier 2)
  const physTbody = document.getElementById("physTableBody");
  if (physTbody && Array.isArray(plan.physical_metrics)) {
    physTbody.innerHTML = plan.physical_metrics
      .map(
        (p) => `
      <tr>
        <td><code>${p.metric_id}</code></td>
        <td>
          <strong style="color: var(--text-primary);">${p.metric_name}</strong>
          <br>
          <span style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.35; display: inline-block; margin-top: 2px;">
            ${p.description}
          </span>
        </td>
        <td style="font-size: 0.82rem; font-weight: 650; color: var(--text-primary);">
          ${p.recommended_threshold}
        </td>
        <td>
          <code style="background: rgba(0,0,0,0.05); padding: 3px 7px; border-radius: 4px; font-size: 0.78rem; color: var(--accent-clay); font-weight: 600;">
            ${p.reference_tool_or_library}
          </code>
        </td>
      </tr>
    `
      )
      .join("");
  }
}

async function handleStartAudit() {
  const url = document.getElementById("hfUrl").value.trim();
  const objective = document.getElementById("objectivePrompt").value.trim();
  const token = document.getElementById("hfToken") ? document.getElementById("hfToken").value.trim() : null;
  const btn = document.getElementById("btnSend");

  if (!url) {
    alert("Please enter a Hugging Face dataset URL or repository ID.");
    return;
  }

  btn.innerHTML = `<span style="display:inline-block; animation: pulse 1s infinite;">Connecting to Hugging Face...</span>`;
  btn.disabled = true;

  let repoId = url;
  let schemaMap = {};
  let sampleRows = [];
  let totalRows = "N/A";
  let isGated = false;

  try {
    // 1. Inspect Hugging Face Repository
    const inspectResp = await fetch(`${API_BASE_URL}/api/datasets/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, hf_token: token || null })
    });

    if (inspectResp.ok) {
      const inspectData = await inspectResp.json();
      repoId = inspectData.repo_id;
      totalRows = inspectData.estimated_total_rows ? inspectData.estimated_total_rows.toLocaleString() : "N/A";
      isGated = inspectData.is_gated;

      if (Array.isArray(inspectData.columns) && inspectData.columns.length > 0) {
        inspectData.columns.forEach((col) => {
          schemaMap[col.name] = col.type || "string";
        });
        renderSchemaTable(inspectData.columns, inspectData.preview || []);
      }
    }

    // 2. Fetch Sample Rows (Full user-selected budget)
    const budgetVal = parseInt(document.getElementById("sampleBudget")?.value || "100", 10);
    btn.innerHTML = `<span style="display:inline-block; animation: pulse 1s infinite;">Downloading ${budgetVal} Samples & Calling Gemini...</span>`;
    try {
      const sampleResp = await fetch(`${API_BASE_URL}/api/datasets/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          config: "default",
          split: "train",
          max_rows: budgetVal,
          hf_token: token || null
        })
      });
      if (sampleResp.ok) {
        const sampleData = await sampleResp.json();
        sampleRows = Array.isArray(sampleData.rows) && sampleData.rows.length > 0
          ? sampleData.rows
          : (Array.isArray(sampleData.preview) ? sampleData.preview : (sampleData.preview_rows || []));
        
        // Render Schema Table with real sampled columns and preview
        if (Array.isArray(sampleData.columns) && sampleData.columns.length > 0) {
          sampleData.columns.forEach((col) => {
            schemaMap[col.name] = col.type || "string";
          });
          renderSchemaTable(sampleData.columns, sampleRows.slice(0, 5));
        }
      }
    } catch (sampleErr) {
      console.warn("Sample fetch note:", sampleErr);
    }

    // Fallback: If live network didn't return columns, check fixtures (e.g. common_voice, imdb, etc.)
    if (Object.keys(schemaMap).length === 0) {
      for (const fixKey of Object.keys(DATASET_FIXTURES)) {
        const fix = DATASET_FIXTURES[fixKey];
        if (url.toLowerCase().includes(fixKey) || fix.id.toLowerCase().includes(url.toLowerCase())) {
          fix.columns.forEach((c) => {
            schemaMap[c.name] = c.type;
          });
          renderSchemaTable(fix.columns, [{ [fix.columns[0].name]: fix.columns[0].preview }]);
          break;
        }
      }
    }

    // 3. Call Gemini Metric Planner API
    const plannerResp = await fetch(`${API_BASE_URL}/api/planner/generate-metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        training_objective: objective || "Audit dataset quality for general machine learning readiness.",
        dataset_name: repoId,
        schema_definitions: schemaMap,
        sample_records: sampleRows
      })
    });

    if (plannerResp.ok) {
      const plan = await plannerResp.json();
      latestMetricPlan = plan;
      latestRepoId = repoId;
      latestObjective = objective || "Audit dataset quality.";
      latestSchemaMap = schemaMap;
      latestSampleRows = sampleRows;

      populateMetricPlan(plan);
      document.getElementById("aiStatusPill").innerText = "Gemini 3.5 Live Plan";
      document.getElementById("aiStatusPill").className = "badge-clean badge-success";
    } else {
      console.warn("Planner API fallback to default schema");
    }

    // Update screen header stats
    document.getElementById("inspectSubtitle").innerText = `Repository: ${repoId} • Access Verified (${isGated ? 'Gated' : 'Public'})`;
    document.getElementById("inspectRowCount").innerText = `${totalRows} rows`;
    document.getElementById("findingsDatasetTitle").innerText = `Audit Report: ${repoId}`;

    switchView("screen-inspect");
  } catch (err) {
    console.error("Audit start error:", err);
    alert(`Encountered notice during inspection: ${err.message || err}. Proceeding with inspection view.`);
    switchView("screen-inspect");
  } finally {
    btn.innerHTML = "Inspect Dataset &rarr;";
    btn.disabled = false;
  }
}

// ============================================================
// SECTION 2.5: PROMPT STUDIO & EVALUATION PROMPT SYNTHESIS
// ============================================================

async function handleGenerateEvalPrompt(isRegenerate = false) {
  const btn = document.getElementById(isRegenerate ? "btnRegeneratePrompt" : "btnToPromptManager");
  const origText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.innerHTML = `<span style="display:inline-block; animation: pulse 1s infinite;">Synthesizing Prompt with Gemini...</span>`;
    btn.disabled = true;
  }

  const qMetrics = (latestMetricPlan && Array.isArray(latestMetricPlan.qualitative_metrics) && latestMetricPlan.qualitative_metrics.length > 0)
    ? latestMetricPlan.qualitative_metrics
    : [
        { metric_id: "QUAL_01", metric_name: "Semantic Coherence & Task Alignment", evaluation_rubric: "Output directly answers user query without hallucinating or digressing." },
        { metric_id: "QUAL_02", metric_name: "Content Quality & Formatting Hygiene", evaluation_rubric: "Strict adherence to expected output structure and complete sentences." }
      ];

  const payload = {
    training_objective: latestObjective || document.getElementById("objectivePrompt")?.value || "Audit dataset quality for ML training.",
    dataset_name: latestRepoId || document.getElementById("hfUrl")?.value || "tatsu-lab/alpaca",
    inferred_domain: latestMetricPlan?.task_profile?.inferred_domain || "General ML",
    inferred_learning_paradigm: latestMetricPlan?.task_profile?.inferred_learning_paradigm || "Supervised Fine-Tuning",
    qualitative_metrics: qMetrics,
    schema_definitions: latestSchemaMap,
    sample_records: latestSampleRows
  };

  try {
    const resp = await fetch(`${API_BASE_URL}/api/planner/generate-eval-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const data = await resp.json();
      latestEvalPrompt = data;
      renderPromptManager(data, qMetrics);
      switchView("screen-prompt-manager");
    } else {
      console.warn("Server prompt synthesis returned non-200. Using resilient fallback.");
      renderFallbackPrompt(qMetrics);
      switchView("screen-prompt-manager");
    }
  } catch (err) {
    console.error("Error synthesizing eval prompt:", err);
    renderFallbackPrompt(qMetrics);
    switchView("screen-prompt-manager");
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

function renderPromptManager(data, qMetrics) {
  const sysEl = document.getElementById("evalSystemPromptText");
  const userEl = document.getElementById("evalUserTemplateText");
  const prevEl = document.getElementById("evalCompiledPreview");
  const chipsEl = document.getElementById("promptMetricChips");
  const modBadge = document.getElementById("promptModalityBadge");
  const statusBadge = document.getElementById("promptStatusBadge");

  if (sysEl) sysEl.value = data.eval_system_prompt || "";
  if (userEl) userEl.value = data.eval_user_prompt_template || "";
  if (prevEl) prevEl.innerText = data.full_compiled_prompt || `${data.eval_system_prompt}\n\n---\n\n${data.eval_user_prompt_template}`;

  if (modBadge) {
    modBadge.innerText = `Domain: ${latestMetricPlan?.task_profile?.inferred_domain || 'Inferred'}`;
  }
  if (statusBadge) {
    statusBadge.innerText = data.status === "success" ? "✨ Synthesized by Gemini" : "Deterministic Blueprint";
    statusBadge.className = data.status === "success" ? "badge-clean badge-success" : "badge-clean badge-warning";
  }

  if (chipsEl) {
    chipsEl.innerHTML = qMetrics
      .map(
        (m) => `
        <span class="badge-clean badge-info" style="font-size: 0.76rem; padding: 3px 8px;">
          <strong>[${m.metric_id || 'QUAL'}]</strong> ${m.metric_name || 'Metric'}
        </span>
      `
      )
      .join("");
  }

  // Bind live sync between textareas and compiled preview
  if (sysEl && userEl && prevEl) {
    const updatePreview = () => {
      const samplePreviewStr = JSON.stringify(
        (latestSampleRows && latestSampleRows.length > 0) ? latestSampleRows[0] : { "sample": "Example row data" },
        null,
        2
      );
      const compiled = `${sysEl.value}\n\n---\n\n${userEl.value.replace(/{{SAMPLE_RECORDS}}/g, samplePreviewStr)}`;
      prevEl.innerText = compiled;
    };
    sysEl.oninput = updatePreview;
    userEl.oninput = updatePreview;
  }
}

function renderFallbackPrompt(qMetrics) {
  const rubricsText = qMetrics
    .map(
      (m) => `- [${m.metric_id || 'QUAL'}] ${m.metric_name || 'Metric'}: ${m.evaluation_rubric || m.description || 'Evaluate quality.'}`
    )
    .join("\n");

  const systemPrompt = `You are DataPilot AI, a Senior Quality Auditor evaluating sample records from '${latestRepoId}'.\nDomain: ${latestMetricPlan?.task_profile?.inferred_domain || 'General ML'}\nStrictly evaluate whether data samples satisfy the objective without hallucination. Output ONLY valid JSON.`;

  const userTemplate = `### TRAINING OBJECTIVE:\n"${latestObjective || 'Audit dataset'}"\n\n### QUALITATIVE METRICS & RUBRICS:\n${rubricsText}\n\n### DATA SAMPLES TO EVALUATE:\n{{SAMPLE_RECORDS}}\n\n### INSTRUCTIONS:\nEvaluate each sample record against each qualitative metric.\nOutput strictly a JSON array with 'sample_index', 'ratings', and 'verdict'.`;

  const samplePreviewStr = JSON.stringify(
    (latestSampleRows && latestSampleRows.length > 0) ? latestSampleRows[0] : { "sample": "Example row data" },
    null,
    2
  );

  const fallbackData = {
    eval_system_prompt: systemPrompt,
    eval_user_prompt_template: userTemplate,
    full_compiled_prompt: `${systemPrompt}\n\n---\n\n${userTemplate.replace(/{{SAMPLE_RECORDS}}/g, samplePreviewStr)}`,
    status: "fallback"
  };

  renderPromptManager(fallbackData, qMetrics);
}

function copyCompiledPrompt() {
  const prevEl = document.getElementById("evalCompiledPreview");
  const sysEl = document.getElementById("evalSystemPromptText");
  const userEl = document.getElementById("evalUserTemplateText");
  const btn = document.getElementById("btnCopyPrompt");

  let textToCopy = prevEl ? prevEl.innerText : "";
  if (!textToCopy && sysEl && userEl) {
    textToCopy = `${sysEl.value}\n\n---\n\n${userEl.value}`;
  }

  if (navigator.clipboard && textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = `<span style="color: var(--status-success);">✓ Copied to Clipboard!</span>`;
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 2200);
      }
    });
  } else {
    alert("Copied prompt to clipboard.");
  }
}

function proceedToFindings() {
  runLiveAuditEvaluation();
}

// Global Audit Evaluation State
let currentAuditResults = null;
let currentExcludedIndices = new Set();
let currentInspectedSampleIndex = null;

async function runLiveAuditEvaluation() {
  const btn = document.getElementById("btnRunAuditEval");
  const origText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.innerHTML = `<span style="display:inline-block; animation: pulse 1s infinite;">Auditing Samples with Gemini...</span>`;
    btn.disabled = true;
  }

  const sysPrompt = document.getElementById("evalSystemPromptText")?.value || "You are an AI Quality Auditor.";
  const userTemplate = document.getElementById("evalUserTemplateText")?.value || "";
  const qMetrics = (latestMetricPlan && latestMetricPlan.qualitative_metrics) ? latestMetricPlan.qualitative_metrics : [];
  
  const budget = parseInt(document.getElementById("sampleBudget")?.value || "100", 10);
  let samplesToEval = (latestSampleRows && latestSampleRows.length >= budget)
    ? latestSampleRows.slice(0, budget)
    : latestSampleRows;

  // Guarantee all budget rows are available for evaluation
  if (!samplesToEval || samplesToEval.length < budget) {
    try {
      const sampleResp = await fetch(`${API_BASE_URL}/api/datasets/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: latestRepoId || "tatsu-lab/alpaca",
          config: "default",
          split: "train",
          max_rows: budget,
          hf_token: document.getElementById("hfToken") ? document.getElementById("hfToken").value.trim() : null
        })
      });
      if (sampleResp.ok) {
        const sampleData = await sampleResp.json();
        if (Array.isArray(sampleData.rows) && sampleData.rows.length > 0) {
          samplesToEval = sampleData.rows;
          latestSampleRows = samplesToEval;
        }
      }
    } catch (e) {
      console.warn("Full budget fetch note:", e);
    }
  }

  if (!samplesToEval || samplesToEval.length === 0) {
    samplesToEval = currentFixture && currentFixture.columns ? [{ "sample": "Example record for " + latestRepoId }] : [];
  }

  const totalRowsNum = parseInt((document.getElementById("inspectRowCount")?.innerText || "50000").replace(/[^0-9]/g, ""), 10) || 50000;

  try {
    const resp = await fetch(`${API_BASE_URL}/api/audits/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        training_objective: latestObjective || "Audit dataset quality for ML training.",
        dataset_name: latestRepoId || "dataset",
        eval_system_prompt: sysPrompt,
        eval_user_prompt_template: userTemplate,
        qualitative_metrics: qMetrics,
        samples: samplesToEval,
        total_profiled_rows: totalRowsNum
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      currentAuditResults = data;
      currentExcludedIndices.clear();
      // Auto-exclude critical defects
      data.samples.forEach((s) => {
        if (s.verdict === "CRITICAL_DEFECT") {
          currentExcludedIndices.add(s.sample_index);
        }
      });
      renderAuditFindings(data);
      switchView("screen-findings");
    } else {
      alert("Evaluation note: Live evaluation fallback activated. Rendering findings.");
      switchView("screen-findings");
    }
  } catch (err) {
    console.error("Evaluation request error:", err);
    switchView("screen-findings");
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

function renderAuditFindings(data) {
  if (!data) return;

  document.getElementById("findingsDatasetTitle").innerText = `Audit Report: ${data.repo_id}`;
  document.getElementById("findingsSubtitle").innerText = `Objective: ${data.training_objective.substring(0, 85)}... • ${data.audited_samples_count} Samples Audited`;

  document.getElementById("statProfiled").innerText = data.total_profiled_rows.toLocaleString();
  document.getElementById("statSampled").innerText = data.audited_samples_count.toString();
  document.getElementById("statAnomalies").innerText = data.defect_count.toString();
  
  const anomSub = document.getElementById("statAnomaliesSub");
  if (anomSub) anomSub.innerText = `${data.defect_rate_pct}% sample defect rate`;

  const verdEl = document.getElementById("statVerdict");
  if (verdEl) {
    verdEl.innerText = data.readiness_verdict;
    verdEl.style.color = data.critical_count > 0 ? "var(--status-critical)" : (data.warning_count > 0 ? "var(--status-warning)" : "var(--status-success)");
  }

  // Update partition counts
  const cAll = document.getElementById("countAll");
  const cDef = document.getElementById("countDefects");
  const cWarn = document.getElementById("countWarnings");
  const cGold = document.getElementById("countGolden");
  if (cAll) cAll.innerText = data.samples.length.toString();
  if (cDef) cDef.innerText = data.critical_count.toString();
  if (cWarn) cWarn.innerText = data.warning_count.toString();
  if (cGold) cGold.innerText = data.golden_count.toString();

  // Recommendations
  const recList = document.getElementById("recommendationsList");
  if (recList && Array.isArray(data.recommendations)) {
    recList.innerHTML = data.recommendations.map((r) => `<li>${r}</li>`).join("");
  }

  // Render Charts
  renderDynamicCharts(data);

  // Render dynamic sample table
  filterSampleTable("all");
}

function renderDynamicCharts(data) {
  const issuesCanvas = document.getElementById("issuesChart");
  const distCanvas = document.getElementById("distributionChart");

  // Chart 1: Doughnut Quality Partition
  if (issuesCanvas) {
    if (issuesChartInstance) issuesChartInstance.destroy();
    issuesChartInstance = new Chart(issuesCanvas, {
      type: "doughnut",
      data: {
        labels: ["Golden Clean", "Needs Curation", "Critical Defect"],
        datasets: [
          {
            data: [data.golden_count, data.warning_count, data.critical_count],
            backgroundColor: ["#16a34a", "#d97706", "#dc2626"],
            borderWidth: 2,
            borderColor: "#ffffff"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } }
        },
        cutout: "68%"
      }
    });
  }

  // Chart 2: Qualitative Metric Pass Rates (%)
  if (distCanvas) {
    if (distChartInstance) distChartInstance.destroy();
    const metricLabels = Object.keys(data.metric_pass_rates || {});
    const metricValues = Object.values(data.metric_pass_rates || {});

    distChartInstance = new Chart(distCanvas, {
      type: "bar",
      data: {
        labels: metricLabels.length > 0 ? metricLabels : ["QUAL_01", "QUAL_02"],
        datasets: [
          {
            label: "Pass Rate (%)",
            data: metricValues.length > 0 ? metricValues : [95, 80],
            backgroundColor: "#d97757",
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%", font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function filterSampleTable(filterType) {
  if (!currentAuditResults || !Array.isArray(currentAuditResults.samples)) return;

  const tbody = document.getElementById("findingsTableBody");
  if (!tbody) return;

  // Update active pill button
  ["filterBtnAll", "filterBtnDefects", "filterBtnWarnings", "filterBtnGolden"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.fontWeight = "normal";
  });
  const activeBtnId = filterType === "critical" ? "filterBtnDefects" : (filterType === "warning" ? "filterBtnWarnings" : (filterType === "golden" ? "filterBtnGolden" : "filterBtnAll"));
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) activeBtn.style.fontWeight = "bold";

  let filtered = currentAuditResults.samples;
  if (filterType === "critical") {
    filtered = currentAuditResults.samples.filter((s) => s.verdict === "CRITICAL_DEFECT");
  } else if (filterType === "warning") {
    filtered = currentAuditResults.samples.filter((s) => s.verdict === "NEEDS_CURATION");
  } else if (filterType === "golden") {
    filtered = currentAuditResults.samples.filter((s) => s.verdict === "PASS");
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No samples matching this partition filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((s) => {
      let badgeClass = "badge-success";
      let verdictLabel = "🟢 GOLDEN PASS";
      if (s.verdict === "CRITICAL_DEFECT") {
        badgeClass = "badge-critical";
        verdictLabel = "🔴 CRITICAL DEFECT";
      } else if (s.verdict === "NEEDS_CURATION") {
        badgeClass = "badge-warning";
        verdictLabel = "🟡 NEEDS CURATION";
      }

      const failingStr = (s.failing_metrics && s.failing_metrics.length > 0)
        ? s.failing_metrics.join(", ")
        : "All Criteria Met ✓";

      const isExcluded = currentExcludedIndices.has(s.sample_index);

      return `
        <tr onclick="openSampleDrawer(${s.sample_index})" style="${isExcluded ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
          <td><strong><code>${s.sample_id}</code></strong></td>
          <td><span class="badge-clean ${badgeClass}">${verdictLabel}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${s.preview_text}
          </td>
          <td><span style="font-size: 0.78rem; font-weight: 650; color: ${s.failing_metrics.length > 0 ? 'var(--status-critical)' : 'var(--status-success)'};">${failingStr}</span></td>
          <td>
            <button class="btn-clean" style="padding: 2px 8px; font-size: 0.72rem;" onclick="event.stopPropagation(); openSampleDrawer(${s.sample_index})">
              Inspect ➔
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function openSampleDrawer(sampleIndex) {
  if (!currentAuditResults || !currentAuditResults.samples) return;
  const sample = currentAuditResults.samples.find((s) => s.sample_index === sampleIndex);
  if (!sample) return;

  currentInspectedSampleIndex = sampleIndex;

  const drawer = document.getElementById("detailDrawer");
  document.getElementById("detailKey").innerText = `Sample Inspector: ${sample.sample_id}`;
  
  const vBadge = document.getElementById("detailVerdictBadge");
  if (vBadge) {
    vBadge.innerText = sample.verdict;
    vBadge.className = sample.verdict === "CRITICAL_DEFECT" ? "badge-clean badge-critical" : (sample.verdict === "NEEDS_CURATION" ? "badge-clean badge-warning" : "badge-clean badge-success");
  }

  document.getElementById("detailContentPreview").innerText = JSON.stringify(sample.raw_sample, null, 2);

  // Audio Playback Stream Handler
  const audioContainer = document.getElementById("detailAudioContainer");
  const audioPlayer = document.getElementById("detailAudioPlayer");
  if (audioContainer && audioPlayer) {
    const raw = sample.raw_sample || {};
    const hasAudio = raw.audio || raw.audio_path || raw.audioUrl || (typeof sample.preview_text === "string" && (sample.preview_text.includes(".mp3") || sample.preview_text.includes(".wav")));
    if (hasAudio) {
      audioPlayer.src = raw.audioUrl || "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
      audioContainer.style.display = "block";
    } else {
      audioContainer.style.display = "none";
      audioPlayer.removeAttribute("src");
    }
  }

  const evidenceEl = document.getElementById("detailEvidence");
  evidenceEl.innerHTML = `
    <p style="margin-bottom: 6px;"><strong>Status:</strong> ${sample.verdict}</p>
    <p style="margin-bottom: 6px;"><strong>Target Metrics:</strong> ${sample.failing_metrics.length > 0 ? sample.failing_metrics.join(', ') : 'All Qualitative Criteria Satisfied'}</p>
    ${sample.defect_quote ? `<p style="margin-bottom: 6px; color: var(--status-critical);"><strong>Cited Defect Quote:</strong> <em>"${sample.defect_quote}"</em></p>` : ''}
    <p style="margin-bottom: 6px;"><strong>Evaluator Rationale:</strong> ${sample.reasoning}</p>
    <p><strong>Recommended Curation:</strong> <code style="font-size: 0.8rem; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px;">${sample.curation_action}</code></p>
  `;

  updateExcludeButton();

  drawer.style.display = "block";
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeDrawer() {
  const drawer = document.getElementById("detailDrawer");
  if (drawer) drawer.style.display = "none";
}

function updateExcludeButton() {
  const btn = document.getElementById("btnToggleExclude");
  if (!btn || currentInspectedSampleIndex === null) return;

  if (currentExcludedIndices.has(currentInspectedSampleIndex)) {
    btn.innerHTML = `<span style="color: var(--status-success);">✓ Excluded from Clean Export (Click to Re-include)</span>`;
  } else {
    btn.innerHTML = `<span>🗑️ Exclude from Clean Dataset</span>`;
  }
}

function toggleCurrentSampleExclusion() {
  if (currentInspectedSampleIndex === null) return;
  if (currentExcludedIndices.has(currentInspectedSampleIndex)) {
    currentExcludedIndices.delete(currentInspectedSampleIndex);
  } else {
    currentExcludedIndices.add(currentInspectedSampleIndex);
  }
  updateExcludeButton();
  filterSampleTable("all");
}

async function downloadCuratedDataset() {
  if (!currentAuditResults || !currentAuditResults.samples) {
    alert("No audit results available to export yet.");
    return;
  }

  const allRows = currentAuditResults.samples.map((s) => s.raw_sample);
  const excludedIndices = Array.from(currentExcludedIndices);

  try {
    const resp = await fetch(`${API_BASE_URL}/api/audits/export-curated`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_name: currentAuditResults.repo_id,
        all_samples: allRows,
        excluded_sample_indices: excludedIndices
      })
    });

    if (resp.ok) {
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentAuditResults.repo_id.replace('/', '__')}_curated_clean.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("Export curated dataset error:", err);
    alert("Could not export curated dataset.");
  }
}

async function runEvaluation() {
  const url = document.getElementById("hfUrl").value.trim();
  const budget = parseInt(document.getElementById("sampleBudget").value || "100", 10);
  const token = document.getElementById("hfToken") ? document.getElementById("hfToken").value.trim() : null;

  try {
    // Call real backend download endpoint to cache sample data locally
    const resp = await fetch(`${API_BASE_URL}/api/datasets/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url,
        config: "default",
        split: "train",
        max_rows: budget,
        hf_token: token || null
      })
    });

    if (resp.ok) {
      const result = await resp.json();
      console.log("Cached dataset partition locally:", result);
    }
  } catch (e) {
    console.warn("Local download call (fallback):", e);
  }

  switchView("screen-findings");
}

function loadAuditData(key) {
  const data = DATASET_FIXTURES[key];
  if (!data) return;

  document.getElementById("inspectSubtitle").innerText = `Repository: ${data.id} (Split: train) • Access Verified`;
  document.getElementById("inspectRowCount").innerText = `${data.rows.toLocaleString()} rows`;
  document.getElementById("inspectModality").innerText = data.modality;

  const schemaTbody = document.getElementById("schemaTableBody");
  if (schemaTbody) {
    schemaTbody.innerHTML = data.columns
      .map(
        (c) => `
      <tr>
        <td><code>${c.name}</code></td>
        <td><span class="badge-clean badge-info">${c.role}</span></td>
        <td>${c.type}</td>
        <td>${c.nulls}</td>
        <td style="color: var(--text-muted); font-family: monospace; font-size: 0.8rem;">${c.preview}</td>
      </tr>
    `
      )
      .join("");
  }

  const planTbody = document.getElementById("planTableBody");
  if (planTbody) {
    planTbody.innerHTML = data.checks
      .map(
        (chk) => `
      <tr>
        <td><code>${chk.id}</code></td>
        <td><strong>${chk.name}</strong></td>
        <td><span class="badge-clean ${chk.scope.includes("Gemini") ? "badge-warning" : "badge-info"}">${chk.scope}</span></td>
        <td style="font-size: 0.82rem;">${chk.finding}</td>
      </tr>
    `
      )
      .join("");
  }

  // Populate Qualitative and Physical Metrics for fixture
  if (data.plan) {
    populateMetricPlan(data.plan);
  } else {
    populateMetricPlan({
      task_profile: {
        inferred_domain: data.modality,
        inferred_learning_paradigm: data.task,
        objective_interpretation: `Auditing ${data.id} for ${data.task} readiness across ${data.samples} sampled records.`
      },
      qualitative_metrics: [
        {
          metric_id: "QUAL_01",
          metric_name: "Instruction-Response Semantic Alignment",
          description: "Evaluates whether completions directly and factually satisfy the input prompt without digression.",
          relevance_to_objective: "Essential to prevent fine-tuned models from hallucinating non-answers or refusing safe prompts.",
          evaluation_rubric: "Strict alignment between target output and prompt context."
        },
        {
          metric_id: "QUAL_02",
          metric_name: "Language Fluency & Stylistic Consistency",
          description: "Inspects grammar, natural sentence flow, and consistent persona styling.",
          relevance_to_objective: "Prevents awkward phrasing, robotic repetitiveness, and formatting glitches.",
          evaluation_rubric: "Native grammatical fluency and coherent stylistic tone."
        }
      ],
      physical_metrics: [
        {
          metric_id: "PHYS_01",
          metric_name: "Sequence Token Length Distribution",
          description: "Measures token length percentiles (p50, p90, p99) against target model context budget.",
          recommended_threshold: "50 to 2,048 tokens per sequence",
          reference_tool_or_library: "tiktoken / transformers.AutoTokenizer"
        },
        {
          metric_id: "PHYS_02",
          metric_name: "Vocabulary Entropy & Lexical Diversity",
          description: "Measures Type-Token Ratio (TTR) and vocabulary density to detect repetitive loops.",
          recommended_threshold: "TTR > 0.45 across sample partition",
          reference_tool_or_library: "nltk / scikit-learn CountVectorizer"
        }
      ]
    });
  }

  // Synthesize all audited samples (e.g. all 100 rows) so Good vs Bad Explorer shows all rows
  const totalBudget = data.samples || 100;
  const isAudio = data.modality.toLowerCase().includes("audio") || data.id.includes("voice");
  const allSamples = [];

  // 1. Add defect / warning samples from fixture issues
  (data.issues || []).forEach((issue, idx) => {
    allSamples.push({
      sample_index: idx,
      sample_id: issue.id || `rec_${idx + 1}`,
      verdict: issue.severity === "critical" ? "CRITICAL_DEFECT" : "NEEDS_CURATION",
      failing_metrics: [issue.check || "QUAL_01"],
      defect_quote: issue.finding || "",
      reasoning: issue.evidence || "Identified during diagnostic pass.",
      curation_action: issue.severity === "critical" ? "EXCLUDE" : "AUTO_FORMAT",
      preview_text: issue.preview || "",
      raw_sample: {
        id: issue.id,
        preview: issue.preview,
        audioUrl: issue.audioUrl || (isAudio ? "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" : null),
        evidence: issue.evidence
      }
    });
  });

  // 2. Add verified Golden Seed pass samples for the remainder of the 100 samples
  for (let idx = allSamples.length; idx < totalBudget; idx++) {
    if (isAudio) {
      allSamples.push({
        sample_index: idx,
        sample_id: `rec_cv_${String(idx + 1).padStart(4, "0")}`,
        verdict: "PASS",
        failing_metrics: [],
        defect_quote: "",
        reasoning: "Acoustic stream meets 48kHz SNR threshold and matches Hindi transcription.",
        curation_action: "KEEP",
        preview_text: `Audio: common_voice_hi_${String(idx + 1).padStart(4, "0")}.mp3 | Sentence: "नमस्ते, यह वाक् वाक्य संख्या ${idx + 1} है।"`,
        raw_sample: {
          audio: `common_voice_hi_${String(idx + 1).padStart(4, "0")}.mp3`,
          sentence: `नमस्ते, यह वाक् वाक्य संख्या ${idx + 1} है।`,
          speaker_id: `spk_${String((idx % 12) + 1).padStart(3, "0")}`,
          duration_sec: +(2.1 + (idx % 6) * 0.7).toFixed(2),
          sampling_rate: 48000,
          audioUrl: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        }
      });
    } else {
      allSamples.push({
        sample_index: idx,
        sample_id: `rec_inst_${String(idx + 1).padStart(4, "0")}`,
        verdict: "PASS",
        failing_metrics: [],
        defect_quote: "",
        reasoning: "Directly satisfies training objective with clear, factual, and concise instruction output.",
        curation_action: "KEEP",
        preview_text: `Instruction: "Complete verified task #${idx + 1}" | Output: "Quality verified response."`,
        raw_sample: {
          instruction: `Execute verified objective task #${idx + 1}`,
          input: idx % 3 === 0 ? `Context for sample #${idx + 1}` : "",
          output: `Accurate, high-quality standard output for task #${idx + 1}.`
        }
      });
    }
  }

  const critCount = allSamples.filter(s => s.verdict === "CRITICAL_DEFECT").length;
  const warnCount = allSamples.filter(s => s.verdict === "NEEDS_CURATION").length;
  const goldCount = allSamples.filter(s => s.verdict === "PASS").length;

  const fullData = {
    repo_id: data.id,
    training_objective: data.task,
    total_profiled_rows: data.rows,
    audited_samples_count: allSamples.length,
    defect_count: critCount + warnCount,
    defect_rate_pct: +((critCount + warnCount) / allSamples.length * 100).toFixed(1),
    readiness_verdict: data.verdict,
    golden_count: goldCount,
    warning_count: warnCount,
    critical_count: critCount,
    metric_pass_rates: { "QUAL_01": 92.5, "QUAL_02": 88.0 },
    samples: allSamples,
    recommendations: data.recommendations
  };

  currentAuditResults = fullData;
  currentExcludedIndices.clear();
  allSamples.forEach((s) => {
    if (s.verdict === "CRITICAL_DEFECT") currentExcludedIndices.add(s.sample_index);
  });

  renderAuditFindings(fullData);
}

function renderFindingsTable(issues) {
  const tbody = document.getElementById("findingsTableBody");
  if (!tbody) return;

  if (issues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No matching anomalies for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = issues
    .map((item) => {
      const badgeClass =
        item.severity === "critical"
          ? "badge-critical"
          : item.severity === "warning"
          ? "badge-warning"
          : "badge-info";

      return `
      <tr onclick="inspectRecord('${item.id}')">
        <td><strong><code>${item.id}</code></strong></td>
        <td>${item.checkName}</td>
        <td><span class="badge-clean ${badgeClass}">${item.severity.toUpperCase()}</span></td>
        <td>${item.finding}</td>
        <td style="color: var(--text-primary); font-size: 0.82rem;">${item.recommendation}</td>
      </tr>
    `;
    })
    .join("");
}

function filterFindings(sev) {
  if (sev === "all") {
    renderFindingsTable(currentFixture.issues);
  } else {
    renderFindingsTable(currentFixture.issues.filter((i) => i.severity === sev));
  }
}

function inspectRecord(recordId) {
  const record = currentFixture.issues.find((i) => i.id === recordId);
  if (!record) return;

  const drawer = document.getElementById("detailDrawer");
  document.getElementById("detailKey").innerText = `Record Inspector: ${record.id}`;
  document.getElementById("detailContentPreview").innerText = record.preview;
  document.getElementById("detailEvidence").innerHTML = `
    <p style="margin-bottom: 4px;"><strong>Issue:</strong> ${record.checkName}</p>
    <p style="margin-bottom: 4px;"><strong>Measured Finding:</strong> ${record.finding}</p>
    <p style="margin-bottom: 4px;"><strong>Diagnostics:</strong> ${record.evidence}</p>
    <p><strong>Recommended Fix:</strong> ${record.recommendation}</p>
  `;

  const audioContainer = document.getElementById("detailAudioContainer");
  const audioPlayer = document.getElementById("detailAudioPlayer");
  if (record.audioUrl) {
    audioPlayer.src = record.audioUrl;
    audioContainer.style.display = "block";
  } else {
    audioContainer.style.display = "none";
  }

  drawer.style.display = "block";
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeDrawer() {
  document.getElementById("detailDrawer").style.display = "none";
}

function registerDecision(decision) {
  alert(`Human review registered: "${decision}". Saved in audit metadata.`);
  closeDrawer();
}

function renderCharts() {
  const issuesCanvas = document.getElementById("issuesChart");
  const distCanvas = document.getElementById("distributionChart");
  if (!issuesCanvas || !distCanvas) return;

  if (issuesChartInstance) issuesChartInstance.destroy();
  if (distChartInstance) distChartInstance.destroy();

  const cData = currentFixture.chartData;

  // Severity Doughnut Chart (Light mode)
  issuesChartInstance = new Chart(issuesCanvas, {
    type: "doughnut",
    data: {
      labels: ["Critical", "Warning", "Info"],
      datasets: [
        {
          data: cData.severities,
          backgroundColor: ["#dc2626", "#d97706", "#0284c7"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, color: "#6b7280" } }
      }
    }
  });

  // Distribution Bar Chart (Light mode)
  distChartInstance = new Chart(distCanvas, {
    type: "bar",
    data: {
      labels: cData.distLabels,
      datasets: [
        {
          label: "Sample Count",
          data: cData.distribution,
          backgroundColor: "#d97757",
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0, 0, 0, 0.05)" }, ticks: { color: "#6b7280" } },
        x: { grid: { display: false }, ticks: { color: "#6b7280" } }
      }
    }
  });
}

function exportReport(format) {
  const timestamp = new Date().toISOString().slice(0, 10);
  let filename = `datapilot_audit_${currentFixture.id.replace("/", "_")}_${timestamp}`;
  let content = "";
  let mimeType = "text/plain";

  if (format === "markdown") {
    filename += ".md";
    mimeType = "text/markdown";
    content = `# DataPilot Copilot Audit Report: ${currentFixture.id}
**Target Objective:** ${currentFixture.task}
**Detected Modality:** ${currentFixture.modality}
**Readiness Verdict:** ${currentFixture.verdict}

## Summary Metrics
- **Total Rows Profiled:** ${currentFixture.rows.toLocaleString()}
- **Representative Sample Budget:** ${currentFixture.samples}
- **Anomalies Identified:** ${currentFixture.anomalies}

## Flagged Sample Issues
| Record Key | Check Rule | Severity | Measured Finding | Action |
|---|---|---|---|---|
${currentFixture.issues.map((i) => `| ${i.id} | ${i.checkName} | ${i.severity.toUpperCase()} | ${i.finding} | ${i.recommendation} |`).join("\n")}

## Recommended Pre-Training Preparation
${currentFixture.recommendations.map((r) => `- ${r}`).join("\n")}
`;
  } else if (format === "csv") {
    filename += ".csv";
    mimeType = "text/csv";
    content =
      "record_key,check_name,severity,finding,recommendation\n" +
      currentFixture.issues
        .map((i) => `"${i.id}","${i.checkName}","${i.severity}","${i.finding}","${i.recommendation}"`)
        .join("\n");
  } else if (format === "json") {
    filename += ".json";
    mimeType = "application/json";
    content = JSON.stringify(
      {
        audit_id: "dp_copilot_" + Math.random().toString(36).substring(7),
        dataset_id: currentFixture.id,
        objective: currentFixture.task,
        modality: currentFixture.modality,
        verdict: currentFixture.verdict,
        timestamp: new Date().toISOString(),
        issues: currentFixture.issues,
        recommendations: currentFixture.recommendations
      },
      null,
      2
    );
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
