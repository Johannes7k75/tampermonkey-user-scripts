import { GM_download, GM_log, GM_registerMenuCommand } from "$";
import "./styles.css";
import {
  type AppConfig,
  type Counters,
  DEFAULT_CONFIG,
  loadConfig,
  loadCounters,
  resetCounters,
  saveConfig,
  saveCounters,
  TOKENS,
  type Token,
} from "./config";

// Module-level state — loaded once from GM storage at script start
const CONFIG: AppConfig = loadConfig();
const counters: Counters = loadCounters();

GM_log("JVC: loaded config", CONFIG);
GM_log("JVC: loaded counters", counters);

GM_registerMenuCommand("JVC: Reset counters", () => {
  resetCounters();
  counters.snapshot = 1;
  counters.video = 1;
  GM_log("JVC: counters reset to 1");
});

GM_registerMenuCommand("JVC: Stop all recordings", () => {
  stopAllSessions();
});

GM_registerMenuCommand("JVC: Set video template", () => {
  const next = prompt(
    `Video filename template.\n${tokensHint()}\nFor token descriptions use the Settings panel (⚙️).`,
    CONFIG.videoTemplate,
  );
  if (next === null) return;
  CONFIG.videoTemplate = next.trim();
  saveConfig(CONFIG);
  GM_log("JVC: video template →", CONFIG.videoTemplate);
});

GM_registerMenuCommand("JVC: Set snap template", () => {
  const next = prompt(
    `Snapshot filename template.\n${tokensHint()}\nFor token descriptions use the Settings panel (⚙️).`,
    CONFIG.snapTemplate,
  );
  if (next === null) return;
  CONFIG.snapTemplate = next.trim();
  saveConfig(CONFIG);
  GM_log("JVC: snap template →", CONFIG.snapTemplate);
});

GM_registerMenuCommand("JVC: Set image format", () => {
  const choice = prompt("Image format. Enter 'png' or 'jpg'.", CONFIG.imageExt);
  if (choice === null) return;
  const lower = choice.trim().toLowerCase();
  if (lower !== "png" && lower !== "jpg") {
    alert("Invalid format. Use 'png' or 'jpg'.");
    return;
  }
  CONFIG.imageFormat = lower === "png" ? "image/png" : "image/jpeg";
  CONFIG.imageExt = lower;
  saveConfig(CONFIG);
  GM_log("JVC: image format →", CONFIG.imageFormat);
});

GM_registerMenuCommand("JVC: Reset config to defaults", () => {
  Object.assign(CONFIG, DEFAULT_CONFIG);
  saveConfig(CONFIG);
  GM_log("JVC: config reset to defaults", CONFIG);
});

GM_registerMenuCommand("JVC: Open settings panel", () => openSettings());

GM_registerMenuCommand("JVC: Set snapshot subfolder", () => {
  // Tampermonkey's GM_download routes to a path inside the browser's default Downloads
  // directory. Forward slashes create subfolders (e.g. "Jitsi/Snapshots/{room}").
  // Leave empty to use the browser default (no subfolder).
  const next = prompt(
    "Subfolder inside browser Downloads for snapshots.\n" +
      "Use forward slashes for nesting. Examples: 'Jitsi/Snapshots', 'work/2026'.\n" +
      "Leave empty for the default folder.",
    CONFIG.snapshotSubfolder,
  );
  if (next === null) return;
  CONFIG.snapshotSubfolder = next.trim();
  saveConfig(CONFIG);
  GM_log("JVC: snapshot subfolder →", JSON.stringify(CONFIG.snapshotSubfolder));
});

GM_registerMenuCommand("JVC: Set recording subfolder", () => {
  const next = prompt(
    "Subfolder inside browser Downloads for recordings.\n" +
      "Use forward slashes for nesting. Examples: 'Jitsi/Recordings', 'work/2026'.\n" +
      "Leave empty for the default folder.",
    CONFIG.recordingSubfolder,
  );
  if (next === null) return;
  CONFIG.recordingSubfolder = next.trim();
  saveConfig(CONFIG);
  GM_log(
    "JVC: recording subfolder →",
    JSON.stringify(CONFIG.recordingSubfolder),
  );
});

