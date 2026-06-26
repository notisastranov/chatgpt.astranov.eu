import { AstranovApi } from "./astranov-api.js";

const config = window.ASTRANOV_CONFIG || {};
const api = new AstranovApi(config);
const storage = createStorage("astranov-chatgpt");
const sessionId = getSessionId();

const els = {
  body: document.body,
  cosmos: document.getElementById("cosmos"),
  orbLayer: document.getElementById("orb-layer"),
  drawer: document.getElementById("drawer"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerEyebrow: document.getElementById("drawer-eyebrow"),
  drawerClose: document.getElementById("drawer-close"),
  trayTrigger: document.getElementById("tray-trigger"),
  messages: document.getElementById("messages"),
  form: document.getElementById("composer"),
  input: document.getElementById("prompt-input"),
  send: document.getElementById("send-button"),
  clear: document.getElementById("clear-button"),
  locate: document.getElementById("locate-button"),
  brand: document.getElementById("brand-button"),
  status: document.getElementById("status-line"),
  providerLock: document.getElementById("provider-lock"),
  modeLine: document.getElementById("mode-line"),
  memoryLine: document.getElementById("memory-line"),
  sessionLine: document.getElementById("session-line"),
  orbLine: document.getElementById("orb-line"),
  export: document.getElementById("export-button"),
  focus: document.getElementById("focus-button"),
  cic: document.getElementById("cic-float"),
  cicLabel: document.getElementById("cic-label"),
  back: document.getElementById("back-button"),
  materialize: document.getElementById("materialize-button"),
  dematerialize: document.getElementById("dematerialize-button"),
  codersTrigger: document.getElementById("coders-trigger"),
  codersGrid: document.getElementById("coders-grid"),
  codersJobMeta: document.getElementById("coders-job-meta"),
  codersJobPreview: document.getElementById("coders-job-preview"),
  codersSaveJob: document.getElementById("coders-save-job"),
  codersResumeJob: document.getElementById("coders-resume-job"),
  codersClearJob: document.getElementById("coders-clear-job")
};

const panelTitles = {
  chat: ["AI in context", "AstranoV ChatGPT"],
  status: ["Collective signal", "System State"],
  actions: ["Manual foundation", "Visible Controls"],
  coders: ["AI coder labs", "Continue the job"]
};

const LABS = Array.isArray(config.labs) ? config.labs : [];
const CONTINUATION_KEY = config.continuationKey || "astranov:job-continuation";

const seedOrbs = [
  { id: "astranov", label: "Astranov", glyph: "AV", color: "#54e6ff", ring: "inner", angle: -90, use: "hi", panel: "chat" },
  { id: "aicycle", label: "AI Cycle", glyph: "AI", color: "#6df2bd", ring: "inner", angle: 22, use: "hi", panel: "status" },
  { id: "me", label: "Me", glyph: "ME", color: "#ffd166", ring: "inner", angle: 150, use: "lo", panel: "status" },
  { id: "discover", label: "Discover", glyph: "DS", color: "#ff6b9a", ring: "middle", angle: -22, use: "hi", panel: "actions" },
  { id: "pilot", label: "Pilot", glyph: "PL", color: "#8fb7ff", ring: "middle", angle: 58, use: "lo", panel: "actions" },
  { id: "wallet", label: "Wallet", glyph: "AVC", color: "#6df2bd", ring: "middle", angle: 135, use: "lo", panel: "status" },
  { id: "news", label: "News", glyph: "NW", color: "#ffd166", ring: "outer", angle: -132, use: "lo", panel: "chat" },
  { id: "work", label: "Work", glyph: "WK", color: "#54e6ff", ring: "outer", angle: 130, use: "lo", panel: "chat" },
  { id: "coders", label: "Coders", glyph: "CD", color: "#b8d4ff", ring: "outer", angle: -68, use: "hi", panel: "coders" }
];

const ringRadii = { inner: 0.185, middle: 0.295, outer: 0.405 };
const orbState = new Map();
let messages = loadMessages();
let pending = false;
let drawerTimer = 0;
let introTimer = 0;
let currentProviderIndex = 0;
let depth = 0;
let dynamicOrbId = 0;

boot();

function boot() {
  if (!messages.length) {
    messages = [
      {
        role: "assistant",
        content: "I am AstranoV on the ChatGPT route. The globe is the surface; ask, and I will materialise the useful orb or control.",
        meta: "local boot"
      }
    ];
  }

  renderMessages();
  updateStatus(api.isConfigured() ? "ROUTER READY" : "LOCAL FALLBACK");
  updateTelemetry();
  autosize();
  bindEvents();
  renderCodersHub();
  refreshJobContinuation();
  maybeResumeFromQuery();
  exposeOrbApi();
  runIntroSequence();
  window.addEventListener("resize", layoutOrbs);
}

function bindEvents() {
  els.form.addEventListener("submit", onSubmit);
  els.input.addEventListener("input", autosize);
  els.clear.addEventListener("click", clearHistory);
  els.locate.addEventListener("click", acquireLocation);
  els.brand.addEventListener("click", healAndReload);
  els.drawerClose.addEventListener("click", closeDrawer);
  els.trayTrigger.addEventListener("click", () => openDrawer("chat"));
  els.cic.addEventListener("click", cycleProvider);
  els.back.addEventListener("click", goBack);
  els.materialize.addEventListener("click", () => {
    const id = `user-${++dynamicOrbId}`;
    materializeOrb({ id, label: "Made", glyph: "MA", color: "#cde7ff", ring: "outer", source: "manual", panel: "chat", ttl: 18000 });
    addMessage({ role: "assistant", content: "Materialised a temporary orb from the planet.", meta: "manual affordance" });
  });
  els.dematerialize.addEventListener("click", () => {
    const last = [...orbState.keys()].reverse().find((id) => id.startsWith("user-"));
    if (last) dematerializeOrb(last);
  });
  els.export.addEventListener("click", exportTranscript);
  els.focus.addEventListener("click", toggleFocusMode);
  els.codersTrigger?.addEventListener("click", () => openDrawer("coders", 0));
  els.codersSaveJob?.addEventListener("click", saveJobContinuation);
  els.codersResumeJob?.addEventListener("click", resumeJobContinuation);
  els.codersClearJob?.addEventListener("click", clearJobContinuation);
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => useQuickPrompt(button.dataset.prompt || ""));
  });
  document.addEventListener("change", onProviderChange);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openDrawer("chat", 0);
      els.input.focus();
    }
  });
  addBottomSwipe();
}

