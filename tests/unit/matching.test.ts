import { describe, expect, it } from 'vitest';
import { findOverlaps, isAmbiguous, landmarkDistance, normalizeLandmarks, rankCandidates } from '../../src/lib/matching';
import { StabilityGate } from '../../src/lib/stability';
import { evaluateTrial } from '../../src/lib/evaluation';
import { PRESETS, type Gesture, type Landmark } from '../../src/lib/types';

const points: Landmark[] = Array.from({ length: 21 }, (_, i) => ({ x: .2 + (i % 5) * .04, y: .7 - i * .025, z: i * -.002 }));
function gesture(id: string, vector: number[]): Gesture {
  return { id, name: id, phrase: 'Exact phrase.', enabled: true, source: 'custom', samples: Array.from({ length: 8 }, () => ({ landmarks: vector, referenceCrop: 'data:image/jpeg;base64,YQ==', capturedAt: 0 })) };
}
describe('Landmark matching', () => {
  it('is invariant to translation and uniform scale but preserves orientation', () => {
    const original = normalizeLandmarks(points);
    const moved = normalizeLandmarks(points.map(p => ({ x: p.x * 1.2 + .1, y: p.y * 1.2 - .2, z: p.z * 1.2 })));
    expect(landmarkDistance(original, moved)).toBeLessThan(1e-10);
    expect(landmarkDistance(original, normalizeLandmarks(points.map(p => ({ ...p, y: 1 - p.y }))))).toBeGreaterThan(.5);
  });
  it('rejects missing, collapsed, and non-finite points', () => {
    expect(normalizeLandmarks([])).toEqual([]);
    expect(normalizeLandmarks(points.map(() => ({ x: 0, y: 0, z: 0 })))).toEqual([]);
    expect(normalizeLandmarks(points.map(p => ({ ...p, x: NaN })))).toEqual([]);
    expect(landmarkDistance([], [])).toBe(Infinity);
  });
  it('excludes disabled, under-enrolled, unrelated, and preset gestures', () => {
    const vector = normalizeLandmarks(points);
    const valid = gesture('valid', vector);
    expect(rankCandidates(vector, [valid, { ...valid, id: 'off', enabled: false }, { ...valid, id: 'few', samples: valid.samples.slice(0, 7) }, gesture('other', vector.map(n => n + .5)), ...PRESETS]).map(c => c.gesture.id)).toEqual(['valid']);
    expect(rankCandidates([], [valid])).toEqual([]);
  });
  it('requires three close references instead of trusting one outlier', () => {
    const vector = normalizeLandmarks(points);
    const g = gesture('outlier', vector.map(n => n + 1)); g.samples[0].landmarks = vector;
    expect(rankCandidates(vector, [g])).toEqual([]);
  });
  it('rejects ambiguous top matches and warns on overlapping enrollment', () => {
    const vector = normalizeLandmarks(points);
    const one = gesture('one', vector), two = gesture('two', vector.map(n => n + .01));
    expect(isAmbiguous(rankCandidates(vector, [one, two]))).toBe(true);
    expect(findOverlaps(one.samples, [one, two], 'one')).toEqual(['two']);
  });
});

describe('Hold and release gate', () => {
  it('triggers once after a stable hold, and requires release even between different known poses', () => {
    const gate = new StabilityGate(900, 600);
    expect(gate.update('yes', 100).trigger).toBeNull();
    expect(gate.update('yes', 999).trigger).toBeNull();
    expect(gate.update('yes', 1000).trigger).toBe('yes');
    expect(gate.update('yes', 4000).trigger).toBeNull();
    expect(gate.update('no', 5000).trigger).toBeNull();
    gate.update(null, 5100); gate.update(null, 5699);
    expect(gate.update('yes', 5700).trigger).toBeNull();
    gate.update(null, 5800); gate.update(null, 6400);
    gate.update('yes', 6500);
    expect(gate.update('yes', 7400).trigger).toBe('yes');
  });
  it('resets the timer when candidates change or become unknown', () => {
    const gate = new StabilityGate(900);
    gate.update('yes', 0); gate.update('no', 700);
    expect(gate.update('no', 1000).trigger).toBeNull();
    gate.update(null, 1100); gate.update('no', 1200);
    expect(gate.update('no', 2000).trigger).toBeNull();
    gate.reset(); expect(gate.update('yes', 8000).trigger).toBeNull();
  });
});

describe('Prototype trial accounting', () => {
  it('counts any unexpected output as a false trigger, including mixed correct/incorrect outputs', () => {
    expect(evaluateTrial('yes', ['yes', 'no'])).toBe('false-trigger');
    expect(evaluateTrial('unknown', ['yes'])).toBe('false-trigger');
    expect(evaluateTrial('yes', [])).toBe('miss');
    expect(evaluateTrial('yes', ['yes'])).toBe('correct');
    expect(evaluateTrial('unknown', [])).toBe('correct');
  });
});
