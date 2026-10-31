import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

// Uses public MediaPipe fixtures only. Never reads webcam images or user storage.
const root = new URL('../', import.meta.url);
const thumb = `data:image/jpeg;base64,${(await readFile(new URL('tests/fixtures/thumb_up.jpg', root))).toString('base64')}`;
const pointing = `data:image/jpeg;base64,${(await readFile(new URL('tests/fixtures/pointing_up.jpg', root))).toString('base64')}`;
const baseURL = process.env.HANDLINE_TEST_URL ?? 'http://127.0.0.1:8787';
const runtime = await (await fetch(`${baseURL}/api/status`)).json();
if (!runtime.local.ready) throw new Error(runtime.local.message);
const results = [];
for (const trial of [
  { name: 'identical enrolled pose', image: thumb, expected: 'test-thumbs-up' },
  { name: 'different unassigned pose', image: pointing, expected: 'unknown' },
]) {
  const start = performance.now();
  const response = await fetch(`${baseURL}/api/verify-gesture`, {
    method: 'POST', signal: AbortSignal.timeout(125_000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runtime: 'local', cloudConsent: false, image: trial.image, candidates: [{ id: 'test-thumbs-up', name: 'Thumbs up pose', references: [thumb] }] }),
  });
  const data = await response.json();
  const result = { name: trial.name, expected: trial.expected, actual: data.gestureId ?? null, passed: response.ok && data.gestureId === trial.expected, elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(2)), ...(data.error ? { error: data.error } : {}) };
  results.push(result); console.log(JSON.stringify(result));
}
await writeFile(new URL('docs/local-smoke.json', root), JSON.stringify({ at: new Date().toISOString(), model: runtime.local.model, publicFixturesOnly: true, prototypeSmokeTest: true, results }, null, 2) + '\n');
if (results.some(r => !r.passed)) process.exitCode = 1;