// ==========================================
// Session model — keyed by participant ID, not DOM
// ==========================================

interface ActiveSession {
  participantId: string;
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  canvasStream: MediaStream;
  recorder: MediaRecorder;
  recordedChunks: Blob[];
  rafHandle: number;
  timerInterval: ReturnType<typeof setInterval>;
  elapsedSeconds: number;
  activeVideo: HTMLVideoElement | null;
}

const activeSessions = new Map<string, ActiveSession>();
const participantIdCache = new WeakMap<HTMLVideoElement, string>();

function getParticipantId(video: HTMLVideoElement): string {
  const cached = participantIdCache.get(video);
  if (cached !== undefined) return cached;

  let el: HTMLElement | null = video;
  while (el) {
    if (el.id) {
      if (el.id.includes("participant_")) {
        participantIdCache.set(video, el.id);
        return el.id;
      }
      if (el.id === "largeVideo") {
        participantIdCache.set(video, "largeVideo");
        return "largeVideo";
      }
    }
    el = el.parentElement;
  }

  // Fallback: stable per-video. Sibling-index-based so two different videos
  // that both lack an ancestor ID still get distinct IDs; the same video
  // always gets the same ID (cached above on subsequent calls).
  let fallback = video.id;
  if (!fallback) {
    let n = 0;
    let sib: Element | null = video.previousElementSibling;
    while (sib) {
      n++;
      sib = sib.previousElementSibling;
    }
    fallback = `video-fallback-${n}`;
  }
  participantIdCache.set(video, fallback);
  return fallback;
}

function createSession(
  participantId: string,
  video: HTMLVideoElement,
): ActiveSession {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const canvasCtx = canvas.getContext("2d", { alpha: false })!;
  return {
    participantId,
    canvas,
    canvasCtx,
    canvasStream: null as unknown as MediaStream,
    recorder: null as unknown as MediaRecorder,
    recordedChunks: [],
    rafHandle: 0,
    timerInterval: 0 as unknown as ReturnType<typeof setInterval>,
    elapsedSeconds: 0,
    activeVideo: video,
  };
}

function startRenderLoop(session: ActiveSession): void {
  const loop = (): void => {
    const video = session.activeVideo;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      if (session.canvas.width !== video.videoWidth) {
        session.canvas.width = video.videoWidth;
      }
      if (session.canvas.height !== video.videoHeight) {
        session.canvas.height = video.videoHeight;
      }
      try {
        session.canvasCtx.drawImage(
          video,
          0,
          0,
          session.canvas.width,
          session.canvas.height,
        );
      } catch {
        // CORS / not-ready — keep last frame as standby
      }
    }
    session.rafHandle = requestAnimationFrame(loop);
  };
  session.rafHandle = requestAnimationFrame(loop);
}

function formatSeconds(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  if (hours > 0) return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function resolveTemplate(
  template: string,
  index: number,
  videoId: string | undefined,
): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const indexStr = String(index).padStart(3, "0");
  return template
    .replace("{room}", getRoomName())
    .replace("{date}", dateStr)
    .replace("{time}", timeStr)
    .replace("{index}", indexStr)
    .replace("{id}", videoId ?? "feed");
}

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

function fallbackDownload(fileName: string, url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}

