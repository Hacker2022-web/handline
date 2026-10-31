import type { Gesture, Landmark } from './types';

// Wrist-relative, scale-normalized; retain rotation so up/down poses stay distinct.
// Supports both 1-hand (21 landmarks -> 63 features) and 2-hand (42 landmarks -> 129 features) poses.
export function normalizeLandmarks(points: Landmark[]): number[] {
  if ((points.length !== 21 && points.length !== 42) || points.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) return [];
  if (points.length === 21) {
    const wrist = points[0];
    const scale = Math.hypot(points[9].x - wrist.x, points[9].y - wrist.y);
    if (scale < 0.015) return [];
    return points.flatMap(p => [(p.x - wrist.x) / scale, (p.y - wrist.y) / scale, (p.z - wrist.z) / scale * 0.4]);
  }
  const h1 = points.slice(0, 21);
  const h2 = points.slice(21, 42);
  const scale1 = Math.hypot(h1[9].x - h1[0].x, h1[9].y - h1[0].y);
  const scale2 = Math.hypot(h2[9].x - h2[0].x, h2[9].y - h2[0].y);
  const avgScale = (scale1 + scale2) / 2;
  if (avgScale < 0.015) return [];
  const n1 = h1.flatMap(p => [(p.x - h1[0].x) / avgScale, (p.y - h1[0].y) / avgScale, (p.z - h1[0].z) / avgScale * 0.4]);
  const n2 = h2.flatMap(p => [(p.x - h2[0].x) / avgScale, (p.y - h2[0].y) / avgScale, (p.z - h2[0].z) / avgScale * 0.4]);
  const delta = [(h2[0].x - h1[0].x) / avgScale, (h2[0].y - h1[0].y) / avgScale, (h2[0].z - h1[0].z) / avgScale * 0.4];
  return [...n1, ...n2, ...delta];
}

export function landmarkDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || (a.length !== 63 && a.length !== 129) || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return Infinity;
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);
}

export function rankCandidates(landmarks: number[], gestures: Gesture[], threshold = 0.16) {
  return gestures.filter(g => g.enabled && g.source === 'custom' && g.samples.length >= 8)
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
