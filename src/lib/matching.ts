import type { Gesture, Landmark } from './types';

// Wrist-relative, scale-normalized; retain rotation so up/down poses stay distinct.
export function normalizeLandmarks(points: Landmark[]): number[] {
  if (points.length !== 21 || points.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) return [];
  const wrist = points[0];
  const scale = Math.hypot(points[9].x - wrist.x, points[9].y - wrist.y);
  if (scale < 0.015) return [];
  return points.flatMap(p => [(p.x - wrist.x) / scale, (p.y - wrist.y) / scale, (p.z - wrist.z) / scale * 0.4]);
}

export function landmarkDistance(a: number[], b: number[]): number {
  if (![63, 126].includes(a.length) || b.length !== a.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return Infinity;
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);
}

export function rankCandidates(landmarks: number[], gestures: Gesture[], threshold = 0.16) {
  return gestures.filter(g => g.enabled && g.source === 'custom' && g.samples.length >= 8 && (g.handMode === 'dual' ? landmarks.length === 126 : landmarks.length === 63))
    .map(gesture => {
      const distances = gesture.samples.map(s => landmarkDistance(landmarks, s.landmarks)).sort((a, b) => a - b);
      // Requiring the closest three avoids a single accidental enrollment outlier.
      return { gesture, distance: distances.slice(0, 3).reduce((a, b) => a + b, 0) / 3 };
    }).filter(c => c.distance <= threshold).sort((a, b) => a.distance - b.distance).slice(0, 3);
}

export function isAmbiguous(candidates: { distance: number }[]) {
  return candidates.length > 1 && candidates[1].distance - candidates[0].distance < 0.025;
}

export function findOverlaps(samples: { landmarks: number[] }[], gestures: Gesture[], excludeId?: string) {
  return gestures.filter(g => g.id !== excludeId && g.source === 'custom' && g.samples.length >= 8)
    .filter(g => samples.filter(s => g.samples.some(r => landmarkDistance(s.landmarks, r.landmarks) < 0.13)).length >= 3)
    .map(g => g.name);
}

// Shared origin and palm scale retain inter-wrist displacement as well as orientation.
export function normalizeDualHandLandmarks(left: Landmark[], right: Landmark[]): number[] {
  if (!normalizeLandmarks(left).length || !normalizeLandmarks(right).length) return [];
  const scale = (Math.hypot(left[9].x-left[0].x,left[9].y-left[0].y)+Math.hypot(right[9].x-right[0].x,right[9].y-right[0].y))/2;
  return [...left,...right].flatMap(p=>[(p.x-left[0].x)/scale,(p.y-left[0].y)/scale,(p.z-left[0].z)/scale*0.4]);
}
export function matchScore(distance: number) { return Math.max(0, Math.min(100, Math.round((1-distance/0.32)*100))); }
