import { openDB } from 'idb';
import { DEFAULT_SETTINGS, PRESETS, type Gesture, type Settings, type Trial } from './types';

const database = openDB('handline-v1', 1, {
  upgrade(db) { db.createObjectStore('gestures', { keyPath: 'id' }); db.createObjectStore('settings'); db.createObjectStore('trials', { keyPath: 'id' }); },
});
export async function loadGestures(): Promise<Gesture[]> {
  const db = await database;
  const saved = await db.getAll('gestures') as Gesture[];
  const tx = db.transaction('gestures', 'readwrite');
  for (const preset of PRESETS) {
    const existing = saved.find(g => g.id === preset.id);
    if (!existing) {
      await tx.store.put(preset);
    } else if (existing.source === 'preset' && (existing.mediaPipeCategory !== preset.mediaPipeCategory || existing.name !== preset.name)) {
      await tx.store.put({ ...existing, name: preset.name, phrase: preset.phrase, mediaPipeCategory: preset.mediaPipeCategory, enabled: preset.enabled });
    }
  }
  await tx.done;
  const all = await (await database).getAll('gestures') as Gesture[];
  return all.sort((a, b) => (a.source === b.source ? 0 : a.source === 'preset' ? -1 : 1));
}
export async function saveGesture(gesture: Gesture) { await (await database).put('gestures', gesture); }
export async function deleteGesture(id: string) { await (await database).delete('gestures', id); }
export async function loadSettings(): Promise<Settings> { return { ...DEFAULT_SETTINGS, ...await (await database).get('settings', 'preferences') }; }
export async function saveSettings(settings: Settings) { await (await database).put('settings', settings, 'preferences'); }
export async function loadTrials(): Promise<Trial[]> { return (await (await database).getAll('trials') as Trial[]).sort((a, b) => b.at - a.at); }
export async function saveTrial(trial: Trial) { await (await database).put('trials', trial); }
export async function clearTrials() { await (await database).clear('trials'); }
