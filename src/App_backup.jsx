import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  BarChart3,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Code2,
  FileAudio,
  FileClock,
  Gauge,
  HelpCircle,
  History,
  House,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import "./App.css";

const TOKEN = "voiceCloneToken";
const USER = "voiceCloneUser";

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER) || "null");
  } catch {
    return null;
  }
}

async function api(path, options = {}, service = "backend") {
  const url = service === "ai" ? `/ai${path}` : `/backend${path}`;
  const headers = new Headers(options.headers || {});

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (service === "backend") {
    const token = localStorage.getItem(TOKEN);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();

  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        data.detail ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

function getToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.data?.token ||
    data?.data?.accessToken
  );
}

function asList(data) {
  if (Array.isArray(data)) return data;

  for (const key of ["content", "files", "history", "items", "data"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function audioName(item) {
  return (
    item?.originalFilename ||
    item?.fileName ||
    item?.filename ||
    item?.name ||
    "Audio recording"
  );
}

function dateText(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function scoreText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "—";
}

function Waveform() {
  return (
    <svg
      className="waveform"
      viewBox="0 0 500 130"
      fill="none"
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <path
          key={i}
          d={`M0 ${78 + i * 2}
          C55 ${20 + i * 3},85 ${117 - i * 2},145 ${68 + i * 2}
          S225 ${22 + i * 3},275 ${66 + i * 2}
          S330 ${120 - i * 2},380 ${52 + i * 2}
          S435 ${20 + i * 3},500 ${73 + i * 2}`}
          stroke={i % 2 ? "#9BB8FF" : "#7467FF"}
          strokeWidth="1.2"
          opacity={0.22 + i * 0.045}
        />
      ))}
    </svg>
  );
}

