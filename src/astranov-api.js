const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestTimeoutMs = 25000;

export function hasAstranovConfig(config) {
  const supabaseUrl = config?.supabaseUrl || '';
  const supabaseAnonKey = config?.supabaseAnonKey || '';
  const functionsBaseUrl = config?.functionsBaseUrl || '';

  return Boolean(
    supabaseUrl.startsWith('https://') &&
      supabaseAnonKey.startsWith('eyJ') &&
      functionsBaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('your-project') &&
      !supabaseAnonKey.includes('your-public-anon-key'),
  );
}

export function createSessionId(existingValue) {
  if (existingValue && uuidPattern.test(existingValue)) {
    return existingValue;
  }

  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const randomValues = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 256);
    }
  }

  randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
  randomValues[8] = (randomValues[8] & 0x3f) | 0x80;

  const segments = [4, 2, 2, 2, 6];
  let offset = 0;

  return segments
    .map((length) => {
      const segment = Array.from(randomValues.slice(offset, offset + length), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
      offset += length;
      return segment;
    })
    .join('-');
}

export function createAstranovApi(config) {
  if (!hasAstranovConfig(config)) {
    return null;
  }

  const restBaseUrl = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const functionsBaseUrl = config.functionsBaseUrl.replace(/\/$/, '');
  const baseHeaders = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs || requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || 'POST',
        headers: { ...baseHeaders, ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const bodyText = response.status === 204 ? '' : await response.text();

      if (!response.ok) {
        throw new Error(`AstranoV API ${response.status}: ${bodyText || response.statusText}`);
      }

      if (!bodyText) {
        return null;
      }

      try {
        return JSON.parse(bodyText);
      } catch {
        return { text: bodyText };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('AstranoV API request timed out');
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    async routeChat({ text, level = 'global', country = '', city = '', vendor = '' }) {
      return requestJson(`${functionsBaseUrl}/ai-router`, {
        body: {
          text,
          level,
          country,
          city,
          vendor,
          preferred_provider: config.preferredProvider || 'openai-mini',
        },
      });
    },

    async recordEvent(type, data, sessionId) {
      return requestJson(`${restBaseUrl}/analytics_events`, {
        headers: { Prefer: 'return=minimal' },
        body: {
          type,
          data,
          ts: Date.now(),
          session_id: sessionId,
        },
      });
    },
  };
}