function saveBlob(blob: Blob, subfolder: string, fileName: string): void {
  const targetName = subfolder ? `${subfolder}/${fileName}` : fileName;
  const url = URL.createObjectURL(blob);
  const cleanup = (): void => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // already revoked; safe to ignore
    }
  };

  if (typeof GM_download === "function") {
    try {
      // Tampermonkey fires onload once the download is queued. The 30-minute
      // backstop covers queued downloads of long recordings (90-min lectures
      // can produce 500MB+ WebM files that take a while to write).
      GM_download({ url, name: targetName, saveAs: false, onload: cleanup });
    } catch (err) {
      console.warn("JVC: GM_download threw, falling back to anchor:", err);
      fallbackDownload(fileName, url);
    }
  } else {
    fallbackDownload(fileName, url);
  }
  setTimeout(cleanup, 30 * 60 * 1000);
}

// ==========================================
// Settings panel
// ==========================================

interface FieldDef {
  key: keyof AppConfig;
  label: string;
  hint?: string;
  type: "template" | "text" | "select";
  options?: Array<{ value: string; label: string }>;
}

const TEMPLATE_HINT =
  "Click a token below to insert at the caret. Backspace removes the whole token. Typing '{' opens a list of all tokens.";

const SETTINGS_FIELDS: FieldDef[] = [
  {
    key: "videoTemplate",
    label: "Video filename template",
    hint: TEMPLATE_HINT,
    type: "template",
  },
  {
    key: "snapTemplate",
    label: "Snapshot filename template",
    hint: TEMPLATE_HINT,
    type: "template",
  },
  {
    key: "snapshotSubfolder",
    label: "Snapshot subfolder",
    hint: "Subpath inside browser Downloads. Forward slashes for nesting.",
    type: "text",
  },
  {
    key: "recordingSubfolder",
    label: "Recording subfolder",
    hint: "Subpath inside browser Downloads. Forward slashes for nesting.",
    type: "text",
  },
  {
    key: "imageExt",
    label: "Image format",
    type: "select",
    options: [
      { value: "png", label: "PNG" },
      { value: "jpg", label: "JPG" },
    ],
  },
];

function closeSettings(): void {
  document.getElementById("jvc-settings")?.remove();
}

function tokensHint(): string {
  return `Tokens: ${TOKENS.map((t) => `{${t.name}}`).join(" ")}`;
}

// ==========================================
// Template editor helpers (badge click, autocomplete, token-aware backspace)
// ==========================================

function insertAtCursor(input: HTMLInputElement, text: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const caret = start + text.length;
  input.selectionStart = input.selectionEnd = caret;
  input.focus();
}

function handleTokenBackspace(input: HTMLInputElement): boolean {
  const cursor = input.selectionStart ?? 0;
  const anchor = input.selectionEnd ?? 0;
  if (cursor !== anchor) return false; // active selection — let normal delete handle it
  const before = input.value.slice(0, cursor);
  const m = before.match(/\{[a-zA-Z]+\}$/);
  if (!m) return false;
  const tokenLength = m[0].length;
  input.value = input.value.slice(0, cursor - tokenLength) + input.value.slice(cursor);
  const caret = cursor - tokenLength;
  input.selectionStart = input.selectionEnd = caret;
  return true;
}

function renderAutocomplete(
  input: HTMLInputElement,
  container: HTMLElement,
  matches: Token[],
  activeIndex: number,
): void {
  container.innerHTML = "";
  for (let i = 0; i < matches.length; i++) {
    const token = matches[i]!;
    const item = el("button", {
      className: "jvc-autocomplete-item",
      text: `{${token.name}}`,
      title: token.description,
    });
    item.type = "button";
    if (i === activeIndex) item.classList.add("jvc-autocomplete-item--active");
    item.addEventListener("mousedown", (e) => {
      // mousedown (not click) so we beat the input's blur handler
      e.preventDefault();
      applyTokenChoice(input, container, token);
    });
    container.appendChild(item);
  }
  container.hidden = matches.length === 0;
}

