# AstranoV // ChatGPT

Static ChatGPT lab for AstranoV. It talks to the shared Supabase `ai-router`
Edge Function with `preferred_provider: "openai-mini"` and keeps a local,
in-browser fallback so the UI remains usable if the router is offline.

## Run

```bash
npm run check
npm run build
npm run dev
```

The dev server serves only deployable app files:

- `index.html`
- `config.js`
- `src/`

It supports `/chatgpt/`, `HEAD`, `Cache-Control: no-store`, and blocks direct
access to repo metadata such as `package.json`.

## Deploy

Push to `main`. The included GitHub Pages workflow builds the static app into
`dist/` and deploys it with GitHub Actions.

The Supabase anon key in `config.js` is publishable by design; provider secrets
stay in Supabase Edge Function environment variables.
