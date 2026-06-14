import { createAstranovApi, createSessionId, hasAstranovConfig } from './astranov-api.js';

const sessionIdKey = 'astranov-chatgpt-session-id';
const localMessagesKey = 'astranov-chatgpt-messages';

const quickPrompts = [
  {
    label: 'Global plan',
    prompt: 'Ask the AstranoV AI router for a global operations plan',
  },
  {
    label: 'Nearby vendors',
    prompt: 'Find products and vendors near my current city',
  },
  {
    label: 'Driver dispatch',
    prompt: 'Create a driver dispatch plan for an order',
  },
  {
    label: 'Cycle question',
    prompt: 'Turn this into a Collective Intelligence Cycle question',
  },
];

const seedMessage = {
  role: 'assistant',
  content:
    'ASTRANOV CHATGPT online. I route prompts through the canonical AstranoV ai-router Edge Function and keep this browser session available even when the network is offline.',
};

const config = window.ASTRANOV_CHATGPT_CONFIG || {};
const memoryStorage = new Map();
const messageList = document.querySelector('#message-list');
const quickPromptList = document.querySelector('#quick-prompts');
const composer = document.querySelector('#composer');
const commandInput = document.querySelector('#command-input');
const sendButton = document.querySelector('#send-button');
const connectionStatus = document.querySelector('#connection-status');
const connectionDetail = document.querySelector('#connection-detail');
const sessionShort = document.querySelector('#session-short');
const messageCount = document.querySelector('#message-count');
const charCount = document.querySelector('#char-count');
const clearHistory = document.querySelector('#clear-history');
const locateButton = document.querySelector('#locate-button');
const signalValue = document.querySelector('#signal-value');

let astranovApi = null;
let messages = [seedMessage];
let isSending = false;

function readStorage(key) {
  try {
    return window.localStorage.getItem(key) || memoryStorage.get(key) || null;
  } catch (error) {
    console.warn('Browser storage is unavailable; using memory storage for this session.', error);
    return memoryStorage.get(key) || null;
  }
}

function writeStorage(key, value) {
  memoryStorage.set(key, value);

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Unable to persist to browser storage; keeping data in memory.', error);
  }
}

function removeStorage(key) {
  memoryStorage.delete(key);

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Unable to clear browser storage.', error);
  }
}

function getSessionId() {
  const generated = createSessionId(readStorage(sessionIdKey));
  writeStorage(sessionIdKey, generated);
  return generated;
}

const sessionId = getSessionId();
sessionShort.textContent = sessionId.slice(0, 8);

