import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import type { GestureSample, Landmark } from '../lib/types';
import { normalizeLandmarks, normalizeDualHandLandmarks } from '../lib/matching';

export type Observation = { landmarks: Landmark[]; allHands?: { landmarks: Landmark[]; handedness: string }[]; category: string | null; score: number; hands: number; at: number };
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

function classifyHandPose(points: Landmark[] | undefined, defaultCat: string | null, defaultScore: number) {
  if (!points || points.length < 21) return { category: defaultCat, score: defaultScore };
  const d = (i: number, j: number) => Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y, (points[i].z - points[j].z) * 0.4);
  const scale = d(0, 9);
  if (scale < 0.02) return { category: defaultCat, score: defaultScore };

  // 1. OK Sign (Thumb tip 4 touches Index tip 8; middle 12, ring 16, pinky 20 extended)
  const thumbIndexDist = d(4, 8) / scale;
  const middleExt = d(12, 0) > d(10, 0);
  const ringExt = d(16, 0) > d(14, 0);
  const pinkyExt = d(20, 0) > d(18, 0);
  if (thumbIndexDist < 0.42 && middleExt && ringExt && pinkyExt) {
    return { category: 'OK_Sign', score: 0.92 };
  }

  // 2. Shaka Sign (Thumb 4 extended, Pinky 20 extended; Index 8, Middle 12, Ring 16 curled)
  const thumbExt = d(4, 0) > d(2, 0) * 1.15;
  const indexCurled = d(8, 0) < d(6, 0) * 1.1;
  const middleCurled = d(12, 0) < d(10, 0) * 1.1;
  const ringCurled = d(16, 0) < d(14, 0) * 1.1;
  if (thumbExt && pinkyExt && indexCurled && middleCurled && ringCurled) {
    return { category: 'Shaka', score: 0.92 };
  }

  // 3. Crossed Fingers (Index 8 and Middle 12 extended and crossing/close; Ring 16 and Pinky 20 curled)
  const indexExt = d(8, 0) > d(6, 0);
  const indexMidDist = d(8, 12) / scale;
  if (indexExt && middleExt && ringCurled && !pinkyExt && indexMidDist < 0.35) {
    return { category: 'Crossed_Fingers', score: 0.90 };
  }

  // 4. Stop Hand (Open palm facing forward with upright fingers)
  if (defaultCat === 'Open_Palm') {
    const isUpright = points[12].y < points[0].y && Math.abs(points[12].x - points[0].x) < scale * 0.45;
    if (isUpright) return { category: 'Stop_Hand', score: defaultScore };
  }

  return { category: defaultCat, score: defaultScore };
}

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
            const numHands = result.landmarks.length;
            const rawCat0 = result.gestures[0]?.[0]?.categoryName ?? null;
            const rawScore0 = result.gestures[0]?.[0]?.score ?? 0;
            const rawCat1 = result.gestures[1]?.[0]?.categoryName ?? null;
            const rawScore1 = result.gestures[1]?.[0]?.score ?? 0;

            const hand0 = classifyHandPose(result.landmarks[0], rawCat0, rawScore0);
            const hand1 = classifyHandPose(result.landmarks[1], rawCat1, rawScore1);

            let category = hand0.category;
            let score = hand0.score;

            if (numHands === 2 && hand0.category && hand1.category) {
              if (hand0.category === 'Thumb_Up' && hand1.category === 'Thumb_Up') {
                category = 'Two_Thumbs_Up';
                score = Math.min(hand0.score, hand1.score);
              } else if ((hand0.category === 'Open_Palm' || hand0.category === 'Stop_Hand') && (hand1.category === 'Open_Palm' || hand1.category === 'Stop_Hand')) {
                const wrist0 = result.landmarks[0][0];
                const wrist1 = result.landmarks[1][0];
                const dist = Math.hypot(wrist0.x - wrist1.x, wrist0.y - wrist1.y);
                category = dist < 0.28 ? 'Hands_Praying' : 'Two_Open_Palms';
                score = Math.min(hand0.score, hand1.score);
              } else if (hand0.category === 'Victory' && hand1.category === 'Victory') {
                category = 'Two_Victory';
                score = Math.min(hand0.score, hand1.score);
              } else if (hand0.category === 'Closed_Fist' && hand1.category === 'Closed_Fist') {
                category = 'Two_Fists';
                score = Math.min(hand0.score, hand1.score);
              }
            }

            const observation: Observation = {
              allHands: result.landmarks.map((landmarks,i)=>({landmarks,handedness:result.handedness[i]?.[0]?.categoryName ?? 'Unknown'})).sort((a,b)=>a.handedness.localeCompare(b.handedness) || a.landmarks[0].x-b.landmarks[0].x),
              landmarks: result.landmarks[0] ?? [],
              category,
              score,
              hands: numHands,
              at: now,
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

  const capture = useCallback((handMode: 'single' | 'dual' = 'single'): GestureSample | null => {
    const video = videoRef.current;
    const frame = observationRef.current;
    if (!video || !frame || frame.hands !== (handMode === 'dual' ? 2 : 1) || performance.now() - frame.at > 400) return null;
    const landmarks = handMode === 'dual' && frame.allHands?.length === 2 ? normalizeDualHandLandmarks(frame.allHands[0].landmarks, frame.allHands[1].landmarks) : normalizeLandmarks(frame.landmarks);
    const cropPoints = frame.allHands?.flatMap(h=>h.landmarks) ?? frame.landmarks;
    if (!landmarks.length) return null;
    const xs = cropPoints.map(p => p.x * video.videoWidth);
    const ys = cropPoints.map(p => p.y * video.videoHeight);
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
