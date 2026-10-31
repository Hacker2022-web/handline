import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '../lib/types';

export function useSpeech(settings: Settings) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => {
    if (!supported) return;
    const update = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService));
    update(); speechSynthesis.addEventListener('voiceschanged', update);
    return () => { speechSynthesis.removeEventListener('voiceschanged', update); speechSynthesis.cancel(); };
  }, [supported]);
  const speak = useCallback((phrase: string) => {
    if (!supported) { setError('Speech is unavailable in this browser. Your message is still displayed.'); return; }
    if (!voices.length) { setError('No device voice is available yet. Choose or install a local system voice in your device settings.'); return; }
    try {
      speechSynthesis.cancel(); setError('');
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.voice = voices.find(v => v.voiceURI === settings.voiceURI) ?? voices.find(v => v.lang.startsWith('en')) ?? voices[0];
      utterance.rate = settings.speechRate;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = e => { setSpeaking(false); if (!['interrupted', 'canceled'].includes(e.error)) setError('Speech could not play. Press Speak again or choose another voice.'); };
      speechSynthesis.speak(utterance);
    } catch { setSpeaking(false); setError('Speech could not play. Your message is still displayed. Choose another local voice or try again.'); }
  }, [supported, voices, settings.voiceURI, settings.speechRate]);
  const cancel = useCallback(() => { if (supported) speechSynthesis.cancel(); setSpeaking(false); }, [supported]);
  return { voices, speak, cancel, speaking, error, supported };
}
