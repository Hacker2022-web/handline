import { useCallback, useEffect, useRef, useState } from 'react';
import { isAmbiguous, normalizeLandmarks, rankCandidates, landmarkDistance, normalizeDualHandLandmarks, matchScore } from '../lib/matching';
import { StabilityGate } from '../lib/stability';
import type { Gesture, GestureSample, Settings } from '../lib/types';
import type { Observation } from './useCamera';

type RecognitionState = { label: string; detail: string; progress: number; kind: 'idle' | 'tracking' | 'verifying' | 'recognized' | 'error' };
const IDLE: RecognitionState = { label: 'Ready when you are', detail: 'Start the camera, then hold one gesture.', progress: 0, kind: 'idle' };
export function useRecognition(options: {
  gestures: Gesture[]; settings: Settings; consent: boolean; active: boolean;
  capture: (mode?: 'single' | 'dual') => GestureSample | null; onRecognized: (gesture: Gesture) => void;
}) {
  const latest = useRef(options); latest.current = options;
  const gate = useRef(new StabilityGate(options.settings.holdMs));
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const frameRef = useRef<Observation | null>(null);
  const settled = useRef<RecognitionState | null>(null);
  const [score, setScore] = useState(0);
  const [inspection, setInspection] = useState<{reasoning:string;contactSheet?:string;latencyMs:number}|null>(null);
  const [inspect, setInspect] = useState(false);
  const inspectRef = useRef(false); inspectRef.current=inspect;
  const vector = (f:Observation) => f.hands === 2 && f.allHands?.length === 2 ? normalizeDualHandLandmarks(f.allHands[0].landmarks,f.allHands[1].landmarks) : f.hands === 1 ? normalizeLandmarks(f.landmarks) : [];
  const [state, setState] = useState<RecognitionState>(IDLE);

  const reset = useCallback(() => {
    epoch.current++; pending.current?.abort(); pending.current = null;
    gate.current.reset(); settled.current = null; setState(IDLE);
  }, []);
  useEffect(() => { gate.current.holdMs = options.settings.holdMs; reset(); return () => { epoch.current++; pending.current?.abort(); }; }, [options.active, options.gestures, options.settings.runtime, options.settings.holdMs, options.settings.minConfidence, options.consent, reset]);

  const onFrame = useCallback((frame: Observation) => {
    frameRef.current = frame;
    const current = latest.current;
    if (!current.active || document.hidden) return;
    const normalized = vector(frame);
    const threshold = Math.max(50,current.settings.minConfidence ?? 50);
    const candidates = rankCandidates(normalized, current.gestures, 0.32);
    const preset = (frame.hands === 1 || frame.hands === 2) ? current.gestures.find(g => g.enabled && g.source === 'preset' && (g.mediaPipeCategory === frame.category || (frame.category === 'Stop_Hand' && g.mediaPipeCategory === 'Open_Palm') || (frame.category === 'Open_Palm' && g.mediaPipeCategory === 'Stop_Hand'))) : undefined;
    const custom = candidates.length && !isAmbiguous(candidates) ? candidates[0].gesture : undefined;
    // Explicitly enrolled custom poses take precedence over editable starter mappings.
    // Conflicting custom matches must not accidentally fall through to a preset phrase.
    const confidence = candidates.length ? matchScore(candidates[0].distance) : preset ? Math.round(frame.score*100) : 0;
    setScore(confidence);
    const match = isAmbiguous(candidates) || confidence < threshold ? undefined : custom ?? preset;
    gate.current.holdMs = match?.priority && match.handMode === 'dual' ? 400 : current.settings.holdMs;
    const result = gate.current.update(match?.id ?? null, frame.at);
    if (!match) {
      if (pending.current) { epoch.current++; pending.current.abort(); pending.current = null; }
      if (!result.latched) settled.current = null;
      setState({ label: 'Unknown gesture', detail: isAmbiguous(candidates) ? 'These gestures look too similar. Try a more distinct pose.' : frame.hands ? 'No confident match. Nothing will be spoken.' : 'Bring one hand into the camera view.', progress: 0, kind: 'idle' });
      return;
    }
    if (pending.current) {
      // A changed pose invalidates any pending answer, even if it arrives later.
      if (settled.current?.label !== match.id) { epoch.current++; pending.current.abort(); pending.current = null; settled.current = null; }
      else return;
    }
    if (result.latched && !result.trigger) {
      setState(settled.current && settled.current.label !== match.id ? settled.current : { label: 'Release to repeat', detail: 'Lower your hand briefly before your next message.', progress: 1, kind: 'recognized' });
      return;
    }
    setState({ label: match.name, detail: 'Hold steady to confirm your gesture.', progress: result.progress, kind: 'tracking' });
    if (!result.trigger) return;
    if (match.source === 'preset') {
      settled.current = { label: match.name, detail: 'Message selected. Lower your hand to repeat.', progress: 1, kind: 'recognized' };
      setState(settled.current); current.onRecognized(match); return;
    }
    if (current.settings.runtime === 'cloud' && !current.consent) {
      settled.current = { label: 'Cloud permission needed', detail: 'Allow selected images in Runtime & setup, or choose Local.', progress: 0, kind: 'error' }; setState(settled.current); return;
    }
    const sample = current.capture(match.handMode);
    if (!sample) { settled.current = { label: 'Unknown gesture', detail: 'The hand moved before capture. Release and try again.', progress: 0, kind: 'idle' }; setState(settled.current); return; }
    const ownEpoch = epoch.current;
    const controller = new AbortController(); pending.current = controller;
    settled.current = { label: match.id, detail: '', progress: 1, kind: 'verifying' };
    setState({ label: 'Checking your gesture', detail: current.settings.runtime === 'local' ? 'Gemma is comparing selected images on this device. Keep your pose.' : 'Gemma is comparing selected images online. Keep your pose.', progress: 1, kind: 'verifying' });
    void (async () => {
      try {
        const response = await fetch('/api/verify-gesture', {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runtime: current.settings.runtime, cloudConsent: current.consent, inspect: inspectRef.current, image: sample.referenceCrop, candidates: candidates.map(c => ({ id: c.gesture.id, name: c.gesture.name, references: [...c.gesture.samples].sort((a, b) => landmarkDistance(sample.landmarks, a.landmarks) - landmarkDistance(sample.landmarks, b.landmarks)).slice(0, 2).map(s => s.referenceCrop) })) }),
        });
        const data = await response.json();
        if (epoch.current !== ownEpoch || controller.signal.aborted || !latest.current.active || document.hidden) return;
        if (inspectRef.current && data.contactSheet) setInspection({reasoning: data.reasoning ?? 'No visual explanation returned.',contactSheet:data.contactSheet,latencyMs:data.latencyMs ?? 0});
        if (!response.ok) throw new Error(data.error ?? 'Verification unavailable');
        const lastFrame = frameRef.current;
        const chosen = candidates.find(c => c.gesture.id === data.gestureId)?.gesture;
        const freshCandidates = lastFrame && [1,2].includes(lastFrame.hands) && performance.now() - lastFrame.at < 400 ? rankCandidates(vector(lastFrame), latest.current.gestures, 0.32) : [];
        if (!chosen || freshCandidates[0]?.gesture.id !== chosen.id || isAmbiguous(freshCandidates) || matchScore(freshCandidates[0]?.distance ?? Infinity) < Math.max(50,latest.current.settings.minConfidence ?? 50)) {
          settled.current = { label: 'Unknown gesture', detail: 'No confident visual match. Nothing was spoken.', progress: 0, kind: 'idle' };
        } else {
          settled.current = { label: chosen.name, detail: 'Message selected. Lower your hand to repeat.', progress: 1, kind: 'recognized' };
          latest.current.onRecognized(chosen);
        }
        setState(settled.current);
      } catch (error) {
        if (epoch.current !== ownEpoch || controller.signal.aborted) return;
        settled.current = { label: 'Verification unavailable', detail: error instanceof Error ? error.message : 'Try again. Presets and manual phrases still work.', progress: 0, kind: 'error' };
        setState(settled.current);
      } finally { if (pending.current === controller) pending.current = null; }
    })();
  }, []);
  return { state, score, inspection, inspect, setInspect, onFrame, reset };
}