function Button({
  children,
  secondary = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button ${
        secondary ? "button-secondary" : "button-primary"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Metric({ icon: Icon, tone, label, value, caption, green = false }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={25} />
      </div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong className={green ? "green-text" : ""}>{value}</strong>
        <small>{caption}</small>
      </div>
    </article>
  );
}

function ResultStat({ icon: Icon, tone, label, value }) {
  return (
    <div className="result-stat">
      <div className={`stat-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function AuthModal({ mode, setMode, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const isLogin = mode === "login";

      const data = await api(
        isLogin ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(
            isLogin ? { email, password } : { name, email, password }
          ),
        }
      );

      const token = getToken(data);

      if (!token) {
        if (!isLogin) {
          setMode("login");
          setError("Registration submitted. Please sign in.");
          return;
        }

        throw new Error(
          "No JWT token was returned. Check the login API response."
        );
      }

      const account = data?.user || data?.data?.user || {
        name: data?.name || name,
        email: data?.email || email,
      };

      localStorage.setItem(TOKEN, token);
      localStorage.setItem(USER, JSON.stringify(account));

      onSuccess(account);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="auth-modal">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="auth-symbol">
          <AudioLines size={27} />
        </div>

        <div className="eyebrow-blue">VOXGUARD ACCOUNT</div>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>Sign in to save audio uploads and access your scan history.</p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "selected" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign In
          </button>

          <button
            className={mode === "register" ? "selected" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>

          {error && (
            <div className="notice error">
              <CircleAlert size={16} />
              {error}
            </div>
          )}

          <button className="sign-button auth-submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
            <LogIn size={17} />
          </button>
        </form>

        <div className="auth-footer">
          <ShieldCheck size={15} />
          Authentication through Spring Boot
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("analyze");
  const [user, setUser] = useState(currentUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("Checking services");
  const fileInput = useRef(null);

  const title = {
    dashboard: ["Dashboard", "Your voice authenticity workspace."],
    analyze: [
      "Analyze Audio",
      "Upload a voice recording and detect synthetic or cloned speech using the AASIST model.",
    ],
    history: ["Scan History", "Review the audio recordings you have uploaded."],
  }[page];

  async function refreshHistory() {
    if (!localStorage.getItem(TOKEN)) {
      setHistory([]);
      return;
    }

    setHistoryBusy(true);

    try {
      const data = await api("/audio/history");
      setHistory(asList(data));
    } catch (e) {
      setNotice(`Unable to load scan history: ${e.message}`);
    } finally {
      setHistoryBusy(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function checkServices() {
      try {
        const [ai, backend] = await Promise.allSettled([
          fetch("/ai/health"),
          fetch("/backend/health"),
        ]);

        const aiUp = ai.status === "fulfilled" && ai.value.ok;
        const backendUp =
          backend.status === "fulfilled" && backend.value.ok;

        if (!active) return;

        setServiceStatus(
          aiUp && backendUp
            ? "All Systems Online"
            : aiUp
              ? "AI Online · Backend Unverified"
              : "Service Check Failed"
        );
      } catch {
        if (active) setServiceStatus("Service Check Failed");
      }
    }

    checkServices();

    if (localStorage.getItem(TOKEN)) {
      refreshHistory();
    }

    return () => {
      active = false;
    };
  }, []);

  function navigate(next) {
    setPage(next);
    setMobileMenu(false);
    setNotice("");

    if (next === "history" && localStorage.getItem(TOKEN)) {
      refreshHistory();
    }
  }

  function pickFile(candidate) {
    setError("");
    setNotice("");
    setResult(null);

    if (!candidate) return;

    const supported =
      candidate.type.startsWith("audio/") ||
      /\.(wav|mp3|flac|ogg|m4a|aac|webm)$/i.test(candidate.name);

    if (!supported) {
      setFile(null);
      setError(
        "Choose an audio recording, such as WAV, MP3, FLAC, OGG or M4A."
      );
      return;
    }

    if (candidate.size > 20 * 1024 * 1024) {
      setFile(null);
      setError("File size exceeds the 20 MB limit.");
      return;
    }

    setFile(candidate);
  }

  async function analyze() {
    if (!file) {
      setError("Choose an audio file before starting analysis.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      // 1. Send audio to the AI detection service.
      const form = new FormData();
      form.append("file", file);

      const data = await api(
        "/api/audio/detect",
        {
          method: "POST",
          body: form,
        },
        "ai"
      );

      // The FastAPI response may wrap the model output inside "result".
      const analysisResult = data?.result ?? data;
      setResult(analysisResult);

      // 2. Save the upload and analysis for signed-in users.
      if (localStorage.getItem(TOKEN)) {
        try {
          const upload = new FormData();
          upload.append("file", file);

          const uploadResponse = await api("/audio/upload", {
            method: "POST",
            body: upload,
          });

          const audioId = uploadResponse?.audioId;

          if (audioId == null) {
            throw new Error("Upload response did not contain an audio ID.");
          }

          // 3. Save AI fields against the uploaded audio record.
          await api(`/audio/${audioId}/analysis`, {
            method: "POST",
            body: JSON.stringify(analysisResult),
          });

          setNotice(
            "Analysis completed. Audio and results saved to your account."
          );

          await refreshHistory();
        } catch (e) {
          setNotice(
            `Analysis completed, but saving the upload or result failed: ${e.message}`
          );
        }
      } else {
        setNotice(
          "Guest analysis completed. Sign in to save uploads and results."
        );
      }
    } catch (e) {
      setError(
        `Analysis failed: ${e.message}. Check that FastAPI is running on port 8000.`
      );
    } finally {
      setBusy(false);
    }
  }

  function resetAnalysis() {
    setFile(null);
    setResult(null);
    setError("");
    setNotice("");

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER);
    setUser(null);
    setHistory([]);
    setNotice("You have signed out.");
  }

  const classification = String(
    result?.classification || "NOT_CALIBRATED"
  ).toUpperCase();

  const knownClass = [
    "GENUINE",
    "BONAFIDE",
    "SPOOF",
    "FAKE",
    "CLONED",
    "SYNTHETIC",
  ].includes(classification);

  const spoof = ["SPOOF", "FAKE", "CLONED", "SYNTHETIC"].includes(
    classification
  );

  const meanScore =
    result?.mean_bona_fide_score ?? result?.score;

  const medianScore = result?.median_bona_fide_score;

  const savedScores = history
    .map((item) => Number(item.meanBonaFideScore))
    .filter((value) => Number.isFinite(value));

  const averageScore =
    savedScores.length > 0
      ? (
          savedScores.reduce((sum, value) => sum + value, 0) /
          savedScores.length
        ).toFixed(4)
      : "—";

  const nav = [
    ["dashboard", House, "Dashboard"],
    ["analyze", AudioLines, "Analyze Audio"],
    ["history", History, "Scan History"],
    ["history", FileAudio, "My Uploads"],
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <AudioLines size={29} strokeWidth={2.5} />
          </div>

          <div className="brand-copy">
            <strong>VoxGuard</strong>
            <span>AI VOICE DETECTION</span>
          </div>

          <button
            className="icon-button mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="nav-list">
          {nav.map(([id, Icon, label], i) => (
            <button
              key={`${label}-${i}`}
              className={`nav-link ${
                page === id ? "nav-selected" : ""
              }`}
              onClick={() => navigate(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}

          <button
            className="nav-link"
            onClick={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          >
            <UserRound size={21} />
            <span>Profile</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="privacy-card">
          <div className="privacy-heading">
            <ShieldCheck size={23} />
            <strong>Privacy First</strong>
          </div>
          <p>Your audio is processed securely by local AI models.</p>
          <span className="local-status">
            <i />
            Local Services
          </span>
        </div>

        <div className="account-card">
          <div className="account-avatar">
            {user ? (
              (user.name || user.email || "U").slice(0, 1).toUpperCase()
            ) : (
              <UserRound size={20} />
            )}
          </div>

          <div className="account-details">
            <strong>
              {user?.name || (user ? "Signed in" : "Guest User")}
            </strong>
            <span>{user?.email || "Sign in to save history"}</span>
          </div>

          {user ? (
            <button
              className="icon-button"
              onClick={logout}
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          ) : (
            <button
              className="icon-button"
              onClick={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
              title="Sign in"
            >
              <LogIn size={17} />
            </button>
          )}
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="topbar-spacer" />

          <div
            className={`online-pill ${
              serviceStatus.includes("Failed") ? "offline-pill" : ""
            }`}
          >
            <i />
            {serviceStatus}
          </div>

          <button
            className="help-button"
            onClick={() =>
              setNotice(
                "Select an audio file, then run the AASIST analysis. A model score is not a probability."
              )
            }
          >
            <HelpCircle size={20} />
            Help
          </button>

          {user ? (
            <button className="sign-button" onClick={logout}>
              <LogOut size={17} />
              Sign Out
            </button>
          ) : (
            <button
              className="sign-button"
              onClick={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
            >
              <UserRound size={18} />
              Sign In
            </button>
          )}
        </header>

        <div className="content">
          <section className="page-heading">
            <div className="page-heading-copy">
              <div className="eyebrow-blue">
                AI VOICE CLONE DETECTION
              </div>
              <h1>{title[0]}</h1>
              <p>{title[1]}</p>
            </div>
            <Waveform />
          </section>

          {notice && (
            <div className="notice notice-info">
              <Check size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {page === "analyze" && (
            <>
              <section className="metrics-row">
                <Metric
                  icon={FileAudio}
                  tone="lavender"
                  label="Total Analyses"
                  value={user ? history.length : "—"}
                  caption={
                    user ? "Saved recordings" : "Your analyzed recordings"
                  }
                />

                <Metric
                  icon={ShieldCheck}
                  tone="mint"
                  label="Detection Engine"
                  value="AASIST"
                  caption="Pretrained anti-spoofing model"
                />

                <Metric
                  icon={BarChart3}
                  tone="gold"
                  label="Average Score"
                  value={user ? averageScore : "—"}
                  caption="Saved model scores; not probabilities"
                />

                <Metric
                  icon={Clock3}
                  tone="blue"
                  label="Service Status"
                  value={
                    serviceStatus.includes("Online") ? "Online" : "Check"
                  }
                  caption="FastAPI + Spring Boot"
                  green={serviceStatus.includes("Online")}
                />
              </section>

              <div className="work-grid">
                <section className="card upload-card">
                  <div className="card-title-row">
                    <div className="number-badge">1</div>
                    <div className="card-title-copy">
                      <h2>Upload &amp; Analyze</h2>
                      <p>
                        Select an audio file and run it through the AI
                        detection service.
                      </p>
                    </div>
                  </div>

                  <div
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInput.current?.click()}
                  >
                    <input
                      ref={fileInput}
                      type="file"
                      hidden
                      accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac,.webm"
                      onChange={(e) => pickFile(e.target.files?.[0])}
                    />

                    <UploadCloud size={56} strokeWidth={1.7} />

                    <strong>
                      {file
                        ? "Audio file selected"
                        : "Drag and drop an audio file here"}
                    </strong>

                    <span>{file ? file.name : "or click to browse"}</span>

                    {!file && (
                      <button
                        className="choose-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInput.current?.click();
                        }}
                      >
                        <FileAudio size={18} />
                        Choose File
                      </button>
                    )}

                    <small>
                      Supports: WAV, MP3, FLAC, OGG, M4A
                      <b> • </b>
                      Max size: 20 MB
                    </small>
                  </div>

                  {file && (
                    <div className="selected-file">
                      <div className="selected-file-icon">
                        <FileAudio size={21} />
                      </div>

                      <div className="selected-copy">
                        <strong>{file.name}</strong>
                        <span>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      <Check className="selected-check" size={21} />

                      <button
                        className="icon-button"
                        onClick={resetAnalysis}
                        aria-label="Remove file"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="notice notice-error">
                      <CircleAlert size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    className="run-button"
                    onClick={analyze}
                    disabled={!file || busy}
                  >
                    {busy ? (
                      <span className="spinner" />
                    ) : (
                      <Play size={19} fill="currentColor" />
                    )}

                    {busy ? "Analyzing audio…" : "Run AI Analysis"}

                    {!busy && <span className="run-arrow">→</span>}
                  </button>

                  <div className="local-caption">
                    <ShieldCheck size={16} />
                    Processed by your local Python service (FastAPI)
                  </div>
                </section>

                <section className="card results-card">
                  <div className="card-title-row results-title">
                    <div className="number-badge">2</div>

                    <div className="card-title-copy">
                      <h2>Detection Results</h2>
                      <p>Model output and analysis details.</p>
                    </div>

                    <button
                      className="reset-button"
                      onClick={resetAnalysis}
                    >
                      <RefreshCw size={17} />
                      Reset
                    </button>
                  </div>

                  {!result && !busy && (
                    <div className="result-empty">
                      <div className="result-empty-icon">
                        <Gauge size={27} />
                      </div>
                      <strong>Results will appear here</strong>
                      <p>
                        Upload a recording and run the analysis to view
                        model scores and segment details.
                      </p>
                    </div>
                  )}

                  {busy && (
                    <div className="result-empty">
                      <span className="spinner spinner-large" />
                      <strong>Analyzing your recording</strong>
                      <p>
                        AASIST is processing the audio. Larger files can
                        take longer.
                      </p>
                    </div>
                  )}

                  {result && !busy && (
                    <div className="result-body">
                      <div
                        className={`model-alert ${
                          knownClass
                            ? spoof
                              ? "alert-spoof"
                              : "alert-genuine"
                            : ""
                        }`}
                      >
                        {knownClass ? (
                          spoof ? (
                            <CircleAlert size={27} />
                          ) : (
                            <BadgeCheck size={27} />
                          )
                        ) : (
                          <Activity size={27} />
                        )}

                        <div>
                          <span className="alert-label">MODEL OUTPUT</span>

                          <strong>
                            {knownClass
                              ? spoof
                                ? "Potential spoof detected"
                                : "Bona-fide-like audio"
                              : "Score generated — not calibrated"}
                          </strong>

                          <p>
                            {result.message ||
                              "A validated decision threshold is not configured. Do not interpret this score as a probability."}
                          </p>
                        </div>
                      </div>

                      <div className="result-stat-grid">
                        <ResultStat
                          icon={Gauge}
                          tone="lavender"
                          label="Mean bona-fide score"
                          value={scoreText(meanScore)}
                        />

                        <ResultStat
                          icon={BarChart3}
                          tone="mint"
                          label="Median score"
                          value={scoreText(medianScore)}
                        />

                        <ResultStat
                          icon={Activity}
                          tone="blue"
                          label="Segments analyzed"
                          value={result.segments_analyzed ?? "—"}
                        />

                        <ResultStat
                          icon={AudioLines}
                          tone="pink"
                          label="Sample rate"
                          value={
                            result.sample_rate
                              ? `${Number(result.sample_rate) / 1000} kHz`
                              : "—"
                          }
                        />
                      </div>

                      {Array.isArray(result.segment_scores) &&
                        result.segment_scores.length > 0 && (
                          <div className="segments-panel">
                            <div className="segment-title">
                              <strong>Segment Scores</strong>
                              <span>
                                {result.segment_scores.length} segments
                              </span>
                            </div>

                            <div className="segment-chart">
                              {result.segment_scores
                                .slice(0, 55)
                                .map((value, index) => (
                                  <div
                                    key={index}
                                    title={`Segment ${index + 1}: ${value}`}
                                  >
                                    <i
                                      style={{
                                        height: `${Math.max(
                                          8,
                                          Math.min(
                                            100,
                                            28 + (Number(value) + 4) * 8
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                      <details className="raw-response">
                        <summary>
                          <Code2 size={19} />
                          View raw model response
                          <ChevronDown size={17} />
                        </summary>
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </section>
              </div>

              <div className="bottom-disclaimer">
                <CircleAlert size={16} />
                <span>
                  Scores are model outputs, not calibrated probabilities.
                  A definitive classification remains disabled until a
                  validated threshold is configured.
                </span>
              </div>
            </>
          )}

          {(page === "dashboard" || page === "history") && (
            <section className="card history-card">
              <div className="history-heading">
                <div>
                  <h2>
                    {page === "dashboard"
                      ? "Recent Audio Analyses"
                      : "Scan History"}
                  </h2>
                  <p>Your previously uploaded recordings.</p>
                </div>

                <button
                  className="reset-button"
                  onClick={refreshHistory}
                  disabled={historyBusy}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {!user ? (
                <div className="result-empty">
                  <History size={28} />
                  <strong>Sign in to view saved history</strong>
                  <p>Guest analyses are not linked to an account.</p>
                </div>
              ) : historyBusy ? (
                <div className="result-empty">
                  <span className="spinner" />
                  <p>Loading recording history…</p>
                </div>
              ) : history.length === 0 ? (
                <div className="result-empty">
                  <FileClock size={28} />
                  <strong>No saved uploads yet</strong>
                  <p>Analyze a recording to begin building your history.</p>
                  <Button onClick={() => navigate("analyze")}>
                    Analyze Audio
                  </Button>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>RECORDING</th>
                        <th>UPLOADED</th>
                        <th>FILE TYPE</th>
                        <th>DETECTION STATUS</th>
                        <th>MEAN SCORE</th>
                        <th>MEDIAN SCORE</th>
                        <th>SEGMENTS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((item, i) => (
                        <tr key={item.id || i}>
                          <td>
                            <FileAudio size={17} />
                            {audioName(item)}
                          </td>

                          <td>
                            {dateText(
                              item.uploadedAt ||
                                item.createdAt ||
                                item.created_at
                            )}
                          </td>

                          <td>
                            {item.contentType || item.mimeType || "Audio"}
                          </td>

                          <td>
                            <span className="uploaded-pill">
                              <i />
                              {item.detectionStatus ||
                                item.detection_status ||
                                item.status ||
                                "Uploaded"}
                            </span>
                          </td>

                          <td>
                            {scoreText(
                              item.meanBonaFideScore ??
                                item.mean_bona_fide_score
                            )}
                          </td>

                          <td>
                            {scoreText(
                              item.medianBonaFideScore ??
                                item.median_bona_fide_score
                            )}
                          </td>

                          <td>
                            {item.segmentsAnalyzed ??
                              item.segments_analyzed ??
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <footer className="footer">
            <span>VOXGUARD · AI VOICE DETECTION</span>
            <span>Privacy first · AASIST anti-spoofing</span>
          </footer>
        </div>
      </main>

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={(account) => {
            setUser(account);
            setNotice(
              `Signed in${account.email ? ` as ${account.email}` : ""}.`
            );
            refreshHistory();
          }}
        />
      )}
    </div>
  );
}