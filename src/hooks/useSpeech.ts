import { useCallback, useEffect, useRef, useState } from 'react';
import { openDB } from 'idb';
import type { Settings } from '../lib/types';

const CONSENT_KEY = 'handline-speech-consent';
export function cloudSpeechAllowed() { try { return sessionStorage.getItem(CONSENT_KEY) === 'true'; } catch { return false; } }
export function setCloudSpeechConsent(allowed: boolean) { try { sessionStorage.setItem(CONSENT_KEY, String(allowed)); } catch { /* unavailable session storage keeps permission disabled */ } window.dispatchEvent(new Event('handline-speech-consent')); }
const audioDB = () => openDB('handline-audio', 1, { upgrade(db) { db.createObjectStore('audio-cache'); } });
export async function cacheConfirmationCue(blob:Blob) { await (await audioDB()).put('audio-cache',blob,'@confirmation-cue'); }
export async function clearSpeechCache() { await (await audioDB()).clear('audio-cache'); }

export function useSpeech(settings: Settings) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cue=useRef<HTMLAudioElement|null>(null);
  const generation = useRef(0), request = useRef<AbortController | null>(null), audio = useRef<HTMLAudioElement | null>(null), objectURL = useRef<string | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const cancel = useCallback(() => {
    generation.current++; cue.current?.pause(); request.current?.abort(); request.current = null;
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
    if (objectURL.current) { URL.revokeObjectURL(objectURL.current); objectURL.current = null; }
    if (supported) speechSynthesis.cancel(); setSpeaking(false); setLoading(false);
  }, [supported]);
  useEffect(() => {
    if (!supported) return;
    const update = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService));
    update(); speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, [supported]);
  useEffect(() => { cancel(); return cancel; }, [settings.runtime, settings.speechProvider, settings.elevenVoiceId, settings.elevenModel, cancel]);
  useEffect(() => { const revoke = () => { if (!cloudSpeechAllowed()) cancel(); }; window.addEventListener('handline-speech-consent', revoke); return () => window.removeEventListener('handline-speech-consent', revoke); }, [cancel]);
  const deviceSpeak = useCallback((phrase: string, ownGeneration: number) => {
    if (generation.current !== ownGeneration) return;
    if (!supported) { setError('Device speech is unavailable in this browser. Your message is still displayed.'); return; }
    if (!voices.length) { setError('No device voice is available yet. Install a local system voice in your device settings.'); return; }
    try {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.voice = voices.find(v => v.voiceURI === settings.voiceURI) ?? voices.find(v => v.lang.startsWith('en')) ?? voices[0];
      utterance.rate = settings.speechRate;
      utterance.onstart = () => { if (generation.current === ownGeneration) setSpeaking(true); };
      utterance.onend = () => { if (generation.current === ownGeneration) setSpeaking(false); };
      utterance.onerror = e => { if (generation.current === ownGeneration) { setSpeaking(false); if (!['interrupted', 'canceled'].includes(e.error)) setError('Speech could not play. Press Speak again or choose another voice.'); } };
      speechSynthesis.speak(utterance);
    } catch { setSpeaking(false); setError('Speech could not play. Your message is still displayed.'); }
  }, [supported, voices, settings.voiceURI, settings.speechRate]);
  const speak = useCallback((phrase: string) => {
    cancel(); const ownGeneration = generation.current; setError('');
    if (settings.speechProvider !== 'elevenlabs' || !settings.elevenVoiceId) { deviceSpeak(phrase, ownGeneration); return; }
    void (async () => {
      setLoading(true);
      try {
        const key = JSON.stringify([settings.elevenVoiceId, settings.elevenModel, settings.elevenLanguage ?? '', phrase]);
        let blob: Blob | undefined;
        try { blob = await (await audioDB()).get('audio-cache', key); } catch { /* caching is optional */ }
        if (generation.current !== ownGeneration) return;
        if (!blob) {
          if (settings.runtime === 'local' || !navigator.onLine || !cloudSpeechAllowed()) {
            setLoading(false); setError('Using device speech. Cloud audio needs Online mode and speech permission; cached phrases can play offline.'); deviceSpeak(phrase, ownGeneration); return;
          }
          const controller = new AbortController(); request.current = controller;
          const response = await fetch('/api/elevenlabs/tts', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: phrase, voiceId: settings.elevenVoiceId, modelId: settings.elevenModel, ...(settings.elevenLanguage ? { languageCode: settings.elevenLanguage } : {}), consent: true }) });
          if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error ?? 'Cloud speech unavailable.'); }
          blob = await response.blob();
          if (!blob.type.startsWith('audio/')) throw new Error('Cloud speech returned an invalid audio response.');
          if (generation.current !== ownGeneration || !cloudSpeechAllowed()) return;
          try { const db = await audioDB(); await db.put('audio-cache', blob, key); const keys = await db.getAllKeys('audio-cache'); if (keys.length > 100) await db.delete('audio-cache', keys[0]); } catch { /* play even if cache write fails */ }
        }
        if (generation.current !== ownGeneration) return;
        const url = URL.createObjectURL(blob); objectURL.current = url;
        const player = new Audio(url); audio.current = player; player.playbackRate = settings.speechRate;
        player.onended = () => { if (generation.current === ownGeneration) { setSpeaking(false); URL.revokeObjectURL(url); objectURL.current = null; audio.current = null; } };
        player.onerror = () => { if (generation.current === ownGeneration) { setSpeaking(false); setError('Audio playback failed. Using device speech.'); deviceSpeak(phrase, ownGeneration); } };
        await player.play(); if (generation.current === ownGeneration) { setLoading(false); setSpeaking(true); }
      } catch (cause) {
        if (generation.current !== ownGeneration) return;
        setLoading(false); setError(`${cause instanceof Error ? cause.message : 'Cloud speech unavailable.'} Using device speech.`); deviceSpeak(phrase, ownGeneration);
      }
    })();
  }, [cancel, deviceSpeak, settings.speechProvider, settings.elevenVoiceId, settings.elevenModel, settings.elevenLanguage, settings.runtime, settings.speechRate]);
  const confirm=useCallback(()=>{if(!settings.confirmationCue)return;const own=generation.current;void audioDB().then(db=>db.get('audio-cache','@confirmation-cue')).then((blob:Blob|undefined)=>{if(!blob||own!==generation.current)return;const url=URL.createObjectURL(blob),player=new Audio(url);cue.current=player;player.onended=()=>URL.revokeObjectURL(url);player.onerror=()=>URL.revokeObjectURL(url);void player.play().catch(()=>URL.revokeObjectURL(url));}).catch(()=>{});},[settings.confirmationCue]);
  return { voices, confirm, speak, cancel, speaking, loading, error, supported };
}
