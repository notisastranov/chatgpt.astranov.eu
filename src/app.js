import { AstranovApi } from "./astranov-api.js";

const config = window.ASTRANOV_CONFIG || {};
const api = new AstranovApi(config);
const storage = createStorage("astranov-chatgpt");
const sessionId = getSessionId();

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("composer"),
  input: document.getElementById("prompt-input"),
  send: document.getElementById("send-button"),
  clear: document.getElementById("clear-button"),
  locate: document.getElementById("locate-button"),
  brand: document.getElementById("brand-button"),
  status: document.getElementById("status-line"),
  providerLock: document.getElementById("provider-lock")
};

let messages = loadMessages();
let pending = false;

boot();

function boot() {
  if (!messages.length) {
    messages = [
      {
        role: "assistant",
        content: "I am online locally. When the AstranoV router is reachable, this channel locks to the OpenAI mini route.",
        meta: "local"
      }
    ];
  }

  render();
  updateStatus(api.isConfigured() ? "Router configured" : "Local fallback only");
  autosize();

  els.form.addEventListener("submit", onSubmit);
  els.input.addEventListener("input", autosize);
  els.clear.addEventListener("click", clearHistory);
  els.locate.addEventListener("click", acquireLocation);
  els.brand.addEventListener("click", resetSession);
  document.addEventListener("change", onProviderChange);
}

async function onSubmit(event) {
  event.preventDefault();
  if (pending) return;

  const prompt = els.input.value.trim();
  if (!prompt) return;

  els.input.value = "";
  autosize();
  addMessage({ role: "user", content: prompt });
  await askRouter(prompt);
}

async function askRouter(prompt) {
  pending = true;
  setBusy(true);
  updateStatus("Transmitting to AstranoV");

  const provider = getProvider();
  try {
    const result = await api.ask({ prompt, messages, sessionId, provider });
    const meta = [
      result.provider || provider,
      result.model,
      result.latencyMs ? `${result.latencyMs}ms` : ""
    ].filter(Boolean).join(" / ");

    addMessage({
      role: "assistant",
      content: result.text,
      meta: meta || "router",
      action: result.action
    });
    updateStatus("Router response received");
  } catch (error) {
    addMessage({
      role: "assistant",
      content: offlineReply(prompt, error),
      meta: "local fallback"
    });
    updateStatus("Router unreachable, local fallback used");
  } finally {
    pending = false;
    setBusy(false);
  }
}

function render() {
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
  messages.push({
    ...message,
    createdAt: new Date().toISOString()
  });
  messages = messages.slice(-60);
  storage.set("messages", JSON.stringify(messages));
  render();
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
  addMessage({
    role: "assistant",
    content: "History cleared. The channel is clean.",
    meta: "local"
  });
}

function resetSession() {
  storage.remove("messages");
  storage.remove("sessionId");
  window.location.reload();
}

function acquireLocation() {
  if (!navigator.geolocation) {
    addMessage({
      role: "assistant",
      content: "Location is not available in this browser.",
      meta: "local"
    });
    return;
  }

  updateStatus("Acquiring location");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(5);
      const lng = position.coords.longitude.toFixed(5);
      addMessage({
        role: "user",
        content: `Location acquired: ${lat}, ${lng}`
      });
      updateStatus("Location acquired");
    },
    (error) => {
      addMessage({
        role: "assistant",
        content: `Location blocked: ${error.message}`,
        meta: "local"
      });
      updateStatus("Location blocked");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

function onProviderChange() {
  const provider = getProvider();
  els.providerLock.textContent = provider === "astranov" ? "ASTRANOV CYCLE" : "OPENAI MINI";
}

function getProvider() {
  return new FormData(els.form).get("provider") || config.preferredProvider || "openai-mini";
}

function setBusy(value) {
  els.send.disabled = value;
  els.input.disabled = value;
  document.body.classList.toggle("is-thinking", value);
}

function updateStatus(text) {
  els.status.textContent = text;
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 180)}px`;
}

function getSessionId() {
  const existing = storage.get("sessionId");
  if (existing) return existing;

  const id = crypto.randomUUID
    ? crypto.randomUUID()
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
  return `I could not reach the live router, so I stored the turn locally. Next move: keep the request short and actionable, then retry when the connection is back. Current request: "${cleanPrompt}".${reason}`;
}
