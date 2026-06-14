import { readFile, stat } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'config.js',
  'src/app.js',
  'src/astranov-api.js',
  'src/styles.css',
];

await Promise.all(requiredFiles.map((file) => stat(file)));

const html = await readFile('index.html', 'utf8');
const app = await readFile('src/app.js', 'utf8');
const config = await readFile('config.js', 'utf8');
const api = await readFile('src/astranov-api.js', 'utf8');

if (!html.includes('/chatgpt/')) {
  throw new Error('index.html must include the /chatgpt/ route');
}

if (!config.includes('https://lkoatrkhuigdolnjsbie.supabase.co')) {
  throw new Error('config.js must point at the canonical AstranoV Supabase project from SCHEMA.md');
}

if (!config.includes('/functions/v1') || !app.includes('ai-router') || !api.includes('/ai-router')) {
  throw new Error('the app must use the canonical ai-router Edge Function');
}

if (!api.includes('analytics_events')) {
  throw new Error('the app must use canonical analytics_events for anon telemetry');
}

if (app.includes('chat_messages') || api.includes('chat_messages')) {
  throw new Error('chat_messages is not in the canonical AstranoV SCHEMA.md');
}

if (config.includes('your-project.supabase.co') || config.includes('your-public-anon-key')) {
  throw new Error('config.js must not contain placeholder Supabase values');
}

console.log('Static app checks passed');
