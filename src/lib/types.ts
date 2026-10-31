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
  { id: 'preset-yes', name: 'Thumbs Up 👍', phrase: 'Approval, agreement and appreciation', source: 'preset', mediaPipeCategory: 'Thumb_Up', enabled: true, samples: [] },
  { id: 'preset-no', name: 'Thumbs Down 👎', phrase: 'Disapproval or disagreement', source: 'preset', mediaPipeCategory: 'Thumb_Down', enabled: true, samples: [] },
  { id: 'preset-stop', name: 'Stop ✋', phrase: 'Please stop and wait', source: 'preset', mediaPipeCategory: 'Stop_Hand', enabled: true, samples: [] },
  { id: 'preset-thanks', name: 'Peace Sign ✌️', phrase: 'Peace, victory and positivity', source: 'preset', mediaPipeCategory: 'Victory', enabled: true, samples: [] },
  { id: 'preset-ok', name: 'OK Sign 👌', phrase: 'Everything is fine and correct', source: 'preset', mediaPipeCategory: 'OK_Sign', enabled: true, samples: [] },
  { id: 'preset-point', name: 'Pointing Finger ☝️', phrase: 'Directing attention towards something', source: 'preset', mediaPipeCategory: 'Pointing_Up', enabled: true, samples: [] },
  { id: 'preset-hello', name: 'Waving Hand 👋', phrase: 'Greeting someone or saying goodbye', source: 'preset', mediaPipeCategory: 'Open_Palm', enabled: true, samples: [] },
  { id: 'preset-fist', name: 'Closed Fist ✊', phrase: 'Strength, unity and determination', source: 'preset', mediaPipeCategory: 'Closed_Fist', enabled: true, samples: [] },
  { id: 'preset-crossed', name: 'Crossed Fingers 🤞', phrase: 'Wishing you good luck and hoping for the best', source: 'preset', mediaPipeCategory: 'Crossed_Fingers', enabled: true, samples: [] },
  { id: 'preset-shaka', name: 'Shaka Sign 🤙', phrase: 'Relaxation, friendliness and all good', source: 'preset', mediaPipeCategory: 'Shaka', enabled: true, samples: [] },
  { id: 'preset-two-thumbs', name: 'Two Thumbs Up 👍👍', phrase: 'Great job, excellent work!', source: 'preset', mediaPipeCategory: 'Two_Thumbs_Up', enabled: true, samples: [] },
  { id: 'preset-namaste', name: 'Prayer / Namaste 🙏', phrase: 'Please, thank you and respect', source: 'preset', mediaPipeCategory: 'Hands_Praying', enabled: true, samples: [] },
];
export const DEFAULT_SETTINGS: Settings = { runtime: 'local', autoSpeak: true, holdMs: 900, voiceURI: '', speechRate: 0.9, theme: 'system', minConfidence: 50, speechProvider: 'device', elevenVoiceId: '', elevenModel: 'eleven_turbo_v2_5' };
