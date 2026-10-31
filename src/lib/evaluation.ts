export function evaluateTrial(expected: string, observations: string[]): 'correct' | 'false-trigger' | 'miss' {
  if (observations.some(id => id !== expected)) return 'false-trigger';
  if (expected === 'unknown' || observations.includes(expected)) return 'correct';
  return 'miss';
}
