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
  { id: 'preset-point', name: 'Pointing up', phrase: 'Excuse me', source: 'preset', mediaPipeCategory: 'Pointing_Up', enabled: true, samples: [] },
  { id: 'preset-love', name: 'I Love You sign', phrase: 'I need help', source: 'preset', mediaPipeCategory: 'ILoveYou', enabled: true, samples: [] },
  { id: 'preset-stop', name: 'Closed fist', phrase: 'Stop, please', source: 'preset', mediaPipeCategory: 'Closed_Fist', enabled: true, samples: [] },
  { id: 'preset-two-thumbs', name: 'Two thumbs up', phrase: 'Great job!', source: 'preset', mediaPipeCategory: 'Two_Thumbs_Up', enabled: true, samples: [] },
  { id: 'preset-two-palms', name: 'Two open palms', phrase: 'Welcome', source: 'preset', mediaPipeCategory: 'Two_Open_Palms', enabled: true, samples: [] },
  { id: 'preset-two-peace', name: 'Two victory signs', phrase: 'Peace & cheers!', source: 'preset', mediaPipeCategory: 'Two_Victory', enabled: true, samples: [] },
  { id: 'preset-two-fists', name: 'Two closed fists', phrase: 'Wait a moment', source: 'preset', mediaPipeCategory: 'Two_Fists', enabled: true, samples: [] },
  { id: 'preset-namaste', name: 'Prayer / Namaste', phrase: 'Please', source: 'preset', mediaPipeCategory: 'Hands_Praying', enabled: true, samples: [] },
];
export const DEFAULT_SETTINGS: Settings = { runtime: 'local', autoSpeak: true, holdMs: 900, voiceURI: '', speechRate: 0.9 };