function runIntroSequence() {
  clearTimeout(introTimer);
  seedOrbs.forEach((orb, index) => {
    introTimer = window.setTimeout(() => materializeOrb(orb), 260 + index * 170);
  });
  window.setTimeout(() => openDrawer("chat", 3200), 900);
}

function materializeOrb(input) {
  if (!input?.id) return null;
  const existing = orbState.get(input.id);
  const orb = existing?.element || document.createElement("button");
  const state = {
    id: input.id,
    label: input.label || input.id,
    glyph: input.glyph || input.label?.slice(0, 2).toUpperCase() || "AV",
    color: input.color || "#54e6ff",
    ring: input.ring || "middle",
    angle: Number.isFinite(input.angle) ? input.angle : Math.random() * 360,
    use: input.use || "lo",
    panel: input.panel || "chat",
    x: existing?.x,
    y: existing?.y,
    vx: 0,
    vy: 0,
    element: orb
  };

  orb.className = "orb";
  orb.type = "button";
  orb.dataset.id = state.id;
  orb.dataset.use = state.use;
  orb.style.setProperty("--orb-color", state.color);
  orb.style.setProperty("--orb-size", state.glyph.length > 2 ? "82px" : "74px");
  orb.setAttribute("aria-label", state.label);
  orb.innerHTML = `<span class="orb-glyph">${escapeHtml(state.glyph)}</span><span class="orb-label">${escapeHtml(state.label)}</span>`;

  if (!existing) {
    els.orbLayer.append(orb);
    orb.addEventListener("click", (event) => {
      if (orb.classList.contains("is-dragging")) return;
      event.stopPropagation();
      openOrb(state.id);
    });
    makeThrowableOrb(state);
  }

  orbState.set(state.id, state);
  layoutOrbs();
  updateTelemetry();

  if (input.ttl) {
    window.setTimeout(() => dematerializeOrb(state.id), input.ttl);
  }
  return state;
}

