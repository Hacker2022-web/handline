import { useState } from 'react';
import { ArrowRight, DownloadSimple, Flask, Trash, CheckCircle, WarningCircle, MinusCircle } from '@phosphor-icons/react';
import type { Gesture, Trial } from '../lib/types';

export function Practice({ gestures, trials, onStart, onClear }: { gestures: Gesture[]; trials: Trial[]; onStart: (expected: string) => void; onClear: () => void }) {
  const [expected, setExpected] = useState('unknown');
  function exportTrials() {
    const blob = new Blob([JSON.stringify({ prototypeMeasurements: true, exportedAt: new Date().toISOString(), trials }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'handline-practice.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <div className="page-title"><div><span className="eyebrow">LEARN WHAT WORKS FOR YOU</span><h1>Practice log</h1><p>Measure correct matches and false triggers separately.</p></div><button className="button button-secondary" onClick={exportTrials} disabled={!trials.length}><DownloadSimple size={18} />Export results</button></div>
    <section className="practice-start"><div className="practice-start-copy"><span className="runtime-icon"><Flask size={30} /></span><div><h2>Try one gesture at a time</h2><p>Choose what you will show, start a trial, then finish after trying your pose. Manual phrase buttons do not count as recognitions.</p></div></div><div className="practice-start-form"><label className="field">Expected gesture<select value={expected} onChange={e => setExpected(e.target.value)}><option value="unknown">Unknown / no gesture</option>{gestures.filter(g => g.enabled).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button className="button button-primary" onClick={() => onStart(expected)}>Start trial<ArrowRight size={18} /></button></div></section>
    <div className="stats-row">{[
      { label: 'Trials recorded', value: trials.length, icon: Flask },
      { label: 'Correct recognitions', value: trials.filter(t => t.outcome === 'correct' && t.expected !== 'unknown').length, icon: CheckCircle },
      { label: 'False triggers', value: trials.filter(t => t.outcome === 'false-trigger').length, icon: WarningCircle },
      { label: 'Missed gestures', value: trials.filter(t => t.outcome === 'miss').length, icon: MinusCircle },
    ].map(({ label, value, icon: Icon }) => <div key={label}><span className="muted"><Icon size={18} />{label}</span><strong className="mono">{value}</strong></div>)}</div>
    <div className="section-label mb-4"><h2>Recorded trials</h2><button className="text-button" onClick={onClear} disabled={!trials.length}><Trash size={16} />Clear log</button></div>
    {!trials.length ? <div className="empty-state"><Flask size={44} weight="thin" /><h2>A little practice goes a long way</h2><p>Your first trial will appear here. Nothing is pre-filled or estimated.</p></div> : <div className="table-scroll"><table><thead><tr><th>Expected</th><th>Observed</th><th>Result</th><th>Runtime</th><th>Recorded</th></tr></thead><tbody>{trials.map(t => <tr key={t.id}><td>{t.expectedName}</td><td>{t.observedName}</td><td><span className={`result-tag result-${t.outcome}`}>{t.outcome === 'correct' && t.expected === 'unknown' ? 'Correct rejection' : t.outcome === 'correct' ? 'Correct match' : t.outcome === 'miss' ? 'Missed gesture' : 'False trigger'}</span></td><td>{t.runtime === 'local' ? 'Local' : 'Cloud'}</td><td className="muted">{new Date(t.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>)}</tbody></table></div>}
    <div className="footnote-box"><Flask size={22} /><p>These are prototype measurements for your demo, not clinical reliability claims. Unknown trials with no output count as correct rejections. Any unexpected output is a false trigger, even if a correct match also occurs.</p></div>
  </>;
}
