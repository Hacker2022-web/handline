import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import type { GestureSample, Landmark } from '../lib/types';
import { normalizeLandmarks } from '../lib/matching';

export type Observation = { landmarks: Landmark[]; category: string | null; score: number; hands: number; at: number };
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

export function useCamera(onFrame: (frame: Observation) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const observationRef = useRef<Observation | null>(null);
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;
  const generation = useRef(0);
  const raf = useRef(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [handCount, setHandCount] = useState(0);

  const stop = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recognizerRef.current?.close();
    recognizerRef.current = null;
    observationRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHandCount(0);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    stop();
    const ownGeneration = generation.current;
    setStatus('loading'); setError('');
    let recognizer: GestureRecognizer | null = null;
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or HTTPS and a supported browser.');
      const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/mediapipe');
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/gesture_recognizer.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
      });
      if (generation.current !== ownGeneration) { recognizer.close(); return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      if (generation.current !== ownGeneration) { stream.getTracks().forEach(t => t.stop()); recognizer.close(); return; }
      recognizerRef.current = recognizer;
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is not available. Please try again.');
      video.srcObject = stream;
      await video.play();
      if (generation.current !== ownGeneration) return;
      setStatus('ready');
      let previous = -1;
      let processed = -100;
      const loop = (now: number) => {
        if (generation.current !== ownGeneration) return;
        if (video.readyState >= 2 && video.currentTime !== previous && now - processed > 85) {
          previous = video.currentTime; processed = now;
          try {
            const result: GestureRecognizerResult = recognizer!.recognizeForVideo(video, now);
            const observation: Observation = {
              landmarks: result.landmarks[0] ?? [], category: result.gestures[0]?.[0]?.categoryName ?? null,
              score: result.gestures[0]?.[0]?.score ?? 0, hands: result.landmarks.length, at: now,
            };
            observationRef.current = observation;
            setHandCount(observation.hands);
            const canvas = canvasRef.current;
            if (canvas) {
              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#b5d5b0'; ctx.fillStyle = '#e9f3df'; ctx.lineWidth = 2;
                for (const points of result.landmarks) {
                  for (const [a, b] of CONNECTIONS) {
                    ctx.beginPath(); ctx.moveTo(points[a].x * canvas.width, points[a].y * canvas.height); ctx.lineTo(points[b].x * canvas.width, points[b].y * canvas.height); ctx.stroke();
                  }
                  points.forEach(p => { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2); ctx.fill(); });
                }
              }
            }
            callbackRef.current(observation);
          } catch {
            stop(); setStatus('error'); setError('Hand tracking stopped. Restart the camera to try again.'); return;
          }
        }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    } catch (cause) {
      stream?.getTracks().forEach(t => t.stop());
      recognizer?.close();
      if (generation.current !== ownGeneration) return;
      recognizerRef.current = null; streamRef.current = null;
      setStatus('error');
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Camera permission was declined. Allow it in your browser settings, then try again.' : name === 'NotFoundError' ? 'No camera was found. Connect a webcam, then try again.' : name === 'NotReadableError' ? 'The camera is in use by another app. Close it there and try again.' : cause instanceof Error ? cause.message : 'Could not start the camera. Please try again.');
    }
  }, [stop]);

  const capture = useCallback((): GestureSample | null => {
    const video = videoRef.current;
    const frame = observationRef.current;
    if (!video || !frame || frame.hands !== 1 || performance.now() - frame.at > 400) return null;
    const landmarks = normalizeLandmarks(frame.landmarks);
    if (!landmarks.length) return null;
    const xs = frame.landmarks.map(p => p.x * video.videoWidth);
    const ys = frame.landmarks.map(p => p.y * video.videoHeight);
    const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.45;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
    const ctx = canvas.getContext('2d'); if (!ctx || side < 12) return null;
    ctx.fillStyle = '#252c28'; ctx.fillRect(0, 0, 320, 320);
    ctx.drawImage(video, cx - side / 2, cy - side / 2, side, side, 0, 0, 320, 320);
    return { landmarks, referenceCrop: canvas.toDataURL('image/jpeg', 0.76), capturedAt: Date.now() };
  }, []);

  useEffect(() => () => { stop(); }, [stop]);
  useEffect(() => {
    const onEnded = () => { stop(); setError('Camera disconnected. Reconnect it and try again.'); setStatus('error'); };
    const track = streamRef.current?.getVideoTracks()[0];
    track?.addEventListener('ended', onEnded);
    return () => track?.removeEventListener('ended', onEnded);
  }, [status, stop]);
  return { videoRef, canvasRef, observationRef, status, error, handCount, start, stop, capture };
}