function dematerializeOrb(id) {
  const state = orbState.get(id);
  if (!state) return;
  state.element.style.opacity = "0";
  state.element.style.scale = "0.7";
  window.setTimeout(() => state.element.remove(), 220);
  orbState.delete(id);
  updateTelemetry();
}

function layoutOrbs() {
  const rect = els.cosmos.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const base = Math.min(rect.width, rect.height);

  for (const state of orbState.values()) {
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
      const radius = base * (ringRadii[state.ring] || ringRadii.middle);
      const angle = (state.angle * Math.PI) / 180;
      state.x = cx + Math.cos(angle) * radius;
      state.y = cy + Math.sin(angle) * radius;
    }
    placeOrb(state);
  }
}

function placeOrb(state) {
  state.element.style.left = `${state.x}px`;
  state.element.style.top = `${state.y}px`;
}

function openOrb(id) {
  const state = orbState.get(id);
  if (!state) return;
  if (state.panel === "coders") {
    openDrawer("coders", 0);
    return;
  }
  depth = 1;
  els.body.classList.add("has-depth");
  showDial(state);
  openDrawer(state.panel || "chat");
}

function showDial(state) {
  document.querySelectorAll(".orb-dial").forEach((dial) => dial.remove());
  const dial = document.createElement("div");
  dial.className = "orb-dial visible";
  dial.style.left = `${state.x}px`;
  dial.style.top = `${state.y}px`;

  for (let i = 0; i < 5; i += 1) {
    const dot = document.createElement("span");
    const angle = ((i / 5) * Math.PI * 2) - Math.PI / 2;
    dot.style.transform = `translate(${Math.cos(angle) * 58 - 5}px, ${Math.sin(angle) * 58 - 5}px)`;
    dial.append(dot);
  }

  els.orbLayer.append(dial);
  window.setTimeout(() => dial.remove(), 2600);
}

function makeThrowableOrb(state) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let moved = false;

  state.element.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    moved = false;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    lastT = performance.now();
    state.vx = 0;
    state.vy = 0;
    state.element.setPointerCapture(pointerId);
  });

  state.element.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const dt = Math.max(16, now - lastT);
    state.x += dx;
    state.y += dy;
    state.vx = (dx / dt) * 16;
    state.vy = (dy / dt) * 16;
    lastX = event.clientX;
    lastY = event.clientY;
    lastT = now;
    moved = moved || Math.hypot(event.clientX - startX, event.clientY - startY) > 6;
    state.element.classList.toggle("is-dragging", moved);
    placeOrb(state);
  });

  state.element.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    state.element.releasePointerCapture(event.pointerId);
    if (moved) {
      fling(state);
      window.setTimeout(() => state.element.classList.remove("is-dragging"), 80);
    }
  });
}

