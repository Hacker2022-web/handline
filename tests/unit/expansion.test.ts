import { describe, expect, it } from 'vitest';
import { normalizeDualHandLandmarks, landmarkDistance, matchScore, rankCandidates } from '../../src/lib/matching';
import { PRESETS, type Gesture, type Landmark } from '../../src/lib/types';
const hand = (x:number):Landmark[]=>Array.from({length:21},(_,i)=>({x:x+i*.01,y:.7-i*.02,z:0}));
describe('Two-hand matching and score boundaries',()=>{
 it('retains inter-wrist separation and rejects single/dual cross matching',()=>{
  const v=normalizeDualHandLandmarks(hand(.1),hand(.6));expect(v).toHaveLength(126);
  expect(landmarkDistance(v,normalizeDualHandLandmarks(hand(.1),hand(.9)))).toBeGreaterThan(.1);
  expect(landmarkDistance(v,v.slice(0,63))).toBe(Infinity);
  const g:Gesture={...PRESETS[0],id:'dual',source:'custom',handMode:'dual',samples:Array.from({length:8},()=>({landmarks:v,referenceCrop:'',capturedAt:0}))};
  expect(rankCandidates(v,[g])[0].gesture.id).toBe('dual');expect(rankCandidates(v.slice(0,63),[g])).toEqual([]);
 });
 it('preserves global translation and scale without discarding relative position',()=>{
  const a=hand(.1),b=hand(.6),transform=(p:Landmark)=>({x:p.x*1.2+.1,y:p.y*1.2-.1,z:p.z*1.2});
  expect(landmarkDistance(normalizeDualHandLandmarks(a,b),normalizeDualHandLandmarks(a.map(transform),b.map(transform)))).toBeLessThan(1e-10);
 });
 it('calculates 0 to 100 similarity with 50 at nominal distance',()=>{expect(matchScore(0)).toBe(100);expect(matchScore(.16)).toBe(50);expect(matchScore(.32)).toBe(0);expect(matchScore(Infinity)).toBe(0);});
});
