import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const node = process.execPath;
const port = Number(process.env.PORT || 5174);

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function mustExist(rel) {
  statSync(join(root, rel));
}

async function fetchStatus(path, method = "GET") {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: method === "HEAD" ? "" : await response.text()
  };
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(node, ["scripts/dev-server.mjs"], {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let ready = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!ready && /running at/i.test(text)) {
        ready = true;
        resolve(child);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!ready) reject(new Error(`dev server exited early (${code})`));
    });

    setTimeout(() => {
      if (!ready) reject(new Error("dev server did not become ready in time"));
    }, 8000);
  });
}

const SCENARIOS = [
  {
    name: "01 repository structure",
    run: async () => {
      for (const file of [
        "index.html",
        "config.js",
        "package.json",
        "vercel.json",
        "src/app.js",
        "src/astranov-api.js",
        "src/styles.css",
        "scripts/build.mjs",
        "scripts/check.mjs",
        "scripts/dev-server.mjs",
        ".github/workflows/pages.yml"
      ]) {
        mustExist(file);
      }
      return { files: 11 };
    }
  },
  {
    name: "02 config — canonical AstranoV router",
    run: async () => {
      const config = read("config.js");
      if (!/lkoatrkhuigdolnjsbie\.supabase\.co/.test(config)) {
        throw new Error("config.js must use the canonical Supabase project");
      }
      if (!/astranov\.eu-chatgpt/.test(config)) {
        throw new Error("config.js must declare astranov.eu-chatgpt source");
      }
      if (/placeholder|your-supabase|anon-key/i.test(config)) {
        throw new Error("config.js still contains placeholder values");
      }
      return { source: "astranov.eu-chatgpt" };
    }
  },
  {
    name: "03 html shell — orb-first surface",
    run: async () => {
      const html = read("index.html");
      for (const id of ["cosmos", "orb-layer", "drawer", "cic-float", "messages", "composer"]) {
        if (!html.includes(`id="${id}"`)) throw new Error(`missing #${id}`);
      }
      for (const asset of ["./config.js", "./src/app.js", "./src/styles.css"]) {
        if (!html.includes(asset)) throw new Error(`index.html missing ${asset}`);
      }
      return { dom: 6 };
    }
  },
  {
    name: "04 styles — orbital zero system",
    run: async () => {
      const css = read("src/styles.css");
      for (const token of [".cosmos", ".orb", ".drawer", ".cic", ".earth-wrap", ".messages"]) {
        if (!css.includes(token)) throw new Error(`styles missing ${token}`);
      }
      return { tokens: 6 };
    }
  },
  {
    name: "05 api client — router contract",
    run: async () => {
      const source = read("src/astranov-api.js");
      if (!source.includes("ai-router")) throw new Error("api client must target ai-router");
      const { AstranovApi } = await import(new URL("../src/astranov-api.js", import.meta.url));
      const api = new AstranovApi({
        supabaseUrl: "https://lkoatrkhuigdolnjsbie.supabase.co",
        supabaseAnonKey: "test-key",
        routerFunction: "ai-router",
        preferredProvider: "openai-mini",
        source: "astranov.eu-chatgpt"
      });
      if (!api.isConfigured()) throw new Error("configured api rejected valid config");
      if (!api.endpoint.endsWith("/functions/v1/ai-router")) {
        throw new Error(`unexpected endpoint ${api.endpoint}`);
      }
      return { endpoint: api.endpoint };
    }
  },
  {
    name: "06 app surface — drawer, orbs, cycle",
    run: async () => {
      const app = read("src/app.js");
      for (const token of [
        "materializeOrb",
        "openDrawer",
        "cycleProvider",
        "exportTranscript",
        "toggleFocusMode",
        "seedOrbs"
      ]) {
        if (!app.includes(token)) throw new Error(`app.js missing ${token}`);
      }
      return { affordances: 6 };
    }
  },
  {
    name: "07 build output — deployable dist",
    run: async () => {
      const child = spawn(node, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
      const code = await new Promise((resolve) => child.on("exit", resolve));
      if (code !== 0) throw new Error("build failed");
      for (const file of ["dist/index.html", "dist/config.js", "dist/src/app.js"]) {
        mustExist(file);
      }
      return { dist: 3 };
    }
  },
  {
    name: "08 server root — index.html",
    run: async (ctx) => {
      const result = await fetchStatus("/");
      if (result.status !== 200) throw new Error(`expected 200, got ${result.status}`);
      if (!/<!doctype html>/i.test(result.body)) throw new Error("root did not return html");
      ctx.server = true;
      return { status: result.status };
    }
  },
  {
    name: "09 server chatgpt path",
    run: async () => {
      const result = await fetchStatus("/chatgpt/");
      if (result.status !== 200) throw new Error(`expected 200, got ${result.status}`);
      if (!result.body.includes("AstranoV")) throw new Error("/chatgpt/ did not serve app html");
      return { status: result.status };
    }
  },
  {
    name: "10 server security — repo metadata blocked",
    run: async () => {
      const result = await fetchStatus("/package.json");
      if (result.status !== 404) throw new Error(`package.json should be blocked, got ${result.status}`);
      return { status: result.status };
    }
  },
  {
    name: "11 server HEAD",
    run: async () => {
      const result = await fetchStatus("/index.html", "HEAD");
      if (result.status !== 200) throw new Error(`HEAD failed with ${result.status}`);
      return { status: result.status };
    }
  },
  {
    name: "12 server cache — no-store",
    run: async () => {
      const result = await fetchStatus("/src/app.js");
      if (result.status !== 200) throw new Error(`asset fetch failed with ${result.status}`);
      if (result.headers["cache-control"] !== "no-store") {
        throw new Error(`expected no-store, got ${result.headers["cache-control"] || "none"}`);
      }
      return { cacheControl: result.headers["cache-control"] };
    }
  },
  {
    name: "13 deploy pipeline — pages + vercel",
    run: async () => {
      const workflow = read(".github/workflows/pages.yml");
      const vercel = read("vercel.json");
      if (!/npm run check/.test(workflow) || !/npm run build/.test(workflow)) {
        throw new Error("pages workflow must run check and build");
      }
      if (!/"outputDirectory": "dist"/.test(vercel)) {
        throw new Error("vercel.json must publish dist/");
      }
      if (!/chatgpt/.test(vercel)) throw new Error("vercel.json must rewrite /chatgpt");
      return { targets: ["github-pages", "vercel"] };
    }
  }
];

async function main() {
  let server;
  const results = [];
  let failed = 0;

  try {
    server = await startServer();
    console.log(`Dev server ready on http://127.0.0.1:${port}/chatgpt/`);

    for (const scenario of SCENARIOS) {
      try {
        const data = await scenario.run({});
        console.log(`✓ ${scenario.name}`, JSON.stringify(data));
        results.push({ name: scenario.name, ok: true, data });
      } catch (error) {
        console.error(`✗ ${scenario.name}`, error.message);
        results.push({ name: scenario.name, ok: false, error: error.message });
        failed += 1;
      }
    }
  } finally {
    if (server && !server.killed) server.kill();
  }

  console.log(`\n--- ${results.filter((item) => item.ok).length}/${results.length} passed ---`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