function fling(state) {
  const step = () => {
    const rect = els.cosmos.getBoundingClientRect();
    const size = state.element.offsetWidth || 74;
    state.x += state.vx;
    state.y += state.vy;
    state.vx *= 0.92;
    state.vy *= 0.92;

    if (state.x < size / 2 || state.x > rect.width - size / 2) state.vx *= -0.72;
    if (state.y < size / 2 || state.y > rect.height - size / 2) state.vy *= -0.72;
    state.x = clamp(state.x, size / 2, rect.width - size / 2);
    state.y = clamp(state.y, size / 2, rect.height - size / 2);
    placeOrb(state);

    if (Math.hypot(state.vx, state.vy) > 0.22) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function onSubmit(event) {
  event.preventDefault();
  if (pending) return;

  const prompt = els.input.value.trim();
  if (!prompt) return;

  els.input.value = "";
  autosize();
  addMessage({ role: "user", content: prompt });
  openDrawer("chat", 7000);
  maybeMaterializeFromPrompt(prompt);
  await askRouter(prompt);
}

async function askRouter(prompt) {
  pending = true;
  setBusy(true);
  updateStatus("TRANSMITTING");

  const provider = getProvider();
  try {
    const result = await api.ask({ prompt, messages, sessionId, provider });
    const meta = [result.provider || provider, result.model, result.latencyMs ? `${result.latencyMs}ms` : ""].filter(Boolean).join(" / ");

    addMessage({ role: "assistant", content: result.text, meta: meta || "router", action: result.action });
    materializeInsightOrb(prompt, result.text);
    applyRouterAction(result.action);
    updateStatus("ROUTER RESPONSE");
  } catch (error) {
    addMessage({ role: "assistant", content: offlineReply(prompt, error), meta: "local fallback" });
    updateStatus("LOCAL FALLBACK");
  } finally {
    pending = false;
    setBusy(false);
  }
}

function useQuickPrompt(prompt) {
  els.input.value = prompt;
  autosize();
  els.input.focus();
  openDrawer("chat", 0);
}

function materializeInsightOrb(prompt, text) {
  const source = `${prompt} ${text}`.toLowerCase();
  const found = [
    ["news", "News", "NW", "#ffd166"],
    ["wallet", "Wallet", "AVC", "#6df2bd"],
    ["pilot", "Pilot", "PL", "#8fb7ff"],
    ["work", "Work", "WK", "#54e6ff"],
    ["discover", "Discover", "DS", "#ff6b9a"]
  ].find(([id, label]) => source.includes(id) || source.includes(label.toLowerCase()));

  if (!found) return;
  const [id, label, glyph, color] = found;
  materializeOrb({ id, label, glyph, color, ring: id === "news" || id === "work" ? "outer" : "middle", panel: id === "pilot" ? "actions" : "chat", use: "hi" });
}

function maybeMaterializeFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("news")) materializeOrb({ id: "news", label: "News", glyph: "NW", color: "#ffd166", ring: "outer", panel: "chat", use: "hi" });
  if (lower.includes("wallet") || lower.includes("avc")) materializeOrb({ id: "wallet", label: "Wallet", glyph: "AVC", color: "#6df2bd", ring: "middle", panel: "status", use: "hi" });
  if (lower.includes("route") || lower.includes("drive") || lower.includes("pilot")) materializeOrb({ id: "pilot", label: "Pilot", glyph: "PL", color: "#8fb7ff", ring: "middle", panel: "actions", use: "hi" });
}

function applyRouterAction(action) {
  if (!action || typeof action !== "object") return;
  const target = action.orb || action.affordance || action.panel;
  if (typeof target === "string" && target.startsWith("#")) {
    document.querySelector(target)?.classList.add("activated");
  }
  if (action.panel) openDrawer(action.panel);
  if (action.orb) materializeOrb({ id: action.orb, label: action.orb, glyph: action.orb.slice(0, 2).toUpperCase(), ring: "outer", color: "#cde7ff", panel: action.panel || "chat" });
}

