import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

if (!dist.startsWith(root)) {
  throw new Error("Refusing to write outside project root.");
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const entry of ["index.html", "config.js", "src"]) {
  cpSync(join(root, entry), join(dist, entry), { recursive: true });
}

console.log(`Built ${dist}`);
