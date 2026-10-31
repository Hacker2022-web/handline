import { openDB } from 'idb';
import { DEFAULT_SETTINGS, PRESETS, type Gesture, type Settings, type Trial } from './types';

const database = openDB('handline-v1', 1, {
  upgrade(db) { db.createObjectStore('gestures', { keyPath: 'id' }); db.createObjectStore('settings'); db.createObjectStore('trials', { keyPath: 'id' }); },
});
export async function loadGestures(): Promise<Gesture[]> {
  const db = await database;
  const saved = await db.getAll('gestures') as Gesture[];
  const missing = PRESETS.filter(p => !saved.some(g => g.id === p.id));
  const tx = db.transaction('gestures', 'readwrite');
  for (const gesture of missing) await tx.store.put(gesture);
  await tx.done;
  return [...saved, ...missing].sort((a, b) => (a.source === b.source ? 0 : a.source === 'preset' ? -1 : 1));
}
export async function saveGesture(gesture: Gesture) { await (await database).put('gestures', gesture); }
export async function deleteGesture(id: string) { await (await database).delete('gestures', id); }
export async function loadSettings(): Promise<Settings> { return { ...DEFAULT_SETTINGS, ...await (await database).get('settings', 'preferences') }; }
export async function saveSettings(settings: Settings) { await (await database).put('settings', settings, 'preferences'); }
export async function loadTrials(): Promise<Trial[]> { return (await (await database).getAll('trials') as Trial[]).sort((a, b) => b.at - a.at); }
export async function saveTrial(trial: Trial) { await (await database).put('trials', trial); }
export async function clearTrials() { await (await database).clear('trials'); }