function renderMessages() {
  els.messages.innerHTML = "";
  for (const message of messages) {
    const row = document.createElement("article");
    row.className = `message ${message.role}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = message.role === "user" ? "You" : "AstranoV";

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = message.content;

    row.append(label, body);

    if (message.action) {
      const action = document.createElement("pre");
      action.className = "action-payload";
      action.textContent = JSON.stringify(message.action, null, 2);
      row.append(action);
    }

    if (message.meta) {
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = message.meta;
      row.append(meta);
    }

    els.messages.append(row);
  }
  els.messages.scrollTop = els.messages.scrollHeight;
}

function addMessage(message) {
  messages.push({ ...message, createdAt: new Date().toISOString() });
  messages = messages.slice(-60);
  storage.set("messages", JSON.stringify(messages));
  renderMessages();
  refreshJobContinuation();
}

function loadMessages() {
  try {
    return JSON.parse(storage.get("messages") || "[]");
  } catch (_) {
    return [];
  }
}

function clearHistory() {
  messages = [];
  storage.remove("messages");
  addMessage({ role: "assistant", content: "History cleared. The channel is clean.", meta: "manual affordance" });
  openDrawer("chat");
}

function healAndReload() {
  const diagnostic = {
    at: new Date().toISOString(),
    source: config.source || "astranov.eu-chatgpt",
    route: location.href,
    userAgent: navigator.userAgent,
    messages: messages.length,
    orbs: [...orbState.keys()],
    status: els.status.textContent
  };
  storage.set("lastDiagnostic", JSON.stringify(diagnostic));
  storage.remove("messages");
  storage.remove("sessionId");
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister()))).finally(() => location.reload());
  } else {
    location.reload();
  }
}

function acquireLocation() {
  if (!navigator.geolocation) {
    addMessage({ role: "assistant", content: "Location is not available in this browser.", meta: "local" });
    return;
  }

  updateStatus("LOCATING");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(5);
      const lng = position.coords.longitude.toFixed(5);
      materializeOrb({ id: "pilot", label: "Pilot", glyph: "PL", color: "#8fb7ff", ring: "middle", panel: "actions", use: "hi" });
      addMessage({ role: "user", content: `Location acquired: ${lat}, ${lng}` });
      updateStatus("LOCATION READY");
      openDrawer("chat");
    },
    (error) => {
      addMessage({ role: "assistant", content: `Location blocked: ${error.message}`, meta: "local" });
      updateStatus("LOCATION BLOCKED");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

function cycleProvider() {
  const providers = ["openai-mini", "astranov"];
  currentProviderIndex = (currentProviderIndex + 1) % providers.length;
  const provider = providers[currentProviderIndex];
  const input = els.form.querySelector(`input[name="provider"][value="${provider}"]`);
  if (input) input.checked = true;
  onProviderChange();
  openDrawer("status", 3500);
}

function onProviderChange() {
  const provider = getProvider();
  const label = provider === "astranov" ? "ASTRANOV CYCLE" : "OPENAI MINI";
  els.providerLock.textContent = label;
  els.cicLabel.textContent = provider === "astranov" ? "AV" : "AI";
}

function getProvider() {
  return new FormData(els.form).get("provider") || config.preferredProvider || "openai-mini";
}

function openDrawer(panel = "chat", autoCloseMs = 5000) {
  showPanel(panel);
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
  clearTimeout(drawerTimer);
  if (autoCloseMs) drawerTimer = window.setTimeout(closeDrawer, autoCloseMs);
}

function closeDrawer() {
  clearTimeout(drawerTimer);
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
}

function showPanel(panel) {
  document.querySelectorAll(".drawer-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.panel === panel);
  });
  const [eyebrow, title] = panelTitles[panel] || panelTitles.chat;
  els.drawerEyebrow.textContent = eyebrow;
  els.drawerTitle.textContent = title;
}

function goBack() {
  depth = 0;
  els.body.classList.remove("has-depth");
  closeDrawer();
  document.querySelectorAll(".orb-dial").forEach((dial) => dial.remove());
}

function addBottomSwipe() {
  let startY = 0;
  window.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
  }, { passive: true });
  window.addEventListener("pointerup", (event) => {
    const fromBottom = startY > window.innerHeight - 70;
    const swipedUp = startY - event.clientY > 36;
    if (fromBottom && swipedUp) openDrawer("chat");
  }, { passive: true });
}

function setBusy(value) {
  els.send.disabled = value;
  els.input.disabled = value;
  els.body.classList.toggle("is-thinking", value);
}

function updateStatus(text) {
  els.status.textContent = text;
  updateTelemetry();
}

function updateTelemetry() {
  els.sessionLine.textContent = sessionId.slice(0, 8).toUpperCase();
  els.orbLine.textContent = `${orbState.size} LIVE`;
  els.memoryLine.textContent = storage.persistent ? "LOCAL" : "MEMORY";
  els.modeLine.textContent = els.body.classList.contains("focus-mode") ? "FOCUS" : "ORBITAL";
}

function exportTranscript() {
  const payload = {
    app: config.appName || "AstranoV // ChatGPT",
    exportedAt: new Date().toISOString(),
    sessionId,
    provider: getProvider(),
    status: els.status.textContent,
    orbs: [...orbState.keys()],
    messages
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `astranov-chatgpt-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  addMessage({ role: "assistant", content: "Transcript exported as a portable JSON signal pack.", meta: "manual affordance" });
}

function toggleFocusMode() {
  els.body.classList.toggle("focus-mode");
  els.focus.textContent = els.body.classList.contains("focus-mode") ? "Orb Mode" : "Focus Mode";
  updateTelemetry();
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 180)}px`;
}

function getSessionId() {
  const existing = storage.get("sessionId");
  if (existing) return existing;

  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.set("sessionId", id);
  return id;
}

function createStorage(prefix) {
  const memory = new Map();
  const key = (name) => `${prefix}:${name}`;

  function available() {
    try {
      const probe = `${prefix}:probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch (_) {
      return false;
    }
  }

  const canUseLocalStorage = available();
  return {
    persistent: canUseLocalStorage,
    get(name) {
      if (canUseLocalStorage) return window.localStorage.getItem(key(name));
      return memory.get(key(name)) || "";
    },
    set(name, value) {
      if (canUseLocalStorage) window.localStorage.setItem(key(name), value);
      else memory.set(key(name), value);
    },
    remove(name) {
      if (canUseLocalStorage) window.localStorage.removeItem(key(name));
      else memory.delete(key(name));
    }
  };
}