function setConnectionStatus(mode, detail) {
  const labels = {
    ready: '◉ ai-router ready',
    local: '◌ Local mode',
    booting: '◌ Connecting',
  };

  const details = {
    ready: 'Connected to canonical Supabase functions/v1/ai-router.',
    local: 'Using browser storage until the AstranoV API is reachable.',
    booting: 'Preparing canonical ai-router.',
  };

  connectionStatus.className = `connection ${mode}`;
  connectionStatus.textContent = labels[mode];
  connectionDetail.textContent = detail || details[mode];
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateChrome() {
  const localCount = Math.max(messages.length - 1, 0);
  messageCount.textContent = `${localCount}`;
  signalValue.textContent = astranovApi ? '96%' : 'Local';
  charCount.textContent = `${commandInput.value.length}`;
}

function renderMessages() {
  messageList.innerHTML = messages
    .map(
      (message) => `
        <article class="message ${message.role === 'user' ? 'user' : 'assistant'}">
          <div class="message-role">${message.role === 'user' ? 'Me' : 'Agent'}</div>
          <p>${escapeHtml(message.content)}</p>
        </article>
      `,
    )
    .join('');

  if (isSending) {
    messageList.insertAdjacentHTML(
      'beforeend',
      '<article class="message assistant pending"><div class="message-role">Agent</div><p>Routing through AstranoV ai-router…</p></article>',
    );
  }

  updateChrome();
  messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
}

function saveLocalMessages() {
  writeStorage(localMessagesKey, JSON.stringify(messages));
}

function loadLocalMessages() {
  const saved = readStorage(localMessagesKey);

  if (!saved) {
    messages = [seedMessage];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    messages = Array.isArray(parsed) && parsed.length ? parsed : [seedMessage];
  } catch (error) {
    console.error('Unable to parse local message history', error);
    messages = [seedMessage];
  }
}

function createFallbackReply(prompt, reason = 'the network is unavailable') {
  const trimmed = prompt.trim();

  return `◈ Local mission draft: “${trimmed}”.\n\nThe canonical AstranoV ai-router could not answer because ${reason}. I kept your command in this browser and would execute it as:\n1. Classify the request as global, national, or personal.\n2. Ask ai-router with preferred_provider=openai-mini.\n3. Convert returned actions into AstranoV operations.\n4. Log non-sensitive telemetry to analytics_events.`;
}

async function recordEvent(type, data) {
  if (!astranovApi) {
    return;
  }

  await astranovApi.recordEvent(type, { ...data, app: 'chatgpt' }, sessionId);
}

function formatAction(action) {
  if (!action) {
    return '';
  }

  if (typeof action === 'string') {
    return `\naction: ${action}`;
  }

  return `\naction: ${JSON.stringify(action, null, 2)}`;
}

async function askAstranov(prompt) {
  if (!astranovApi) {
    return createFallbackReply(prompt, 'the AstranoV API is not configured');
  }

  const response = await astranovApi.routeChat({
    text: prompt,
    level: 'global',
  });

  const responseText = response?.text || response?.message || response?.answer || '';

  if (!responseText) {
    return createFallbackReply(prompt, 'ai-router returned an empty response');
  }

  const provider = response.provider ? `provider: ${response.provider}` : 'provider: astranov';
  const via = response.via ? `\nvia: ${response.via}` : '';
  const action = formatAction(response.action);
  return `${responseText}\n\n${provider}${via}${action}`;
}

async function initializeApp() {
  setConnectionStatus('booting');
  loadLocalMessages();
  renderMessages();

  if (!hasAstranovConfig(config)) {
    setConnectionStatus('local', 'Missing Supabase URL or anon key in config.js.');
    return;
  }

  astranovApi = createAstranovApi(config);
  setConnectionStatus(astranovApi ? 'ready' : 'local');
  updateChrome();

  try {
    await recordEvent('debug_chatgpt_open', {
      route: '/chatgpt/',
      preferred_provider: config.preferredProvider || 'openai-mini',
    });
  } catch (error) {
    console.error('Unable to record analytics event', error);
    setConnectionStatus('local', 'Supabase telemetry was unavailable; chat remains local-first.');
  }
}

function renderQuickPrompts() {
  quickPromptList.innerHTML = quickPrompts
    .map(
      ({ label, prompt }) =>
        `<button type="button" data-prompt="${escapeHtml(prompt)}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(prompt)}</span></button>`,
    )
    .join('');

  quickPromptList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-prompt]');

    if (!button) {
      return;
    }

    commandInput.value = button.dataset.prompt;
    updateChrome();
    commandInput.focus();
  });
}

composer.addEventListener('submit', async (event) => {
  event.preventDefault();

  const content = commandInput.value.trim();
  if (!content || isSending) {
    return;
  }

  isSending = true;
  sendButton.disabled = true;
  commandInput.value = '';

  messages = [...messages, { role: 'user', content }];
  saveLocalMessages();
  renderMessages();

  try {
    await recordEvent('debug_chatgpt_prompt', { prompt_length: content.length });
  } catch (error) {
    console.error('Unable to record prompt analytics event', error);
  }

  let assistantContent;
  try {
    assistantContent = await askAstranov(content);
    setConnectionStatus('ready');
  } catch (error) {
    console.error('Unable to route prompt through ai-router', error);
    assistantContent = createFallbackReply(content, error.message || 'ai-router failed');
    astranovApi = null;
    setConnectionStatus('local');
  }

  messages = [...messages, { role: 'assistant', content: assistantContent }];
  isSending = false;
  sendButton.disabled = false;
  saveLocalMessages();
  renderMessages();
});

commandInput.addEventListener('input', updateChrome);

clearHistory.addEventListener('click', () => {
  messages = [seedMessage];
  removeStorage(localMessagesKey);
  saveLocalMessages();
  renderMessages();
  commandInput.focus();
});

locateButton.addEventListener('click', () => {
  commandInput.value = 'Locate my current AstranoV mission context and suggest the next city-level action';
  updateChrome();
  commandInput.focus();
});

renderQuickPrompts();
void initializeApp();
