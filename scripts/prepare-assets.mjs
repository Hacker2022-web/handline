import { access, mkdir, copyFile, readdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const model = path.join(root, 'public/models/gesture_recognizer.task');
await mkdir(path.dirname(model), { recursive: true });
await mkdir(path.join(root, 'public/mediapipe'), { recursive: true });
const wasm = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const file of await readdir(wasm)) {
  if (/\.(wasm|js)$/.test(file)) await copyFile(path.join(wasm, file), path.join(root, 'public/mediapipe', file));
}
try {
  await access(model);
  console.log('MediaPipe model already installed. Offline assets ready.');
} catch {
  console.log('Downloading the official MediaPipe gesture recognizer (~8 MB)…');
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task');
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error('Model download was incomplete.');
  await writeFile(`${model}.tmp`, bytes);
  await rename(`${model}.tmp`, model);
  console.log(`Installed MediaPipe model (${(bytes.length / 1024 / 1024).toFixed(1)} MB).`);
}
