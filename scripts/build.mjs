import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist', 'chatgpt');

await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(join(dist, 'src'), { recursive: true });

const html = await readFile(join(root, 'index.html'), 'utf8');
await writeFile(join(dist, 'index.html'), html);
await cp(join(root, 'src'), join(dist, 'src'), { recursive: true });
await cp(join(root, 'config.js'), join(dist, 'config.js'));

console.log('Built static app in dist/chatgpt');