function applyTokenChoice(
  input: HTMLInputElement,
  container: HTMLElement,
  token: Token,
): void {
  const cursor = input.selectionStart ?? 0;
  const before = input.value.slice(0, cursor);
  const partial = before.match(/\{([a-zA-Z]*)$/);
  const prefix = partial?.[1] ?? "";
  const beforeMatch = cursor - prefix.length - 1; // -1 for `{`
  const after = input.value.slice(cursor);
  const replacement = `{${token.name}}`;
  input.value = input.value.slice(0, beforeMatch) + replacement + after;
  const caret = beforeMatch + replacement.length;
  input.selectionStart = input.selectionEnd = caret;
  container.hidden = true;
  input.focus();
}

function scrollItemIntoView(container: HTMLElement, item: HTMLElement): void {
  const itemTop = item.offsetTop;
  const itemBottom = itemTop + item.offsetHeight;
  const viewTop = container.scrollTop;
  const viewBottom = viewTop + container.clientHeight;
  if (itemTop < viewTop) container.scrollTop = itemTop;
  else if (itemBottom > viewBottom) container.scrollTop = itemBottom - container.clientHeight;
}

function updateAutocomplete(
  input: HTMLInputElement,
  container: HTMLElement,
  activeIndex: number,
): void {
  const cursor = input.selectionStart ?? 0;
  const before = input.value.slice(0, cursor);
  const partial = before.match(/\{([a-zA-Z]*)$/);
  if (!partial) {
    container.hidden = true;
    return;
  }
  const prefix = partial[1] ?? "";
  const matches = TOKENS.filter((t) => t.name.toLowerCase().startsWith(prefix.toLowerCase()));
  renderAutocomplete(input, container, matches, activeIndex);
}

function buildTemplateRow(
  field: FieldDef,
  currentValue: string,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = el("div", { className: "jvc-settings-row" });
  row.appendChild(el("label", { className: "jvc-settings-label", text: field.label }));

  const input = el("input", { className: "jvc-settings-input" });
  (input as HTMLInputElement).type = "text";
  input.value = currentValue;
  row.appendChild(input);

  // Clickable token badges — single click → insert at caret
  const badgesRow = el("div", { className: "jvc-token-badges" });
  for (const token of TOKENS) {
    const badge = el("button", {
      className: "jvc-token-badge",
      text: `{${token.name}}`,
      title: token.description,
    });
    badge.type = "button";
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      insertAtCursor(input, `{${token.name}}`);
      activeIndex = 0;
      updateAutocomplete(input, autocomplete, activeIndex);
    });
    badgesRow.appendChild(badge);
  }
  row.appendChild(badgesRow);

  // Autocomplete dropdown — anchored to the row, hidden by default
  const autocomplete = el("div", { className: "jvc-autocomplete" });
  autocomplete.hidden = true;
  row.appendChild(autocomplete);

  // Active item in the dropdown — drives ArrowUp / ArrowDown / Enter behavior
  let activeIndex = 0;

  function setActiveIndex(next: number): void {
    const items = autocomplete.children;
    if (items.length === 0) return;
    const len = items.length;
    const wrapped = ((next % len) + len) % len; // true modulo (handles negatives)
    for (let i = 0; i < len; i++) {
      items[i].classList.toggle("jvc-autocomplete-item--active", i === wrapped);
    }
    activeIndex = wrapped;
    scrollItemIntoView(autocomplete, items[wrapped] as HTMLElement);
  }

  // Token-aware backspace + Esc-to-close + ArrowUp/Down/Enter for autocomplete
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace") {
      if (handleTokenBackspace(input)) {
        e.preventDefault();
        activeIndex = 0;
        updateAutocomplete(input, autocomplete, activeIndex);
      }
      return;
    }
    if (e.key === "Escape") {
      if (!autocomplete.hidden) {
        autocomplete.hidden = true;
        e.preventDefault();
      }
      return;
    }
    if (autocomplete.hidden) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(activeIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = autocomplete.children[activeIndex] as HTMLButtonElement | null;
      active?.dispatchEvent(new MouseEvent("mousedown"));
    }
  });

  input.addEventListener("input", () => {
    activeIndex = 0;
    updateAutocomplete(input, autocomplete, activeIndex);
  });

  // Close the dropdown when focus leaves the row
  input.addEventListener("blur", () => {
    setTimeout(() => {
      autocomplete.hidden = true;
      activeIndex = 0;
    }, 150);
  });

  return { row, input };
}

