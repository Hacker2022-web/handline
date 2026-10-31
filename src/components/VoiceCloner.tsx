import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';

export function AudioRecorder({ onRecording, maxSeconds = 120 }: { onRecording: (file: File) => void; maxSeconds?: number }) {
  const mounted = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [error, setError] = useState('');
  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current); setRecording(false); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearInterval(timer.current); if (recorder.current) recorder.current.onstop = null; stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function start() {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable in this browser. Upload an audio file instead.');
      const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); if (!mounted.current) { input.getTracks().forEach(t => t.stop()); return; } stream.current = input;
      const media = new MediaRecorder(input); recorder.current = media; const chunks: BlobPart[] = [];
      media.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      media.onstop = () => { const type = media.mimeType || 'audio/webm'; onRecording(new File(chunks, `voice-recording.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type })); input.getTracks().forEach(t => t.stop()); };
      let elapsed = 0; setSeconds(0); media.start(); setRecording(true);
      timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= maxSeconds) stop(); }, 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Microphone access was declined. You can upload a recording instead.'); }
  }
  return <div className="space-y-3"><div className="flex items-center gap-3"><button type="button" className="button button-secondary" onClick={() => recording ? stop() : void start()}>{recording ? 'Stop recording' : 'Record microphone'}</button><span role="status" className="mono text-sm">{recording ? `Recording · ${seconds}s / ${maxSeconds}s` : 'Microphone off'}</span></div>{error && <p role="alert" className="error-text">{error}</p>}</div>;
}

export function VoiceCloner({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, requiresVerification: boolean) => void }) {
  const [name, setName] = useState('My personal voice'), [files, setFiles] = useState<File[]>([]), [consent, setConsent] = useState(false), [isolate, setIsolate] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState('');
  useEffect(() => { if (!files[0]) { setPreview(''); return; } const url = URL.createObjectURL(files[0]); setPreview(url); return () => URL.revokeObjectURL(url); }, [files]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!consent || !files.length || !name.trim()) return;
    setBusy(true);
    try {
      const body = new FormData(); body.set('name', name.trim()); body.set('consent', 'true'); body.set('isolate', String(isolate)); files.forEach(file => body.append('samples', file));
      const response = await fetch('/api/elevenlabs/clone', { method: 'POST', body }); const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Voice creation failed.');
      onCreated(data.voiceId, data.requiresVerification === true); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the voice.'); } finally { setBusy(false); }
  }
  return <Dialog title="Bank your personal voice" wide onClose={onClose}><form onSubmit={submit} className="space-y-5"><p className="dialog-intro">Record 1–2 minutes of clear speech or upload up to two recordings. Creating a voice sends these samples to your ElevenLabs account and may require a paid plan or verification.</p><label className="field">Voice name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} required /></label><div className="footnote-box"><p>Read naturally: “These are my words, spoken in my own voice. I would like a little water, please. Thank you for listening and giving me time to respond.” Continue with a familiar passage for a minute or two.</p></div><AudioRecorder onRecording={file => setFiles([file])} /><label className="field">Or choose audio recordings<input type="file" accept="audio/*" multiple onChange={e => { setError(''); const selected = [...e.target.files ?? []]; if (selected.length > 2 || selected.some(f => f.size > 15 * 1024 * 1024)) { setError('Choose up to two audio files, each under 15 MB.'); return; } setFiles(selected); }} /></label>{files.length > 0 && <div><p className="muted text-sm">{files.map(f => f.name).join(', ')}</p>{preview && <audio controls src={preview} aria-label="Preview your voice sample" className="w-full mt-3" />}</div>}<label className="checkbox-label"><input type="checkbox" checked={isolate} onChange={e => setIsolate(e.target.checked)} />Remove background noise when creating this voice</label><label className="checkbox-label"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required />This is my own voice, or I have the speaker’s permission to clone it. I allow these recordings to be sent to ElevenLabs to create the voice.</label>{error && <p role="alert" className="error-text">{error}</p>}<div className="dialog-footer"><button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !consent || !files.length}>{busy ? 'Creating voice…' : 'Create personal voice'}</button></div></form></Dialog>;
}
