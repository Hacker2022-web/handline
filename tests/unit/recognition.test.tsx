// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecognition } from '../../src/hooks/useRecognition';
import { normalizeLandmarks } from '../../src/lib/matching';
import { DEFAULT_SETTINGS, PRESETS, type Gesture, type Landmark } from '../../src/lib/types';
import type { Observation } from '../../src/hooks/useCamera';

const points: Landmark[] = Array.from({ length: 21 }, (_, i) => ({ x: .2 + (i % 5) * .04, y: .7 - i * .025, z: i * -.002 }));
const vector = normalizeLandmarks(points);
const sample = { landmarks: vector, referenceCrop: 'data:image/jpeg;base64,YQ==', capturedAt: 0 };
const gesture: Gesture = { id: 'custom-water', name: 'Water', phrase: 'Water, please.', enabled: true, source: 'custom', samples: Array.from({ length: 8 }, () => sample) };
let now = 0;
function frame(hands = 1): Observation { return { landmarks: hands ? points : [], category: null, score: 0, hands, at: now }; }
const options = () => ({ gestures: [gesture], settings: DEFAULT_SETTINGS, consent: false, active: true, capture: () => sample, onRecognized: vi.fn() });

beforeEach(() => { now = 0; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); vi.spyOn(performance, 'now').mockImplementation(() => now); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Recognition lifecycle', () => {
  it('verifies a stable custom pose once, displays only the saved gesture, and stays latched', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ gestureId: gesture.id })); vi.stubGlobal('fetch', fetcher);
    const config = options(); const { result } = renderHook(() => useRecognition(config));
    act(() => result.current.onFrame(frame())); now = 950; act(() => result.current.onFrame(frame()));
    await waitFor(() => expect(config.onRecognized).toHaveBeenCalledWith(gesture));
    now = 2000; act(() => result.current.onFrame(frame()));
    expect(config.onRecognized).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['pose-change', 'pause', 'runtime-change', 'consent-revoked'])('discards a late response after %s', async reason => {
    let resolve!: (r: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(r => { resolve = r; })); vi.stubGlobal('fetch', fetcher);
    const config = options(); config.consent = true;
    const { result, rerender } = renderHook(props => useRecognition(props), { initialProps: config });
    act(() => result.current.onFrame(frame())); now = 950; act(() => result.current.onFrame(frame()));
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (reason === 'pose-change') { now = 1000; act(() => result.current.onFrame(frame(0))); }
    if (reason === 'pause') rerender({ ...config, active: false });
    if (reason === 'runtime-change') rerender({ ...config, settings: { ...DEFAULT_SETTINGS, runtime: 'cloud' } });
    if (reason === 'consent-revoked') rerender({ ...config, consent: false });
    await act(async () => { resolve(Response.json({ gestureId: gesture.id })); await Promise.resolve(); });
    expect(config.onRecognized).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('makes no request for cloud gestures without consent or for ambiguous poses', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const config = options(); config.settings = { ...DEFAULT_SETTINGS, runtime: 'cloud' };
    const { result, rerender } = renderHook(props => useRecognition(props), { initialProps: config });
    act(() => result.current.onFrame(frame())); now = 950; act(() => result.current.onFrame(frame()));
    expect(result.current.state.label).toBe('Cloud permission needed'); expect(fetcher).not.toHaveBeenCalled();
    rerender({ ...config, consent: true, gestures: [gesture, { ...gesture, id: 'duplicate' }, ...PRESETS] });
    now = 2000; act(() => result.current.onFrame({ ...frame(), category: 'Thumb_Up', score: 0.99 }));
    now = 3000; act(() => result.current.onFrame({ ...frame(), category: 'Thumb_Up', score: 0.99 }));
    expect(result.current.state.label).toBe('Unknown gesture'); expect(fetcher).not.toHaveBeenCalled();
    expect(config.onRecognized).not.toHaveBeenCalled();
  });
  it('never speaks an invented candidate or a failed provider response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ gestureId: 'invented' })); vi.stubGlobal('fetch', fetcher);
    const config = options(); const { result } = renderHook(() => useRecognition(config));
    act(() => result.current.onFrame(frame())); now = 950; act(() => result.current.onFrame(frame()));
    await waitFor(() => expect(result.current.state.label).toBe('Unknown gesture'));
    expect(config.onRecognized).not.toHaveBeenCalled();
  });
});

describe('Configurable preset threshold',()=>{
 it('shows low scores, rejects 49%, and triggers at the requested 50% boundary',()=>{
  const config={...options(),gestures:PRESETS,settings:{...DEFAULT_SETTINGS,minConfidence:50}};
  const {result}=renderHook(()=>useRecognition(config));
  act(()=>result.current.onFrame({...frame(),category:'Thumb_Up',score:.49}));now=1000;act(()=>result.current.onFrame({...frame(),category:'Thumb_Up',score:.49}));expect(config.onRecognized).not.toHaveBeenCalled();expect(result.current.score).toBe(49);
  now=1100;act(()=>result.current.onFrame({...frame(),category:'Thumb_Up',score:.5}));now=2100;act(()=>result.current.onFrame({...frame(),category:'Thumb_Up',score:.5}));expect(config.onRecognized).toHaveBeenCalledWith(PRESETS[0]);
 });
});