function openSettings(): void {
  if (document.getElementById("jvc-settings")) return;

  const overlay = el("div", { className: "jvc-settings-overlay" });
  overlay.id = "jvc-settings";

  const panel = el("div", { className: "jvc-settings-panel" });

  const closeBtn = el("button", {
    className: "jvc-settings-close",
    text: "✕",
    title: "Close",
  });
  closeBtn.addEventListener("click", closeSettings);

  const header = el("div", { className: "jvc-settings-header" });
  header.append(createH3("📹 JVC Settings", "jvc-settings-title"), closeBtn);

  const body = el("div", { className: "jvc-settings-body" });
  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};

  for (const field of SETTINGS_FIELDS) {
    let input: HTMLInputElement | HTMLSelectElement;
    let row: HTMLElement;

    if (field.type === "template") {
      const built = buildTemplateRow(field, String(CONFIG[field.key]));
      row = built.row;
      input = built.input;
    } else {
      row = el("div", { className: "jvc-settings-row" });
      row.appendChild(el("label", { className: "jvc-settings-label", text: field.label }));
      if (field.type === "select" && field.options) {
        input = el("select", { className: "jvc-settings-input" });
        for (const opt of field.options) {
          const optEl = el("option", { text: opt.label });
          (optEl as HTMLOptionElement).value = opt.value;
          input.appendChild(optEl);
        }
      } else {
        input = el("input", { className: "jvc-settings-input" });
        (input as HTMLInputElement).type = "text";
      }
      input.value = String(CONFIG[field.key]);
      row.appendChild(input);
    }

    inputs[field.key] = input;
    if (field.hint) row.appendChild(el("div", { className: "jvc-settings-hint", text: field.hint }));
    body.appendChild(row);
  }

  const resetBtn = el("button", {
    className: "jvc-settings-btn jvc-settings-btn--reset",
    text: "Reset to defaults",
  });
  const saveBtn = el("button", {
    className: "jvc-settings-btn jvc-settings-btn--save",
    text: "Save",
  });

  resetBtn.addEventListener("click", () => {
    Object.assign(CONFIG, DEFAULT_CONFIG);
    saveConfig(CONFIG);
    for (const key of Object.keys(inputs)) {
      inputs[key].value = String(CONFIG[key as keyof AppConfig]);
    }
    GM_log("JVC: settings reset to defaults", CONFIG);
  });

  saveBtn.addEventListener("click", () => {
    for (const field of SETTINGS_FIELDS) {
      const input = inputs[field.key];
      if (!input) continue;
      const value = input.value.trim();
      if (field.key === "imageExt") {
        const ext = value as "png" | "jpg";
        CONFIG.imageExt = ext;
        CONFIG.imageFormat = ext === "png" ? "image/png" : "image/jpeg";
      } else {
        (CONFIG as unknown as Record<string, string>)[field.key] = value;
      }
    }
    saveConfig(CONFIG);
    GM_log("JVC: settings saved", CONFIG);
    closeSettings();
  });

  const footer = el("div", { className: "jvc-settings-footer" });
  footer.append(resetBtn, saveBtn);

  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSettings();
  });

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      closeSettings();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
}

function mountFloatingButton(): void {
  if (document.getElementById("jvc-fab")) return;
  if (!document.body) return;
  const fab = el("button", {
    className: "jvc-fab",
    text: "⚙️",
    title: "Jitsi Video Capture — Settings",
  });
  fab.id = "jvc-fab";
  fab.addEventListener("click", (e) => {
    e.stopPropagation();
    openSettings();
  });
  document.body.appendChild(fab);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Stop any in-flight recordings so the browser doesn't leak rAF/setInterval
    // handles while the page is unloading. The MediaRecorder onstop callbacks
    // may not get to flush in time, but we still call .stop() to release tracks.
    stopAllSessions();
  });
}

