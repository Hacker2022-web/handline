import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Microphone, SpeakerHigh, Stop, X } from '@phosphor-icons/react';
import type { Gesture, Settings } from '../lib/types';

export function ConversationTools({ gestures, settings, onSpeak, recognized }: { gestures: Gesture[]; settings: Settings; onSpeak: (text: string) => void; recognized?: { id: string; phrase: string; source: 'gesture' | 'manual' } }) {
  const [chainGestures, setChainGestures] = useState(false);
  const lastMessageId = useRef(recognized?.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [intent, setIntent] = useState('');
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [partnerText, setPartnerText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [textConsent, setTextConsent] = useState(false);
  const [audioConsent, setAudioConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [attention, setAttention] = useState(false);
  const [compression, setCompression] = useState('');
  const pending = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const vocabulary = gestures.filter(g => g.enabled);
  const exact = selected.join(' ');
  useEffect(() => {
    if (!recognized || recognized.id === lastMessageId.current) return;
    lastMessageId.current = recognized.id;
    if (chainGestures && recognized.source === 'gesture') { setSelected(s => [...s, recognized.phrase].slice(-3)); setDraft(''); }
  }, [recognized, chainGestures]);
  useEffect(() => {
    generation.current++; pending.current?.abort(); pending.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    if (timer.current) clearTimeout(timer.current);
    setRecording(false); setBusy(false); setDraft(''); setSuggestions([]);
    return () => { generation.current++; pending.current?.abort(); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); if (timer.current) clearTimeout(timer.current); };
  }, [settings.runtime, textConsent, audioConsent]);

  function speakReviewed(text: string) {
    if (!text.trim()) return;
    onSpeak(text.trim()); setHistory(h => [...h, text.trim()].slice(-20));
  }
  async function assist(task: 'compose' | 'expand' | 'suggest') {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setCompression('');
    try {
      const hour = new Date().getHours();
      const response = await fetch('/api/compose', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, runtime: settings.runtime, consent: textConsent, phrases: selected, intent: task === 'suggest' ? partnerText : intent, history, vocabulary: vocabulary.map(g => ({ id: g.id, phrase: g.phrase })), timeOfDay: hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Suggestions unavailable');
      if (controller.signal.aborted) return;
      if (task === 'suggest') setSuggestions(data.suggestions ?? []); else setDraft(data.draft ?? '');
      setCompression(data.compression?.enabled ? `Headroom processed earlier context; ${data.compression.tokensSaved} input tokens saved.` : 'Earlier context sent without compression.');
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Suggestions unavailable.'); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }
  async function startRecording() {
    if (!audioConsent || settings.runtime !== 'cloud') return;
    setError(''); const ownGeneration = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Audio recording is unavailable in this browser. You can type the partner’s words below.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== ownGeneration) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const instance = new MediaRecorder(media); recorder.current = instance; const chunks: Blob[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = async () => {
        media.getTracks().forEach(t => t.stop()); if (timer.current) clearTimeout(timer.current); setRecording(false);
        if (generation.current !== ownGeneration || !chunks.length) return;
        const controller = new AbortController(); pending.current = controller; setBusy(true);
        try {
          const body = new FormData(); body.append('file', new Blob(chunks, { type: instance.mimeType }), 'partner.webm'); body.append('consent', 'true');
          const response = await fetch('/api/elevenlabs/transcribe', { method: 'POST', body, signal: controller.signal }); const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? 'Transcription unavailable.');
          if (!controller.signal.aborted) setPartnerText(data.text ?? '');
        } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Transcription unavailable.'); }
        finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
      };
      instance.start(); setRecording(true); timer.current = setTimeout(() => { if (instance.state === 'recording') instance.stop(); }, 60_000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Microphone could not start.'); }
  }
  return <details className="conversation-tools runtime-card mt-6">
    <summary className="text-button">Conversation tools<ArrowRight size={18} /></summary>
    <p className="field-help mt-3">Choose your own words, then review any generated draft before speaking. These tools never replace a saved gesture’s exact phrase automatically.</p>
    {settings.runtime === 'cloud' && <label className="checkbox-label mt-4"><input type="checkbox" checked={textConsent} onChange={e => setTextConsent(e.target.checked)} />Allow selected phrases and conversation text to be sent to Google for suggestions this session.</label>}
    <section className="mt-6"><h3>Sentence composer</h3><p className="field-help mt-2">Choose phrase pieces, or add an intention. Separate each recognized gesture with a release.</p>
      <label className="checkbox-label mt-3"><input type="checkbox" checked={chainGestures} onChange={e => { lastMessageId.current = recognized?.id; setChainGestures(e.target.checked); }} />Collect the last three recognized gestures as sentence pieces.</label><p className="field-help mt-2">Turn Auto speak off to collect pieces quietly, then speak your reviewed sentence.</p>
      <div className="flex flex-wrap gap-2 mt-3">{vocabulary.map(g => <button key={g.id} className="button button-secondary" disabled={selected.length >= 8 || busy} onClick={() => { setSelected(s => [...s, g.phrase]); setDraft(''); }}>{g.phrase}</button>)}</div>
      <div className="flex flex-wrap gap-2 mt-3" aria-label="Selected sentence pieces">{selected.map((phrase, i) => <button key={i} className="button button-secondary" aria-label={`Remove piece ${i + 1}: ${phrase}`} onClick={() => { setSelected(s => s.filter((_, index) => index !== i)); setDraft(''); }}>{phrase}<X size={14} /></button>)}</div>
      <label className="field mt-4">What do you want to say?<textarea rows={2} value={intent} maxLength={600} onChange={e => { setIntent(e.target.value); setDraft(''); }} placeholder="Keep my wording short and polite." /></label>
      <div className="flex flex-wrap gap-2 mt-3"><button className="button button-secondary" disabled={!exact} onClick={() => speakReviewed(exact)}><SpeakerHigh size={18} />Speak exact pieces</button><button className="button button-secondary" disabled={busy || (!exact && !intent.trim()) || (settings.runtime === 'cloud' && !textConsent)} onClick={() => void assist('compose')}>{busy ? 'Preparing…' : 'Draft a sentence'}</button><button className="button button-secondary" disabled={busy || !intent.trim() || (settings.runtime === 'cloud' && !textConsent)} onClick={() => void assist('expand')}>Expand my intention</button></div>
      {draft && <div className="notice mt-4"><div className="w-full"><label className="field">Review and edit the proposed wording<textarea rows={3} value={draft} maxLength={600} onChange={e => setDraft(e.target.value)} /></label><button className="button button-primary mt-3" disabled={!draft.trim()} onClick={() => speakReviewed(draft)}><SpeakerHigh size={18} />Speak reviewed draft</button></div></div>}
    </section>
    <section className="mt-6"><h3>Partner scribe</h3><p className="field-help mt-2">Record up to 60 seconds with your conversation partner’s permission, or type what they said. Audio transcription uses ElevenLabs online. Response suggestions use your selected Gemma runtime.</p>
      <label className="checkbox-label mt-3"><input type="checkbox" checked={audioConsent} onChange={e => setAudioConsent(e.target.checked)} />My partner agrees to send this recording to ElevenLabs for transcription.</label>
      <div className="flex flex-wrap gap-2 mt-3">{recording ? <button className="button button-primary" onClick={() => recorder.current?.stop()}><Stop size={18} />Stop and transcribe</button> : <button className="button button-secondary" disabled={!audioConsent || busy || settings.runtime !== 'cloud'} onClick={() => void startRecording()}><Microphone size={18} />Record partner</button>}<span className="field-help" role="status">{recording ? 'Recording. Stops automatically after one minute.' : settings.runtime === 'local' ? 'Recording is disabled in Offline mode.' : ''}</span></div>
      <label className="field mt-3">Partner’s words<textarea rows={2} maxLength={600} value={partnerText} onChange={e => { setPartnerText(e.target.value); setSuggestions([]); }} /></label>
      <button className="button button-secondary mt-3" disabled={busy || !partnerText.trim() || (settings.runtime === 'cloud' && !textConsent)} onClick={() => void assist('suggest')}>Suggest saved replies</button>
      <div className="flex flex-wrap gap-2 mt-3">{suggestions.map(id => { const g = vocabulary.find(item => item.id === id); return g ? <button key={id} className="button button-secondary" onClick={() => speakReviewed(g.phrase)}><SpeakerHigh size={17} />{g.phrase}</button> : null; })}</div>
    </section>
    <section className="mt-6"><h3>Request someone’s attention</h3><p className="field-help mt-2">Shows a local attention banner. This does not contact a person or emergency service.</p><button className="button button-secondary mt-3" onClick={() => setAttention(true)}>Show attention request</button>{attention && <div className="notice mt-3" role="alert"><strong>Please come here. I need attention.</strong><button className="icon-button" onClick={() => setAttention(false)} aria-label="Dismiss attention request"><X size={20} /></button></div>}</section>
    {compression && <p className="field-help mt-4">{compression}</p>}{error && <p className="error-text mt-4" role="alert">{error}</p>}
  </details>;
}
