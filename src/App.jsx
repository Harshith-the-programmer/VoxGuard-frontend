import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FileCheck2,
  Files,
  FileClock,
  Gauge,
  HelpCircle,
  House,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import "./App.css";

const TOKEN = "voiceCloneToken";
const USER = "voiceCloneUser";
const REGISTERED_NAMES = "voiceCloneRegisteredNames";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const PAGE_INFO = {
  dashboard: [
    "Dashboard",
    "Overview of your audio analysis activity and service status.",
  ],
  analyze: [
    "Analyze Audio",
    "Upload a voice recording and analyze it with the AASIST anti-spoofing model.",
  ],
  insights: [
    "Detection Insights",
    "Understand saved model scores and your analysis activity.",
  ],
  uploads: [
    "My Uploads",
    "Manage the audio files you've uploaded.",
  ],
  profile: [
    "Profile",
    "Manage your account information and review your usage.",
  ],
};

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}


function readRegisteredName(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return "";

  try {
    const savedNames = JSON.parse(
      localStorage.getItem(REGISTERED_NAMES) || "{}",
    );
    return firstNonEmptyString(savedNames[normalizedEmail]);
  } catch {
    return "";
  }
}

function saveRegisteredName(email, name) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();
  if (!normalizedEmail || !normalizedName) return;

  try {
    const savedNames = JSON.parse(
      localStorage.getItem(REGISTERED_NAMES) || "{}",
    );
    savedNames[normalizedEmail] = normalizedName;
    localStorage.setItem(REGISTERED_NAMES, JSON.stringify(savedNames));
  } catch {
    // The app can still use the backend response if browser storage is unavailable.
  }
}

function accountCandidates(data) {
  return [
    data?.user,
    data?.data?.user,
    data?.account,
    data?.data?.account,
    data?.userDetails,
    data?.data?.userDetails,
    data?.data,
    data,
  ].filter(
    (item) => item && typeof item === "object" && !Array.isArray(item),
  );
}

function normalizeUser(data, fallback = {}) {
  const candidates = accountCandidates(data);
  const realName = firstNonEmptyString(
    ...candidates.flatMap((item) => [
      item.name,
      item.fullName,
      item.full_name,
      item.displayName,
      item.display_name,
      [item.firstName, item.lastName].filter(Boolean).join(" "),
      [item.first_name, item.last_name].filter(Boolean).join(" "),
      typeof item.username === "string" && !item.username.includes("@")
        ? item.username
        : "",
    ]),
    fallback.name,
  );
  const email = firstNonEmptyString(
    ...candidates.map((item) => item.email),
    fallback.email,
  );
  const base = candidates.find((item) =>
    [
      item.name,
      item.fullName,
      item.full_name,
      item.displayName,
      item.display_name,
      item.email,
      item.username,
      item.id,
      item.userId,
      item.user_id,
    ].some((value) => value !== undefined && value !== null && value !== ""),
  ) || {};

  return {
    ...(base.id != null ? { id: base.id } : {}),
    ...(base.userId != null ? { userId: base.userId } : {}),
    name: realName,
    email,
  };
}

function userDisplayName(user) {
  const realName = firstNonEmptyString(
    user?.name,
    user?.fullName,
    user?.full_name,
    user?.displayName,
    user?.display_name,
  );
  if (realName) return realName;

  const email = firstNonEmptyString(user?.email);
  if (email.includes("@")) return email.split("@")[0];
  return "Signed in";
}

function userFullName(user) {
  return firstNonEmptyString(
    user?.name,
    user?.fullName,
    user?.full_name,
    user?.displayName,
    user?.display_name,
  );
}

function currentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(USER) || "null");
    if (!stored || typeof stored !== "object") return null;
    const normalized = normalizeUser(stored, {
      name: readRegisteredName(stored.email),
      email: stored.email,
    });
    return normalized.email || normalized.name ? normalized : stored;
  } catch {
    return null;
  }
}

const BACKEND_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL || "/backend").replace(/\/$/, "");

const AI_BASE_URL =
  (import.meta.env.VITE_AI_URL || "/ai").replace(/\/$/, "");

