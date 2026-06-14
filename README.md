# AstranoV ChatGPT

A standalone `/chatgpt` subpath experience for AstranoV. It mirrors the command-surface feel of `astranov.eu` while following the canonical [`notisastranov/astranov` schema](https://github.com/notisastranov/astranov/blob/main/SCHEMA.md).

## Canonical integration

- Uses the shared AstranoV Supabase project from `SCHEMA.md`.
- Sends prompts to the `ai-router` Edge Function with `preferred_provider: "openai-mini"` for this ChatGPT lab.
- Records anonymous debug telemetry in the canonical `analytics_events` table.
- Does **not** create app-specific tables such as `chat_messages`; browser chat history is local-only unless the shared router stores memory for an authenticated user.

## Local development

```bash
npm run dev
```

Open `http://localhost:5173/chatgpt/`.

## Configuration

`config.js` is already pointed at the canonical AstranoV Supabase URL and anon key from `SCHEMA.md`. Keep `config.example.js` as the placeholder template for future environments.

When the Supabase project, Edge Function, or browser persistence cannot be reached, the app falls back to local browser storage or in-memory session storage so the UI remains usable during development and restricted browsing modes.

## Production build

```bash
npm run build
```

Deploy the generated `dist/chatgpt` directory under `https://astranov.eu/chatgpt/`. The build copies the configured `config.js` into the deployable output. The local dev server also serves `/chatgpt/` with `no-store` headers so UI changes are easy to verify.
