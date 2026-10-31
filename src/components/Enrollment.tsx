import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Hand, ArrowCounterClockwise, WarningCircle } from '@phosphor-icons/react';
import type { Gesture, GestureSample } from '../lib/types';
import { findOverlaps } from '../lib/matching';
import type { useCamera } from '../hooks/useCamera';
import { Dialog } from './Dialog';

export function Enrollment({ gesture, gestures, camera, onSave, onClose }: {
  gesture?: Gesture; gestures: Gesture[]; camera: ReturnType<typeof useCamera>;
  onSave: (gesture: Gesture) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(gesture?.name ?? '');
  const [phrase, setPhrase] = useState(gesture?.phrase ?? '');
  const [samples, setSamples] = useState<GestureSample[]>(gesture?.samples ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [presetOverlap, setPresetOverlap] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPreset = gesture?.source === 'preset';
  const overlaps = useMemo(() => findOverlaps(samples, gestures, gesture?.id), [samples, gestures, gesture?.id]);
  useEffect(() => {
    const video = previewRef.current;
    if (video && camera.status === 'ready' && camera.videoRef.current?.srcObject) {
      video.srcObject = camera.videoRef.current.srcObject;
      void video.play().catch(() => {});
    }
  }, [camera.status, camera.videoRef]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  function capture() {
    const sample = camera.capture();
    if (!sample) { setError('Show exactly one clear hand in the camera before capturing.'); return; }
    setSamples(previous => [...previous, sample]); setError(''); setAcknowledged(false); setCooldown(true);
    const category = camera.observationRef.current?.category;
    const match = gestures.find(g => g.enabled && g.source === 'preset' && g.mediaPipeCategory === category);
    if (match) setPresetOverlap(match.name);
    timerRef.current = setTimeout(() => setCooldown(false), 450);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!name.trim() || !phrase.trim()) { setError('Enter a gesture name and the exact phrase to display.'); return; }
    if (!isPreset && samples.length < 8) { setError('Capture at least eight examples before saving.'); return; }
    if (!isPreset && (overlaps.length || presetOverlap) && !acknowledged) { setError('Review the overlap warning and confirm before saving.'); return; }
    setBusy(true);
    try {
      await onSave({ id: gesture?.id ?? `custom-${crypto.randomUUID()}`, name: name.trim(), phrase: phrase.trim(), source: gesture?.source ?? 'custom', mediaPipeCategory: gesture?.mediaPipeCategory, enabled: gesture?.enabled ?? true, samples });
      onClose();
    } catch { setError('Could not save to this browser. Check available storage and try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog title={isPreset ? 'Make this phrase yours' : gesture ? 'Edit your gesture' : 'A new way to say it'} onClose={onClose} wide={!isPreset}>
    <form onSubmit={submit}>
      <p className="dialog-intro">{isPreset ? 'This gesture always uses your saved words. Change them whenever you need.' : 'Give a repeatable, one-hand pose a name and the words you want it to say.'}</p>
      <div className={isPreset ? 'space-y-5' : 'enrollment-grid'}>
        <div className="space-y-5">
          <label className="field">Gesture name<input maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. A little water" required /></label>
          <label className="field">Exact phrase<textarea maxLength={300} value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Could I have some water, please?" rows={3} required /><span className="field-help">These are the exact words that will appear and be spoken.</span></label>
          {!isPreset && <>
            <div className="section-label"><h3>Teach your gesture</h3><span className="mono">{samples.length} / 8 minimum</span></div>
            <p className="muted text-sm">Capture the same pose eight times. Vary the distance and angle a little; keep your fingers clearly visible.</p>
            <div className="sample-grid" aria-label={`${samples.length} recorded samples`}>
              {Array.from({ length: Math.max(8, samples.length) }, (_, i) => <div key={i} className={`sample ${samples[i] ? 'sample-filled' : ''}`}>{samples[i] ? <><img src={samples[i].referenceCrop} alt={`Hand reference ${i + 1}`} /><Check size={14} weight="bold" /></> : <span>{String(i + 1).padStart(2, '0')}</span>}</div>)}
            </div>
            <div className="flex flex-wrap gap-3"><button type="button" className="text-button" disabled={!samples.length} onClick={() => { setSamples(s => s.slice(0, -1)); setAcknowledged(false); }}><ArrowCounterClockwise size={16} />Retake last</button><button type="button" className="text-button" disabled={!samples.length} onClick={() => { setSamples([]); setPresetOverlap(''); setAcknowledged(false); }}>Re-record all</button></div>
          </>}
        </div>
        {!isPreset && <div>
          <div className="enrollment-camera">
            <video ref={previewRef} muted playsInline className="mirror" aria-label="Enrollment camera preview" />
            {camera.status !== 'ready' && <div className="enrollment-camera-empty"><Hand size={46} weight="thin" /><span>{camera.status === 'loading' ? 'Preparing hand tracking…' : 'Your hand goes here'}</span><button type="button" className="button button-light" disabled={camera.status === 'loading'} onClick={() => void camera.start()}><Camera size={18} />{camera.status === 'loading' ? 'Starting camera…' : 'Start camera'}</button></div>}
            {camera.status === 'ready' && <span className="camera-mini-status"><span className="status-dot" />{camera.handCount === 1 ? 'One hand detected' : camera.handCount > 1 ? 'Use one hand' : 'Looking for your hand'}</span>}
          </div>
          <button type="button" className="button button-primary w-full mt-4" disabled={camera.status !== 'ready' || cooldown || samples.length >= 12} onClick={capture}><Camera size={19} />{samples.length >= 12 ? '12 examples captured' : `Capture sample ${samples.length + 1}`}</button>
          {camera.error && <p role="alert" className="error-text mt-3">{camera.error}</p>}
          <p className="field-help mt-3">Only selected hand crops are saved on this device. No video is recorded.</p>
        </div>}
      </div>
      {!isPreset && (overlaps.length > 0 || presetOverlap) && <div className="notice mt-5"><WarningCircle size={21} /><div><strong>Some poses look similar</strong><p>{overlaps.length ? `This resembles ${overlaps.join(', ')}. Distinct finger positions can reduce uncertain matches. ` : ''}{presetOverlap ? `It also resembles ${presetOverlap}. A confident custom match takes priority over a preset.` : ''}</p><label className="checkbox-label mt-3"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />I have reviewed the overlap and want to save this gesture.</label></div></div>}
      {error && <p role="alert" className="error-text mt-4">{error}</p>}
      <div className="dialog-footer"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || (!isPreset && samples.length < 8)}>{busy ? 'Saving…' : 'Save gesture'}<ArrowRight size={18} /></button></div>
    </form>
  </Dialog>;
}