function offlineReply(prompt, error) {
  const cleanPrompt = prompt.replace(/\s+/g, " ").slice(0, 220);
  const reason = error?.message ? ` Router note: ${error.message}` : "";
  return `I could not reach the live router, so I kept the turn local and left the manual controls visible. Current request: "${cleanPrompt}".${reason}`;
}

function renderCodersHub() {
  if (!els.codersGrid) return;
  els.codersGrid.innerHTML = "";
  for (const lab of LABS) {
    const card = document.createElement("article");
    card.className = "coders-card";
    if (lab.id === config.lab) card.classList.add("is-here");
    card.style.setProperty("--lab-accent", lab.accent || "#7eb8ff");
    const here = lab.id === config.lab ? '<span class="coders-here">You are here</span>' : "";
    card.innerHTML = `
      <div class="coders-card-top">
        <span class="coders-card-glyph">${escapeHtml(lab.glyph)}</span>
        <div>
          <h2>${escapeHtml(lab.label)}</h2>
          ${here}
        </div>
      </div>
      <p class="coders-card-path">${escapeHtml(lab.path)}</p>
      <button type="button" class="coders-open" data-lab="${escapeHtml(lab.id)}">${lab.id === config.lab ? "Stay in lab" : "Open lab"}</button>
    `;
    card.querySelector(".coders-open")?.addEventListener("click", () => openLab(lab));
    els.codersGrid.append(card);
  }
}

