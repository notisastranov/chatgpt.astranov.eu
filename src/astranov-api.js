const PLACEHOLDER_RE = /(your-|replace|placeholder|example\.com|supabase-url|anon-key)/i;

export class AstranovApi {
  constructor(config) {
    this.config = normalizeConfig(config);
    this.endpoint = `${this.config.supabaseUrl}/functions/v1/${this.config.routerFunction}`;
  }

  isConfigured() {
    return Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  async ask({ prompt, messages, sessionId, provider }) {
    if (!this.isConfigured()) {
      throw new Error("AstranoV API is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const preferredProvider = provider || this.config.preferredProvider;

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          apikey: this.config.supabaseAnonKey,
          authorization: `Bearer ${this.config.supabaseAnonKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          text: prompt,
          prompt,
          level: "global",
          preferred_provider: preferredProvider,
          session_id: sessionId,
          source: this.config.source,
          messages: messages.slice(-10).map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content
          }))
        })
      });

      const raw = await response.text();
      const data = parseJson(raw);

      if (!response.ok) {
        const message = data?.error || data?.message || raw || `Router returned ${response.status}`;
        throw new Error(message);
      }

      if (!data) {
        throw new Error("Router returned a non-JSON response.");
      }

      const parsed = pickRouterText(data);
      return {
        text: parsed.text,
        action: data.action || parsed.action || null,
        provider: data.provider || data.engine || data.via || preferredProvider,
        model: data.model || "",
        latencyMs: data.latencyMs || data.latency_ms || null,
        raw: data
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Router request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeConfig(config = {}) {
  const normalized = {
    supabaseUrl: cleanUrl(config.supabaseUrl),
    supabaseAnonKey: String(config.supabaseAnonKey || "").trim(),
    routerFunction: String(config.routerFunction || "ai-router").trim(),
    preferredProvider: String(config.preferredProvider || "openai-mini").trim(),
    requestTimeoutMs: Number(config.requestTimeoutMs || 25000),
    source: String(config.source || "astranov.eu-chatgpt").trim()
  };

  if (PLACEHOLDER_RE.test(normalized.supabaseUrl) || PLACEHOLDER_RE.test(normalized.supabaseAnonKey)) {
    normalized.supabaseUrl = "";
    normalized.supabaseAnonKey = "";
  }

  if (!Number.isFinite(normalized.requestTimeoutMs) || normalized.requestTimeoutMs < 1000) {
    normalized.requestTimeoutMs = 25000;
  }

  return normalized;
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function pickRouterText(data) {
  const candidates = [
    data.response,
    data.text,
    data.message,
    data.answer,
    data.say,
    data.output
  ];
  let text = candidates.find((item) => typeof item === "string" && item.trim());

  if (!text && Array.isArray(data.choices)) {
    text = data.choices[0]?.message?.content || data.choices[0]?.text;
  }

  if (!text) {
    throw new Error("Router response did not include text.");
  }

  const actionMatch = text.match(/\nACTION:\s*(\{[\s\S]*\})\s*$/);
  let action = null;
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
      text = text.slice(0, actionMatch.index).trim();
    } catch (_) {
      action = null;
    }
  }

  return { text: text.trim(), action };
}