function getRoomName(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? decodeURIComponent(parts[0]) : "jitsi-room";
}

function updateToolbarState(participantId: string, recording: boolean): void {
  document
    .querySelectorAll<HTMLDivElement>(
      `[data-jvc-participant="${cssEscape(participantId)}"]`,
    )
    .forEach((toolbar) => {
      const timerDisplay = toolbar.querySelector<HTMLSpanElement>(
        ".jvc-toolbar__timer",
      );
      const recordBtn = toolbar.querySelector<HTMLButtonElement>(
        ".jvc-toolbar__btn--record",
      );
      const stopBtn = toolbar.querySelector<HTMLButtonElement>(
        ".jvc-toolbar__btn--stop",
      );
      if (!timerDisplay || !recordBtn || !stopBtn) return;
      timerDisplay.hidden = !recording;
      recordBtn.hidden = recording;
      stopBtn.hidden = !recording;
    });
}

function updateToolbarTimer(participantId: string, text: string): void {
  document
    .querySelectorAll<HTMLSpanElement>(
      `[data-jvc-participant="${cssEscape(participantId)}"] .jvc-toolbar__timer`,
    )
    .forEach((el) => {
      el.textContent = text;
    });
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function startSession(participantId: string, video: HTMLVideoElement): void {
  let session = activeSessions.get(participantId);
  if (!session) {
    session = createSession(participantId, video);
    activeSessions.set(participantId, session);
  }
  session.activeVideo = video;
  session.recordedChunks = [];
  session.elapsedSeconds = 0;

  session.canvasStream = session.canvas.captureStream(30);
  session.recorder = new MediaRecorder(session.canvasStream, {
    mimeType: "video/webm",
  });

  session.recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) {
      session.recordedChunks.push(ev.data)
    };
  };

  session.recorder.onstop = () => {
    const index = counters.video++;
    saveCounters(counters);
    const blob = new Blob(session.recordedChunks, { type: "video/webm" });
    const fileName = `${resolveTemplate(CONFIG.videoTemplate, index, session.participantId)}.webm`;
    saveBlob(blob, CONFIG.recordingSubfolder, fileName);
    session.recordedChunks = [];
  };

  startRenderLoop(session);
  session.recorder.start(1000);
  session.timerInterval = setInterval(() => {
    session.elapsedSeconds++;
    updateToolbarTimer(participantId, formatSeconds(session.elapsedSeconds));
  }, 1000);

  updateToolbarState(participantId, true);
  updateToolbarTimer(participantId, "00:00");
  GM_log("JVC: recording started", participantId);
}

function stopSession(participantId: string): void {
  const session = activeSessions.get(participantId);
  if (!session) {
    return
  };

  clearInterval(session.timerInterval);
  cancelAnimationFrame(session.rafHandle);
  if (session.recorder.state !== "inactive") {
    session.recorder.stop();
  }
  session.canvasStream.getTracks().forEach((t) => {
    t.stop();
  });
  updateToolbarState(participantId, false);
  updateToolbarTimer(participantId, "00:00");
  session.activeVideo = null;
  GM_log("JVC: recording stopped", participantId);
}

function stopAllSessions(): void {
  // Snapshot first because stopSession() doesn't remove the entry from the Map.
  for (const id of Array.from(activeSessions.keys())) {
    stopSession(id);
  }
  activeSessions.clear();
  GM_log("JVC: all recordings stopped");
}

// ==========================================
// Toolbar / DOM injection
// ==========================================

type ElOptions = {
  className?: string;
  text?: string;
  title?: string;
  hidden?: boolean;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title !== undefined) node.title = options.title;
  if (options.hidden) node.hidden = true;
  return node;
}

const createH3 = (
  text: string,
  className?: string,
  title?: string,
): HTMLHeadingElement => el("h3", { className, text, title });