function readJobContinuation() {
  try {
    const raw = window.localStorage.getItem(CONTINUATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeJobContinuation(payload) {
  window.localStorage.setItem(CONTINUATION_KEY, JSON.stringify(payload));
  refreshJobContinuation();
}

function buildJobContinuation() {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  return {
    updatedAt: new Date().toISOString(),
    fromLab: config.lab || "chatgpt",
    summary: lastAssistant?.content?.slice(0, 280) || "No assistant reply yet.",
    lastPrompt: lastUser?.content || "",
    messages: messages.slice(-8),
    provider: getProvider(),
    sessionId
  };
}

function refreshJobContinuation() {
  const job = readJobContinuation();
  if (!els.codersJobMeta || !els.codersJobPreview) return;
  if (!job) {
    els.codersJobMeta.textContent = "No saved job";
    els.codersJobPreview.textContent = messages.length
      ? "You have a live thread. Save it to hand off to Claude, Grok, Gemini, or another lab."
      : "Save the current thread to hand off to another coder lab.";
    return;
  }
  const when = job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "unknown time";
  els.codersJobMeta.textContent = `${job.fromLab || "lab"} · ${when}`;
  els.codersJobPreview.textContent = job.summary || job.lastPrompt || "Saved continuation pack.";
}

function saveJobContinuation() {
  const job = buildJobContinuation();
  writeJobContinuation(job);
  addMessage({
    role: "assistant",
    content: "Job saved to the shared Coders channel. Open any lab from the Coders hub to continue.",
    meta: "coders"
  });
  openDrawer("coders", 0);
  updateStatus("JOB SAVED");
}

function resumeJobContinuation() {
  const job = readJobContinuation();
  if (!job) {
    addMessage({ role: "assistant", content: "No saved job yet. Talk first, then tap Save & continue later.", meta: "coders" });
    openDrawer("coders", 0);
    return;
  }
  if (Array.isArray(job.messages) && job.messages.length) {
    messages = job.messages.map((m) => ({ role: m.role, content: m.content, meta: m.meta }));
    storage.set("messages", JSON.stringify(messages));
    renderMessages();
  }
  if (job.lastPrompt) {
    els.input.value = `Continue from ${job.fromLab || "previous lab"}: ${job.lastPrompt}`;
    autosize();
  }
  if (job.provider) {
    const input = els.form.querySelector(`input[name="provider"][value="${job.provider}"]`);
    if (input) {
      input.checked = true;
      onProviderChange();
    }
  }
  addMessage({
    role: "assistant",
    content: `Resumed the saved job from ${job.fromLab || "another lab"}. Your thread is restored — send when ready.`,
    meta: "coders"
  });
  openDrawer("chat", 0);
  els.input.focus();
  updateStatus("JOB RESUMED");
}

function clearJobContinuation() {
  window.localStorage.removeItem(CONTINUATION_KEY);
  refreshJobContinuation();
  updateStatus("JOB CLEARED");
}

function openLab(lab) {
  if (!lab?.path) return;
  if (lab.id === config.lab) {
    openDrawer("coders", 0);
    return;
  }
  const job = buildJobContinuation();
  writeJobContinuation(job);
  const target = new URL(lab.path, window.location.origin);
  target.searchParams.set("continue", "1");
  window.location.href = target.toString();
}

function maybeResumeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("continue")) return;
  const job = readJobContinuation();
  if (!job) return;
  window.setTimeout(() => resumeJobContinuation(), 500);
  const clean = new URL(window.location.href);
  clean.searchParams.delete("continue");
  window.history.replaceState({}, "", clean.toString());
}

function exposeOrbApi() {
  window.materializeOrb = materializeOrb;
  window.dematerializeOrb = dematerializeOrb;
  window.openCodersHub = () => openDrawer("coders", 0);
  window._revealOrb = (id) => {
    const seed = seedOrbs.find((orb) => orb.id === id);
    return seed ? materializeOrb(seed) : null;
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
