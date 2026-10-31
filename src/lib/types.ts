export type Runtime = 'local' | 'cloud';
export type Landmark = { x: number; y: number; z: number };
export type GestureSample = { landmarks: number[]; referenceCrop: string; capturedAt: number };
export type Gesture = {
  handMode?: 'single' | 'dual'; priority?: boolean; id: string; name: string; phrase: string; source: 'preset' | 'custom';
  mediaPipeCategory?: string; enabled: boolean; samples: GestureSample[];
};
export type Settings = { runtime: Runtime; autoSpeak: boolean; holdMs: number; voiceURI: string; speechRate: number; confirmationCue?: boolean; theme: 'system' | 'light' | 'dark'; minConfidence: number; speechProvider: 'device' | 'elevenlabs'; elevenLanguage?: string; elevenVoiceId: string; elevenModel: 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' };
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
  runtime: Runtime; cloudConsent: boolean; image: string; inspect?: boolean;
  candidates: { id: string; name: string; references: string[] }[];
};
export const PRESETS: Gesture[] = [
  { id: 'preset-yes', name: 'Thumbs up', phrase: 'Yes', source: 'preset', mediaPipeCategory: 'Thumb_Up', enabled: true, samples: [] },
  { id: 'preset-no', name: 'Thumbs down', phrase: 'No', source: 'preset', mediaPipeCategory: 'Thumb_Down', enabled: true, samples: [] },
  { id: 'preset-hello', name: 'Open palm', phrase: 'Hello', source: 'preset', mediaPipeCategory: 'Open_Palm', enabled: true, samples: [] },
  { id: 'preset-thanks', name: 'Victory sign', phrase: 'Thank you', source: 'preset', mediaPipeCategory: 'Victory', enabled: true, samples: [] },
  { id: 'preset-stop', name: 'Stop', phrase: 'Please stop', source: 'preset', mediaPipeCategory: 'Stop_Hand', enabled: false, samples: [] },
  { id: 'preset-ok', name: 'OK sign', phrase: 'All good', source: 'preset', mediaPipeCategory: 'OK_Sign', enabled: false, samples: [] },
  { id: 'preset-point', name: 'Pointing finger', phrase: 'Look here', source: 'preset', mediaPipeCategory: 'Pointing_Up', enabled: false, samples: [] },
  { id: 'preset-fist', name: 'Closed fist', phrase: 'Hold on', source: 'preset', mediaPipeCategory: 'Closed_Fist', enabled: false, samples: [] },
  { id: 'preset-crossed', name: 'Crossed fingers', phrase: 'Good luck', source: 'preset', mediaPipeCategory: 'Crossed_Fingers', enabled: false, samples: [] },
  { id: 'preset-shaka', name: 'Shaka sign', phrase: 'Take it easy', source: 'preset', mediaPipeCategory: 'Shaka', enabled: false, samples: [] },
  { id: 'preset-two-thumbs', name: 'Two thumbs up', phrase: 'Great job', source: 'preset', mediaPipeCategory: 'Two_Thumbs_Up', enabled: false, samples: [] },
  { id: 'preset-namaste', name: 'Prayer / Namaste', phrase: 'Thank you', source: 'preset', mediaPipeCategory: 'Hands_Praying', enabled: false, samples: [] },
];
export const DEFAULT_SETTINGS: Settings = { runtime: 'local', autoSpeak: true, holdMs: 900, voiceURI: '', speechRate: 0.9, theme: 'system', minConfidence: 50, speechProvider: 'device', elevenVoiceId: '', elevenModel: 'eleven_turbo_v2_5' };
