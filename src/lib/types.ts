export type Runtime = 'local' | 'cloud';
export type Landmark = { x: number; y: number; z: number };
export type GestureSample = { landmarks: number[]; referenceCrop: string; capturedAt: number };
export type Gesture = {
  id: string; name: string; phrase: string; source: 'preset' | 'custom';
  mediaPipeCategory?: string; enabled: boolean; samples: GestureSample[];
};
export type Settings = { runtime: Runtime; autoSpeak: boolean; holdMs: number; voiceURI: string; speechRate: number };
export type Message = { id: string; gestureId: string; phrase: string; at: number; source: 'gesture' | 'manual'; runtime: Runtime };
export type Trial = {
  id: string; at: number; expected: string; expectedName: string; observed: string;
  observedName: string; runtime: Runtime; outcome: 'correct' | 'false-trigger' | 'miss';
};
export type RuntimeStatus = {
  local: { ready: boolean; model: string; message: string; installed: boolean; memoryGB: number };
  cloud: { configured: boolean; model: string; message: string };
};
export type VerificationRequest = {
  runtime: Runtime; cloudConsent: boolean; image: string;
  candidates: { id: string; name: string; references: string[] }[];
};
export const PRESETS: Gesture[] = [
  { id: 'preset-yes', name: 'Thumbs up', phrase: 'Yes', source: 'preset', mediaPipeCategory: 'Thumb_Up', enabled: true, samples: [] },
  { id: 'preset-no', name: 'Thumbs down', phrase: 'No', source: 'preset', mediaPipeCategory: 'Thumb_Down', enabled: true, samples: [] },
  { id: 'preset-hello', name: 'Open palm', phrase: 'Hello', source: 'preset', mediaPipeCategory: 'Open_Palm', enabled: true, samples: [] },
  { id: 'preset-thanks', name: 'Victory sign', phrase: 'Thank you', source: 'preset', mediaPipeCategory: 'Victory', enabled: true, samples: [] },
];
export const DEFAULT_SETTINGS: Settings = { runtime: 'local', autoSpeak: true, holdMs: 900, voiceURI: '', speechRate: 0.9 };