function takeSnapshot(
  video: HTMLVideoElement,
  feedbackBtn: HTMLButtonElement | null,
  participantId: string,
): void {
  if (!video.videoWidth || !video.videoHeight) {
    console.warn("Video element has no active frames.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

  const index = counters.snapshot++;
  saveCounters(counters);
  const fileName = `${resolveTemplate(CONFIG.snapTemplate, index, participantId)}.${CONFIG.imageExt}`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    saveBlob(blob, CONFIG.snapshotSubfolder, fileName);

    if (feedbackBtn) {
      // Clear any in-flight feedback timeout from a prior rapid double-click so
      // the "prev" capture doesn't see the already-overwritten "✓ Saved" label.
      const existing = Number(feedbackBtn.dataset["snapFeedbackTimeout"]);
      if (existing) clearTimeout(existing);
      feedbackBtn.textContent = "✓ Saved";
      feedbackBtn.classList.add("jvc-toolbar__btn--saved");
      const handle = setTimeout(() => {
        feedbackBtn.textContent = "📸 Snap";
        feedbackBtn.classList.remove("jvc-toolbar__btn--saved");
        delete feedbackBtn.dataset["snapFeedbackTimeout"];
      }, 800);
      feedbackBtn.dataset["snapFeedbackTimeout"] = String(handle);
    }
  }, CONFIG.imageFormat);
}

function attachControls(video: HTMLVideoElement): void {
  if (video.dataset["hasCaptureSuite"] === "true") return;
  video.dataset["hasCaptureSuite"] = "true";

  const participantId = getParticipantId(video);
  const existing = activeSessions.get(participantId);

  const parent = video.parentElement;
  if (!parent) return;

  if (window.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  const toolbar = el("div", { className: "jvc-toolbar" });
  toolbar.dataset["jvcParticipant"] = participantId;

  const title = createH3(
    "📹 Capture",
    "jvc-toolbar__title",
    "Jitsi Video Capture Suite",
  );

  const timerDisplay = el("span", {
    className: "jvc-toolbar__timer",
    text: existing ? formatSeconds(existing.elapsedSeconds) : "00:00",
    hidden: !existing,
  });

  const recordBtn = el("button", {
    className: "jvc-toolbar__btn jvc-toolbar__btn--record",
    text: "● Record",
    title: "Start recording this tile",
    hidden: !!existing,
  });

  const stopBtn = el("button", {
    className: "jvc-toolbar__btn jvc-toolbar__btn--stop",
    text: "■ Stop",
    title: "Stop recording",
    hidden: !existing,
  });

  const snapBtn = el("button", {
    className: "jvc-toolbar__btn jvc-toolbar__btn--snap",
    text: "📸 Snap",
    title: "Save a screenshot of this tile",
  });

  recordBtn.onclick = (e) => {
    e.stopPropagation();
    startSession(participantId, video);
  };

  stopBtn.onclick = (e) => {
    e.stopPropagation();
    stopSession(participantId);
  };

  snapBtn.onclick = (e) => {
    e.stopPropagation();
    takeSnapshot(video, snapBtn, participantId);
  };

  toolbar.append(title, timerDisplay, recordBtn, stopBtn, snapBtn);
  parent.appendChild(toolbar);

  // If a recording was already in flight for this participant, bind the new video
  if (existing) {
    existing.activeVideo = video;
  }
}

function scanVideos(): void {
  document.querySelectorAll<HTMLVideoElement>("video").forEach((node) => {
    const participantId = getParticipantId(node);
    const session = activeSessions.get(participantId);
    if (session && session.activeVideo !== node) {
      session.activeVideo = node;
    }
    attachControls(node);
  });
}

const observer = new MutationObserver(() => scanVideos());
observer.observe(document.body, { childList: true, subtree: true });
scanVideos();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountFloatingButton, { once: true });
} else {
  mountFloatingButton();
}
