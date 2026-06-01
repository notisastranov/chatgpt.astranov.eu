import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const required = [
  "index.html",
  "config.js",
  "src/app.js",
  "src/astranov-api.js",
  "src/styles.css",
  "scripts/dev-server.mjs",
  "scripts/build.mjs"
];

const failures = [];
for (const file of required) {
  try {
    statSync(join(root, file));
  } catch (_) {
    failures.push(`Missing ${file}`);
  }
}

const config = readFileSync(join(root, "config.js"), "utf8");
if (/placeholder|replace|your-supabase|anon-key/i.test(config)) {
  failures.push("config.js still contains placeholder values");
}

const html = readFileSync(join(root, "index.html"), "utf8");
for (const asset of ["./config.js", "./src/app.js", "./src/styles.css"]) {
  if (!html.includes(asset)) failures.push(`index.html does not reference ${asset}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok");