async function api(path, options = {}, service = "backend") {
  const baseUrl = service === "ai" ? AI_BASE_URL : BACKEND_BASE_URL;
  const url = `${baseUrl}${path}`;
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
        `Request failed (${response.status})`,
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

function dayText(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreText(value) {
  const number = scoreNumber(value);
  return number === null ? "—" : number.toFixed(4);
}

function formatBytes(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizedStatus(item) {
  return String(
    item?.detectionStatus ||
      item?.detection_status ||
      item?.status ||
      "UPLOADED",
  ).toUpperCase();
}

function isAnalyzed(item) {
  return (
    scoreNumber(
      item?.meanBonaFideScore ?? item?.mean_bona_fide_score,
    ) !== null
  );
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

function Metric({
  icon: Icon,
  tone = "blue",
  label,
  value,
  caption,
  green = false,
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={24} />
      </div>

      <div className="metric-copy">
        <span>{label}</span>
        <strong className={green ? "green-text" : ""}>{value}</strong>
        <small>{caption}</small>
      </div>
    </article>
  );
}

function ResultStat({ icon: Icon, tone = "blue", label, value }) {
  return (
    <div className="result-stat">
      <div className={`stat-icon ${tone}`}>
        <Icon size={21} />
      </div>

      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const value = String(status || "UPLOADED").toUpperCase();

  const tone = [
    "SPOOF",
    "FAKE",
    "CLONED",
    "SYNTHETIC",
  ].includes(value)
    ? "status-danger"
    : value === "NOT_CALIBRATED"
      ? "status-warning"
      : [
          "GENUINE",
          "BONAFIDE",
          "ANALYZED",
        ].includes(value)
        ? "status-success"
        : "status-neutral";

  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {value.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({
  icon: Icon = Files,
  title,
  description,
  action,
}) {
  return (
    <div className="result-empty">
      <div className="result-empty-icon">
        <Icon size={25} />
      </div>

      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

function AuthModal({ mode, setMode, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  


  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    

    try {
      const isLogin = mode === "login";

      const data = await api(
        isLogin ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(
            isLogin
              ? { email, password }
              : { name, email, password },
          ),
        },
      );

      // Keep the name supplied during registration as a local fallback for
      // login APIs that return only a JWT. The backend should still return
      // the account's real name for cross-device consistency.
      if (!isLogin) {
        saveRegisteredName(email, name);
      }

      const token = getToken(data);

      if (!token) {
        if (!isLogin) {
          setMode("login");
          setError("");
          setSuccess(
            "Registration successful! Please sign in with your new account.",
          );
          setPassword("");
          return;
        }

        throw new Error(
          "No JWT token was returned. Check the login API response.",
        );
      }
      

      // Normalize common Spring Boot response shapes. If login returns only
      // a token, reuse the name entered during registration in this browser.
      const registeredName = readRegisteredName(email);
      const account = normalizeUser(data, {
        name: isLogin ? registeredName : name,
        email,
      });

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="auth-modal">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <X size={20} />
        </button>

        <div className="auth-symbol">
          <AudioLines size={27} />
        </div>

        <div className="eyebrow-blue">VOXGUARD ACCOUNT</div>
        <h2>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h2>

        <p>
          Sign in to save audio uploads and access your account
          history.
        </p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "selected" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
            type="button"
          >
            Sign In
          </button>

          <button
            className={mode === "register" ? "selected" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
            type="button"
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
                onChange={(event) => setName(event.target.value)}
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
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </label>

          {error && (
            <div className="notice notice-error">
              <CircleAlert size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="notice notice-success">
              {success}
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

function AudioTable({ items, showAnalysis, onView }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={FileClock}
        title={
          showAnalysis
            ? "No analysis results yet"
            : "No uploaded audio files"
        }
        description={
          showAnalysis
            ? "Run an analysis on an uploaded recording to see results here."
            : "Your uploaded recordings will appear here after you save them."
        }
      />
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>FILE NAME</th>

            {showAnalysis ? (
              <>
                <th>UPLOADED</th>
                <th>ANALYZED AT</th>
                <th>STATUS</th>
                <th>MEAN SCORE</th>
                <th>MEDIAN SCORE</th>
                <th>SEGMENTS</th>
              </>
            ) : (
              <>
                <th>FILE TYPE</th>
                <th>FILE SIZE</th>
                <th>UPLOAD DATE</th>
                <th>STATUS</th>
              </>
            )}

            <th>ACTION</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? `${audioName(item)}-${index}`}>
              <td className="file-name-cell">
                <FileAudio size={17} />
                {audioName(item)}
              </td>

              {showAnalysis ? (
                <>
                  <td>{dateText(item.uploadedAt || item.uploaded_at)}</td>
                  <td>{dateText(item.analyzedAt || item.analyzed_at)}</td>
                  <td><StatusPill status={normalizedStatus(item)} /></td>
                  <td>
                    {scoreText(
                      item.meanBonaFideScore ??
                        item.mean_bona_fide_score,
                    )}
                  </td>
                  <td>
                    {scoreText(
                      item.medianBonaFideScore ??
                        item.median_bona_fide_score,
                    )}
                  </td>
                  <td>
                    {item.segmentsAnalyzed ??
                      item.segments_analyzed ??
                      "—"}
                  </td>
                </>
              ) : (
                <>
                  <td>{item.contentType || item.content_type || "Audio"}</td>
                  <td>{formatBytes(item.fileSize ?? item.file_size)}</td>
                  <td>{dateText(item.uploadedAt || item.uploaded_at)}</td>
                  <td>
                    <StatusPill
                      status={isAnalyzed(item) ? "ANALYZED" : item.status}
                    />
                  </td>
                </>
              )}

              <td>
                <button
                  className="table-action"
                  type="button"
                  onClick={() => onView(item)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [serviceStatus, setServiceStatus] =
    useState("Checking services");

  const [uploadSearch, setUploadSearch] = useState("");
  const [uploadStatus, setUploadStatus] = useState("ALL");
  const [uploadFormat, setUploadFormat] = useState("ALL");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fileInput = useRef(null);
  const title = PAGE_INFO[page] || PAGE_INFO.dashboard;

  const refreshHistory = useCallback(async () => {
    if (!localStorage.getItem(TOKEN)) {
      setHistory([]);
      setHistoryBusy(false);
      return;
    }

    setHistoryBusy(true);

    try {
      const data = await api("/audio/history");
      setHistory(asList(data));
    } catch (e) {
      setNotice(`Unable to load saved recordings: ${e.message}`);
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const [ai, backend] = await Promise.allSettled([
        fetch(`${import.meta.env.VITE_AI_URL}/health`),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/health`),
      ]);

      if (!active) return;

      const aiUp = ai.status === "fulfilled" && ai.value.ok;
      const backendUp =
        backend.status === "fulfilled" && backend.value.ok;

      setServiceStatus(
        aiUp && backendUp
          ? "All Systems Online"
          : aiUp
            ? "AI Online · Backend Unverified"
            : backendUp
              ? "Backend Online · AI Unavailable"
              : "Service Check Failed",
      );

      if (localStorage.getItem(TOKEN)) {
        // Refresh the profile from the database so existing sessions also
        // show the exact registered name after the backend fix is deployed.
        try {
          const profileData = await api("/auth/me");
          const cachedProfile = currentUser();
          const profileEmail = profileData?.email || cachedProfile?.email;
          const account = normalizeUser(profileData, {
            name: readRegisteredName(profileEmail),
            email: profileEmail,
          });
          if (active && (account.email || account.name)) {
            localStorage.setItem(USER, JSON.stringify(account));
            setUser(account);
          }
        } catch {
          // Keep the cached profile visible if refreshing profile details fails.
        }

        try {
          const data = await api("/audio/history");
          if (active) setHistory(asList(data));
        } catch (e) {
          if (active) {
            setNotice(`Unable to load saved recordings: ${e.message}`);
          }
        }
      }
    }

    initialize().catch(() => {
      if (active) setServiceStatus("Service Check Failed");
    });

    return () => {
      active = false;
    };
  }, []);

  function navigate(next) {
    setPage(next);
    setMobileMenu(false);
    setNotice("");
    setSelectedRecord(null);

    if (
      next === "uploads" ||
      next === "insights" ||
      next === "dashboard"
    ) {
      refreshHistory();
    }
  }

  
  function pickFile(candidate) {
    setError("");
    setNotice("");
    setResult(null);

    if (!candidate) return;

    if (candidate.size === 0) {
      setFile(null);
      setError("The selected file is empty.");
      return;
    }

    const supportedExtensions =
      /\.(wav|mp3|flac|ogg|m4a|mp4|aac|webm|opus|oga|aiff|aif|aifc)$/i;

    const supported =
      candidate.type.startsWith("audio/") ||
      supportedExtensions.test(candidate.name);

    if (!supported) {
      setFile(null);
      setError(
        "Unsupported file. Choose WAV, MP3, FLAC, OGG, M4A, MP4, AAC, WebM, OPUS or AIFF audio."
      );
      return;
    }

    if (candidate.size > MAX_FILE_SIZE) {
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

    const selectedFile = file;

    // Reset the upload box immediately.
    setFile(null);
    if (fileInput.current) {
      fileInput.current.value = "";
    }

    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      let analysisResult;

      if (localStorage.getItem(TOKEN)) {
        // Signed-in users: upload first, then let Spring Boot call FastAPI.
        const upload = new FormData();
        upload.append("file", selectedFile);

        const uploadResponse = await api("/audio/upload", {
          method: "POST",
          body: upload,
        });

        const audioId = uploadResponse?.audioId;

        if (audioId == null) {
          throw new Error("Upload response did not contain an audio ID.");
        }

        const analysisResponse = await api(
          `/audio/${audioId}/analysis`,
          { method: "POST" },
        );

        analysisResult = analysisResponse?.result;

        if (!analysisResult) {
          throw new Error("The backend returned no analysis result.");
        }

        setResult(analysisResult);
        setNotice("Analysis completed. Audio and results saved to your account.");
        await refreshHistory();
      } else {
        // Guest users: analyze directly through FastAPI.
        const form = new FormData();
        form.append("file", selectedFile);

        const data = await api(
          "/api/audio/detect",
          {
            method: "POST",
            body: form,
          },
          "ai",
        );

        analysisResult = data?.result ?? data;
        setResult(analysisResult);
        setNotice("Guest analysis completed. Sign in to save uploads and results.");
      }
    } catch (e) {
      setError(`Analysis failed: ${e.message}. Check that Spring Boot and FastAPI are running.`);
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
    setPage("dashboard");
    setNotice("You have signed out.");
  }

  const analyzedFiles = useMemo(
    () => history.filter(isAnalyzed),
    [history],
  );

  const savedScores = useMemo(
    () =>
      analyzedFiles
        .map((item) =>
          scoreNumber(
            item.meanBonaFideScore ??
              item.mean_bona_fide_score,
          ),
        )
        .filter((value) => value !== null),
    [analyzedFiles],
  );

  const averageScore =
    savedScores.length > 0
      ? (
          savedScores.reduce((sum, value) => sum + value, 0) /
          savedScores.length
        ).toFixed(4)
      : "—";

  const averageSegments = useMemo(() => {
    const values = analyzedFiles
      .map((item) =>
        Number(item.segmentsAnalyzed ?? item.segments_analyzed),
      )
      .filter(Number.isFinite);

    return values.length
      ? (
          values.reduce((sum, value) => sum + value, 0) /
          values.length
        ).toFixed(1)
      : "—";
  }, [analyzedFiles]);

  const uploadedCount = history.length;
  const analyzedCount = analyzedFiles.length;

  const notCalibratedCount = history.filter(
    (item) => normalizedStatus(item) === "NOT_CALIBRATED",
  ).length;

  const pendingCount = Math.max(
    0,
    uploadedCount - analyzedCount,
  );

  const insightsScores = useMemo(
    () =>
      analyzedFiles
        .map((item) => ({
          name: audioName(item),
          score: scoreNumber(
            item.meanBonaFideScore ??
              item.mean_bona_fide_score,
          ),
          date:
            item.analyzedAt ||
            item.analyzed_at ||
            item.uploadedAt ||
            item.uploaded_at,
          id: item.id,
        }))
        .filter((item) => item.score !== null)
        .slice(0, 12)
        .reverse(),
    [analyzedFiles],
  );

  const formats = useMemo(() => {
    const map = new Map();

    history.forEach((item) => {
      const type =
        item.contentType || item.content_type || "Unknown";

      map.set(type, (map.get(type) || 0) + 1);
    });

    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [history]);

  const filteredUploads = useMemo(() => {
    const query = uploadSearch.trim().toLowerCase();

    return history.filter((item) => {
      const nameMatch = audioName(item).toLowerCase().includes(query);

      const format = String(
        item.contentType || item.content_type || "",
      ).toLowerCase();

      const formatMatch =
        uploadFormat === "ALL" ||
        format.includes(uploadFormat.toLowerCase());

      const status = isAnalyzed(item) ? "ANALYZED" : "UPLOADED";

      const statusMatch =
        uploadStatus === "ALL" || status === uploadStatus;

      return nameMatch && formatMatch && statusMatch;
    });
  }, [history, uploadSearch, uploadFormat, uploadStatus]);

  const reportedClassification = String(
    result?.classification || "NOT_CALIBRATED",
  ).toUpperCase();

  const thresholdScore = Number(result?.median_bona_fide_score);
  const thresholdValue = Number(result?.threshold);

  const thresholdUsable =
    result?.threshold_status === "EXPERIMENTAL_INTERNAL_HOLDOUT" &&
    result?.threshold != null &&
    Number.isFinite(thresholdScore) &&
    Number.isFinite(thresholdValue);

  const classification =
    reportedClassification !== "NOT_CALIBRATED"
      ? reportedClassification
      : thresholdUsable
        ? thresholdScore >= thresholdValue
          ? "BONAFIDE"
          : "SPOOF"
        : "NOT_CALIBRATED";

  const knownClass = [
    "GENUINE",
    "BONAFIDE",
    "SPOOF",
    "FAKE",
    "CLONED",
    "SYNTHETIC",
  ].includes(classification);

  const spoof = [
    "SPOOF",
    "FAKE",
    "CLONED",
    "SYNTHETIC",
  ].includes(classification);

  const meanScore =
    result?.mean_bona_fide_score ?? result?.score;

  const medianScore = result?.median_bona_fide_score;

  const nav = [
    ["dashboard", House, "Dashboard"],
    ["analyze", AudioLines, "Analyze Audio"],
    ["insights", BarChart3, "Detection Insights"],
    ["uploads", FileAudio, "My Uploads"],
    ["profile", UserRound, "Profile"],
  ];

  function openRecord(item) {
    setSelectedRecord(item);
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
      >
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
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="nav-list">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              className={`nav-link ${
                page === id ? "nav-selected" : ""
              }`}
              onClick={() => navigate(id)}
              type="button"
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="privacy-card">
          <div className="privacy-heading">
            <ShieldCheck size={23} />
            <strong>Privacy First</strong>
          </div>
          <p>Your audio is processed by your local AI services.</p>
          <span className="local-status">
            <i />
            Local Services
          </span>
        </div>

        <div className="account-card">
          <div className="account-avatar">
            {user ? (
              (user.name || user.email || "U")
                .slice(0, 1)
                .toUpperCase()
            ) : (
              <UserRound size={20} />
            )}
          </div>

          <div className="account-details">
            <strong>
              {user ? userDisplayName(user) : "Guest User"}
            </strong>
            <span>{user?.email || "Sign in to save uploads"}</span>
          </div>

          {user ? (
            <button
              className="icon-button"
              onClick={logout}
              title="Sign out"
              type="button"
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
              type="button"
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
          type="button"
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
            type="button"
          >
            ☰
          </button>

          <div className="topbar-spacer" />

          <div
            className={`online-pill ${
              serviceStatus.includes("Failed")
                ? "offline-pill"
                : ""
            }`}
          >
            <i />
            {serviceStatus}
          </div>

          <button
            className="help-button"
            onClick={() =>
              setNotice(
                "Choose an audio file and run AASIST analysis. Model scores are not calibrated probabilities.",
              )
            }
            type="button"
          >
            <HelpCircle size={20} />
            Help
          </button>

          {user ? (
            <button
              className="sign-button"
              onClick={logout}
              type="button"
            >
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
              type="button"
            >
              <LogIn size={17} />
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
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <>
              <section className="metrics-row">
                <Metric
                  icon={Files}
                  tone="lavender"
                  label="Total Uploads"
                  value={user ? uploadedCount : "—"}
                  caption="Saved audio files"
                />
                <Metric
                  icon={FileCheck2}
                  tone="mint"
                  label="Analyzed Files"
                  value={user ? analyzedCount : "—"}
                  caption="Files with saved scores"
                />
                <Metric
                  icon={BarChart3}
                  tone="gold"
                  label="Average Score"
                  value={user ? averageScore : "—"}
                  caption="Model score; not a probability"
                />
                <Metric
                  icon={Clock3}
                  tone="blue"
                  label="Service Status"
                  value={
                    serviceStatus.includes("Online")
                      ? "Online"
                      : "Check"
                  }
                  caption="FastAPI + Spring Boot"
                  green={serviceStatus.includes("Online")}
                />
              </section>

              <div className="dashboard-grid">
                <section className="card dashboard-card">
                  <div className="section-heading">
                    <div>
                      <h2>Detection Status Overview</h2>
                      <p>Saved file status from your account</p>
                    </div>
                  </div>

                  <div className="status-overview">
                    <div
                      className="status-donut"
                      style={{
                        "--analyzed-ratio": `${
                          uploadedCount
                            ? (analyzedCount / uploadedCount) * 100
                            : 0
                        }%`,
                      }}
                    >
                      <div>
                        <strong>{uploadedCount}</strong>
                        <span>Total files</span>
                      </div>
                    </div>

                    <div className="status-legend">
                      <div>
                        <i className="legend-blue" />
                        <span>Analyzed</span>
                        <strong>{analyzedCount}</strong>
                      </div>
                      <div>
                        <i className="legend-orange" />
                        <span>Awaiting analysis</span>
                        <strong>{pendingCount}</strong>
                      </div>
                      <div>
                        <i className="legend-purple" />
                        <span>Not calibrated</span>
                        <strong>{notCalibratedCount}</strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="card dashboard-card">
                  <div className="section-heading">
                    <div>
                      <h2>Recent Activity</h2>
                      <p>Your latest saved recordings</p>
                    </div>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => navigate("insights")}
                    >
                      View insights →
                    </button>
                  </div>

                  <AudioTable
                    items={history.slice(0, 4)}
                    showAnalysis
                    onView={openRecord}
                  />

                  {!user && (
                    <p className="muted-note">
                      Sign in to view recordings saved to your account.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}

          {/* ANALYZE AUDIO */}
          {page === "analyze" && (
            <>
              <section className="metrics-row">
                <Metric
                  icon={FileAudio}
                  tone="lavender"
                  label="Total Analyses"
                  value={user ? analyzedCount : "—"}
                  caption="Saved analyzed recordings"
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
                    serviceStatus.includes("Online")
                      ? "Online"
                      : "Check"
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
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      pickFile(event.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInput.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        fileInput.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={fileInput}
                      type="file"
                      hidden
                      accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.mp4,.aac,.webm,.opus,.oga,.aiff,.aif,.aifc"
                      onChange={(event) =>
                        pickFile(event.target.files?.[0])
                      }
                    />

                    <UploadCloud size={56} strokeWidth={1.7} />
                    <strong>
                      {file
                        ? "Audio file selected"
                        : "Drag and drop an audio file here"}
                    </strong>
                    <span>
                      {file ? file.name : "or click to browse"}
                    </span>

                    {!file && (
                      <button
                        className="choose-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInput.current?.click();
                        }}
                      >
                        <FileAudio size={18} />
                        Choose File
                      </button>
                    )}

                    <small>
                      Supports: WAV, MP3, FLAC, OGG, M4A, AAC, WebM, OPUS, AIFF, AIF, AIFC
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
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      <Check className="selected-check" size={21} />
                      <button
                        className="icon-button"
                        onClick={resetAnalysis}
                        aria-label="Remove file"
                        type="button"
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
                    onClick={() => {
                      console.log("Run AI Analysis clicked");
                      console.log("Selected file:", file);
                      analyze();
                    }}
                    disabled={!file || busy}
                    type="button"
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
                      type="button"
                    >
                      <RefreshCw size={17} />
                      Reset
                    </button>
                  </div>

                  {!result && !busy && (
                    <EmptyState
                      icon={Gauge}
                      title="Results will appear here"
                      description="Upload a recording and run the analysis to view model scores and segment details."
                    />
                  )}

                  {busy && (
                    <EmptyState
                      icon={Activity}
                      title="Analyzing your recording"
                      description="AASIST is processing the audio. Larger files can take longer."
                    />
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
                                ? "Likely AI-CLONED"
                                : "Likely REAL HUMAN VOICE"
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
                                            28 + (Number(value) + 4) * 8,
                                          ),
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

          {/* DETECTION INSIGHTS */}
          {page === "insights" && (
            <>
              <section className="metrics-row">
                <Metric
                  icon={FileCheck2}
                  tone="lavender"
                  label="Total Analyses"
                  value={user ? analyzedCount : "—"}
                  caption="Files with saved model scores"
                />
                <Metric
                  icon={Activity}
                  tone="mint"
                  label="Not Calibrated"
                  value={user ? notCalibratedCount : "—"}
                  caption="Awaiting a validated threshold"
                />
                <Metric
                  icon={BarChart3}
                  tone="gold"
                  label="Average Score"
                  value={user ? averageScore : "—"}
                  caption="Mean of saved scores; not probabilities"
                />
                <Metric
                  icon={Gauge}
                  tone="blue"
                  label="Average Segments"
                  value={user ? averageSegments : "—"}
                  caption="Across records with segment data"
                />
              </section>

              {!user ? (
                <section className="card">
                  <EmptyState
                    icon={BarChart3}
                    title="Sign in to view your insights"
                    description="Detection insights are calculated from analysis results saved to your account."
                    action={
                      <button
                        className="choose-button"
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          setAuthOpen(true);
                        }}
                      >
                        Sign In
                      </button>
                    }
                  />
                </section>
              ) : historyBusy ? (
                <section className="card">
                  <EmptyState
                    icon={Activity}
                    title="Loading insights"
                    description="Retrieving your saved analysis data."
                  />
                </section>
              ) : (
                <div className="insights-grid">
                  <section className="card insights-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Score Trend</h2>
                        <p>
                          Mean bona-fide scores from saved analyses
                        </p>
                      </div>
                    </div>

                    {insightsScores.length ? (
                      <div className="trend-list">
                        {insightsScores.map((item, index) => {
                          const scores = insightsScores.map(
                            (entry) => entry.score,
                          );
                          const min = Math.min(...scores);
                          const max = Math.max(...scores);

                          const width =
                            max === min
                              ? 58
                              : 15 +
                                ((item.score - min) / (max - min)) * 75;

                          return (
                            <div
                              className="trend-row"
                              key={item.id ?? `${item.name}-${index}`}
                            >
                              <div className="trend-label">
                                <span>{item.name}</span>
                                <small>{dayText(item.date)}</small>
                              </div>

                              <div className="trend-track">
                                <i style={{ width: `${width}%` }} />
                              </div>

                              <strong>{scoreText(item.score)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState
                        icon={BarChart3}
                        title="No scores to chart"
                        description="Complete an analysis while signed in to build your score trend."
                      />
                    )}
                  </section>

                  <section className="card insights-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Score Distribution</h2>
                        <p>Distribution of saved mean scores</p>
                      </div>
                    </div>

                    {savedScores.length ? (
                      <div className="distribution-chart">
                        {[
                          {
                            label: "Below 0",
                            count: savedScores.filter((v) => v < 0).length,
                          },
                          {
                            label: "0 to 1",
                            count: savedScores.filter(
                              (v) => v >= 0 && v < 1,
                            ).length,
                          },
                          {
                            label: "1 to 2",
                            count: savedScores.filter(
                              (v) => v >= 1 && v < 2,
                            ).length,
                          },
                          {
                            label: "2 and above",
                            count: savedScores.filter((v) => v >= 2).length,
                          },
                        ].map((bucket) => (
                          <div
                            className="distribution-column"
                            key={bucket.label}
                          >
                            <div className="distribution-bar-wrap">
                              <i
                                style={{
                                  height: `${
                                    Math.max(
                                      4,
                                      (bucket.count / savedScores.length) * 100,
                                    )
                                  }%`,
                                }}
                              />
                            </div>
                            <strong>{bucket.count}</strong>
                            <span>{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={BarChart3}
                        title="No saved scores"
                        description="Distribution will appear after your first saved analysis."
                      />
                    )}

                    <p className="chart-note">
                      These are raw model scores, not calibrated probabilities.
                    </p>
                  </section>

                  <section className="card insights-panel">
                    <div className="section-heading">
                      <div>
                        <h2>File Type Distribution</h2>
                        <p>Formats present in your uploads</p>
                      </div>
                    </div>

                    {formats.length ? (
                      <div className="format-list">
                        {formats.map((format) => (
                          <div className="format-row" key={format.name}>
                            <span>{format.name}</span>
                            <div className="format-track">
                              <i
                                style={{
                                  width: `${
                                    (format.count /
                                      Math.max(uploadedCount, 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                            <strong>{format.count}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={FileAudio}
                        title="No uploaded files"
                        description="Upload records will appear in this breakdown."
                      />
                    )}
                  </section>

                  <section className="card insights-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Analysis Status</h2>
                        <p>Saved upload and analysis state</p>
                      </div>
                    </div>

                    <div className="status-breakdown">
                      <div>
                        <i className="legend-blue" />
                        <span>Analyzed</span>
                        <strong>{analyzedCount}</strong>
                      </div>
                      <div>
                        <i className="legend-orange" />
                        <span>Uploaded only</span>
                        <strong>{pendingCount}</strong>
                      </div>
                      <div>
                        <i className="legend-purple" />
                        <span>Not calibrated</span>
                        <strong>{notCalibratedCount}</strong>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

          {/* MY UPLOADS */}
          {page === "uploads" && (
            <section className="card uploads-page">
              <div className="section-heading uploads-heading">
                <div>
                  <h2>Uploaded Audio Files</h2>
                  <p>
                    Browse and manage the recordings saved to your account.
                  </p>
                </div>

                <button
                  className="choose-button"
                  type="button"
                  onClick={() => navigate("analyze")}
                >
                  <UploadCloud size={17} />
                  Upload Audio
                </button>
              </div>

              {!user ? (
                <EmptyState
                  icon={Files}
                  title="Sign in to view your uploads"
                  description="Files are associated with your account after you sign in."
                  action={
                    <button
                      className="choose-button"
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthOpen(true);
                      }}
                    >
                      Sign In
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="uploads-toolbar">
                    <label className="search-control">
                      <Search size={17} />
                      <input
                        value={uploadSearch}
                        onChange={(event) =>
                          setUploadSearch(event.target.value)
                        }
                        placeholder="Search by filename..."
                      />
                    </label>

                    <label className="select-control">
                      <SlidersHorizontal size={16} />
                      <select
                        value={uploadFormat}
                        onChange={(event) =>
                          setUploadFormat(event.target.value)
                        }
                      >
                        <option value="ALL">All formats</option>
                        <option value="audio/mpeg">MP3 / MPEG</option>
                        <option value="audio/wav">WAV</option>
                        <option value="audio/ogg">OGG</option>
                        <option value="audio/mp4">M4A / MP4</option>
                        <option value="audio/webm">WEBM</option>
                      </select>
                    </label>

                    <label className="select-control">
                      <select
                        value={uploadStatus}
                        onChange={(event) =>
                          setUploadStatus(event.target.value)
                        }
                      >
                        <option value="ALL">All statuses</option>
                        <option value="ANALYZED">Analyzed</option>
                        <option value="UPLOADED">Uploaded</option>
                      </select>
                    </label>

                    <button
                      className="reset-button"
                      type="button"
                      onClick={refreshHistory}
                      disabled={historyBusy}
                    >
                      <RefreshCw size={16} />
                      Refresh
                    </button>
                  </div>

                  {historyBusy ? (
                    <EmptyState
                      icon={Activity}
                      title="Loading your uploads"
                      description="Retrieving files saved to your account."
                    />
                  ) : (
                    <>
                      <AudioTable
                        items={filteredUploads}
                        showAnalysis={false}
                        onView={openRecord}
                      />

                      <div className="table-footer">
                        <span>
                          Showing {filteredUploads.length} of {history.length} files
                        </span>
                        <span>Files are shown newest first.</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {/* PROFILE */}
          {page === "profile" && (
            <div className="profile-grid">
              <section className="card profile-card">
                <div className="profile-card-heading">
                  <div className="profile-avatar">
                    {user ? (
                      (user.name || user.email || "U")
                        .slice(0, 1)
                        .toUpperCase()
                    ) : (
                      <UserRound size={30} />
                    )}
                  </div>

                  <div>
                    <h2>{user ? userDisplayName(user) : "Guest User"}</h2>
                    <p>{user?.email || "Sign in to access account details"}</p>
                    <StatusPill
                      status={user ? "ACCOUNT ACTIVE" : "GUEST SESSION"}
                    />
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <h2>Account Information</h2>
                    <p>Your account profile</p>
                  </div>
                </div>

                <div className="profile-info-list">
                  <div>
                    <UserRound size={18} />
                    <span>Full name</span>
                    <strong>
                      {user
                        ? userFullName(user) || userDisplayName(user)
                        : "Not signed in"}
                    </strong>
                  </div>

                  <div>
                    <HelpCircle size={18} />
                    <span>Email address</span>
                    <strong>{user?.email || "Not signed in"}</strong>
                  </div>

                  <div>
                    <ShieldCheck size={18} />
                    <span>Authentication</span>
                    <strong>{user ? "Signed in" : "Guest"}</strong>
                  </div>
                </div>

                {!user && (
                  <button
                    className="choose-button"
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthOpen(true);
                    }}
                  >
                    Sign In / Register
                  </button>
                )}
              </section>

              <section className="card profile-card">
                <div className="section-heading">
                  <div>
                    <h2>Usage Statistics</h2>
                    <p>Summary based on saved account data</p>
                  </div>
                </div>

                <div className="profile-stats">
                  <Metric
                    icon={Files}
                    tone="lavender"
                    label="Total Uploads"
                    value={user ? uploadedCount : "—"}
                    caption="Saved files"
                  />
                  <Metric
                    icon={FileCheck2}
                    tone="mint"
                    label="Analyzed Files"
                    value={user ? analyzedCount : "—"}
                    caption="With model scores"
                  />
                  <Metric
                    icon={BarChart3}
                    tone="gold"
                    label="Average Score"
                    value={user ? averageScore : "—"}
                    caption="Not a probability"
                  />
                </div>
              </section>

              <section className="card profile-card account-actions">
                <div className="section-heading">
                  <div>
                    <h2>Account Actions</h2>
                    <p>Manage your current session</p>
                  </div>
                </div>

                {user ? (
                  <button
                    className="sign-button sign-out-wide"
                    type="button"
                    onClick={logout}
                  >
                    <LogOut size={17} />
                    Sign Out
                  </button>
                ) : (
                  <button
                    className="choose-button"
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthOpen(true);
                    }}
                  >
                    <LogIn size={17} />
                    Sign In
                  </button>
                )}

                <p className="chart-note">
                  The profile uses the account fields returned by your
                  current login response.
                </p>
              </section>
            </div>
          )}

          <footer className="footer">
            <span>VOXGUARD · AI VOICE DETECTION</span>
            <span>Privacy first · AASIST anti-spoofing</span>
          </footer>
        </div>
      </main>

      {selectedRecord && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRecord(null);
            }
          }}
        >
          <section className="record-modal">
            <button
              className="icon-button modal-close"
              type="button"
              onClick={() => setSelectedRecord(null)}
              aria-label="Close details"
            >
              <X size={20} />
            </button>

            <div className="eyebrow-blue">RECORDING DETAILS</div>
            <h2>{audioName(selectedRecord)}</h2>
            <p>Saved upload and analysis fields returned by the backend.</p>

            <div className="record-details">
              <div>
                <span>Upload date</span>
                <strong>
                  {dateText(
                    selectedRecord.uploadedAt ||
                      selectedRecord.uploaded_at,
                  )}
                </strong>
              </div>

              <div>
                <span>File type</span>
                <strong>
                  {selectedRecord.contentType ||
                    selectedRecord.content_type ||
                    "Audio"}
                </strong>
              </div>

              <div>
                <span>File size</span>
                <strong>
                  {formatBytes(
                    selectedRecord.fileSize ??
                      selectedRecord.file_size,
                  )}
                </strong>
              </div>

              <div>
                <span>Detection status</span>
                <strong>
                  <StatusPill status={normalizedStatus(selectedRecord)} />
                </strong>
              </div>

              <div>
                <span>Mean score</span>
                <strong>
                  {scoreText(
                    selectedRecord.meanBonaFideScore ??
                      selectedRecord.mean_bona_fide_score,
                  )}
                </strong>
              </div>

              <div>
                <span>Median score</span>
                <strong>
                  {scoreText(
                    selectedRecord.medianBonaFideScore ??
                      selectedRecord.median_bona_fide_score,
                  )}
                </strong>
              </div>

              <div>
                <span>Segments analyzed</span>
                <strong>
                  {selectedRecord.segmentsAnalyzed ??
                    selectedRecord.segments_analyzed ??
                    "—"}
                </strong>
              </div>

              <div>
                <span>Analyzed at</span>
                <strong>
                  {dateText(
                    selectedRecord.analyzedAt ||
                      selectedRecord.analyzed_at,
                  )}
                </strong>
              </div>
            </div>

            <p className="chart-note">
              Scores are raw model outputs, not calibrated probabilities.
              The current interface does not expose an audio playback
              or download endpoint.
            </p>

            <button
              className="reset-button"
              type="button"
              onClick={() => setSelectedRecord(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={(account) => {
            setUser(account);
            setNotice(
              `Signed in${account.email ? ` as ${account.email}` : ""}.`,
            );
            refreshHistory();
          }}
        />
      )}
    </div>
  );
}
