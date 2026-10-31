import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ArrowUUpLeft, BookOpen, Camera, Check, Cloud, Desktop, Flask, Hand, Plus, SlidersHorizontal, SpeakerHigh, SpeakerSlash, Waveform, X, Info } from '@phosphor-icons/react';
import { CameraPanel } from './components/CameraPanel';
import { Enrollment } from './components/Enrollment';
import { GestureIcon } from './components/GestureIcon';
import { Library } from './components/Library';
import { Practice } from './components/Practice';
import { Setup } from './components/Setup';
import { Dialog } from './components/Dialog';
import { useCamera, type Observation } from './hooks/useCamera';
import { useRecognition } from './hooks/useRecognition';
import { useSpeech } from './hooks/useSpeech';
import { evaluateTrial } from './lib/evaluation';
import * as store from './lib/storage';
import { DEFAULT_SETTINGS, type Gesture, type Message, type RuntimeStatus, type Settings, type Trial } from './lib/types';

type Page = 'communicate' | 'library' | 'practice' | 'setup';
type ActiveTrial = { expected: string; expectedName: string; runtime: Settings['runtime']; observations: { id: string; name: string }[] };
const NAV = [
  { id: 'communicate' as const, label: 'Communicate', icon: Waveform },
  { id: 'library' as const, label: 'Gesture library', icon: BookOpen },
  { id: 'practice' as const, label: 'Practice log', icon: Flask },
  { id: 'setup' as const, label: 'Runtime & setup', icon: SlidersHorizontal },
];

export default function App() {
  const [page, setPage] = useState<Page>('communicate');
  const [gestures, setGestures] = useState<Gesture[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [consent, setConsent] = useState(false);
  const [paused, setPaused] = useState(false);
  const [enrollment, setEnrollment] = useState<{ gesture?: Gesture } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gesture | null>(null);
  const [clearLog, setClearLog] = useState(false);
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const [trialCount, setTrialCount] = useState<number | null>(null);
  const trialRef = useRef<ActiveTrial | null>(null);
  const frameHandler = useRef<(frame: Observation) => void>(() => {});
  const camera = useCamera(frame => frameHandler.current(frame));
  const speech = useSpeech(settings);
  const currentMessage = messages[0];

  useEffect(() => {
    let alive = true;
    void Promise.all([store.loadGestures(), store.loadSettings(), store.loadTrials()]).then(([g, s, t]) => {
      if (alive) { setGestures(g); setSettings(s); setTrials(t); setLoaded(true); }
    }).catch(() => { if (alive) setStorageError('Local storage could not open. Enable browser storage and reload to save your vocabulary.'); });
    return () => { alive = false; };
  }, []);
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status', { signal: AbortSignal.timeout(9000) });
      if (!response.ok) throw new Error();
      setRuntimeStatus(await response.json()); setStatusError('');
    } catch { setRuntimeStatus(null); setStatusError('The local app bridge is not responding. Run npm run dev, or npm start after building. Presets and manual phrases still work.'); }
  }, []);
  useEffect(() => { void refreshStatus(); const interval = setInterval(() => { if (!document.hidden) void refreshStatus(); }, 15_000); return () => clearInterval(interval); }, [refreshStatus]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timeout); }, [toast]);

  const say = useCallback((gesture: Gesture, source: Message['source']) => {
    setMessages(previous => [{ id: crypto.randomUUID(), gestureId: gesture.id, phrase: gesture.phrase, at: Date.now(), source, runtime: settings.runtime }, ...previous].slice(0, 30));
    if (settings.autoSpeak) speech.speak(gesture.phrase);
    if (source === 'gesture' && trialRef.current) {
      trialRef.current.observations.push({ id: gesture.id, name: gesture.name });
      setTrialCount(trialRef.current.observations.length);
    }
  }, [settings.runtime, settings.autoSpeak, speech.speak]);
  const recognition = useRecognition({
    gestures, settings, consent,
    active: loaded && camera.status === 'ready' && page === 'communicate' && !paused && !enrollment && !help && !deleteTarget,
    capture: camera.capture, onRecognized: gesture => say(gesture, 'gesture'),
  });
  frameHandler.current = recognition.onFrame;
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) { setPaused(true); recognition.reset(); speech.cancel(); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [recognition.reset, speech.cancel]);

  function navigate(next: Page) {
    if (trialRef.current && next !== 'communicate') { setToast('Finish your current trial before leaving the communication screen.'); return; }
    recognition.reset(); if (page !== next && camera.status === 'ready') setPaused(true); setPage(next);
  }
  function updateSettings(next: Settings) {
    if (trialRef.current && next.runtime !== settings.runtime) { setToast('Finish your trial before switching runtimes.'); return; }
    if (next.runtime !== settings.runtime) recognition.reset();
    setSettings(next);
    if (!next.autoSpeak) speech.cancel();
    void store.saveSettings(next).catch(() => setStorageError('Your settings could not be saved. Check browser storage.'));
  }
  async function upsertGesture(gesture: Gesture) {
    const previous = gestures.find(g => g.id === gesture.id);
    setToast(`Saving ${gesture.name}…`);
    setGestures(previous => previous.some(g => g.id === gesture.id) ? previous.map(g => g.id === gesture.id ? gesture : g) : [...previous, gesture]);
    try {
      await store.saveGesture(gesture);
      setToast(`${gesture.name} saved on this device.`);
    } catch (error) {
      setGestures(current => previous ? current.map(g => g === gesture ? previous : g) : current.filter(g => g !== gesture));
      throw error;
    }
  }
  function editGesture(gesture?: Gesture) { setPaused(true); recognition.reset(); setEnrollment(gesture ? { gesture } : {}); }
  async function removeGesture() {
    if (!deleteTarget) return;
    try { await store.deleteGesture(deleteTarget.id); setGestures(g => g.filter(item => item.id !== deleteTarget.id)); setDeleteTarget(null); setToast('Gesture deleted.'); }
    catch { setStorageError('Could not delete this gesture. Please try again.'); }
  }
  function startTrial(expected: string) {
    recognition.reset();
    trialRef.current = { expected, expectedName: gestures.find(g => g.id === expected)?.name ?? 'Unknown / no gesture', runtime: settings.runtime, observations: [] };
    setTrialCount(0); setPaused(false); setPage('communicate');
  }
  async function finishTrial() {
    const active = trialRef.current; if (!active) return;
    const trial: Trial = { id: crypto.randomUUID(), at: Date.now(), expected: active.expected, expectedName: active.expectedName,
      observed: active.observations.map(o => o.id).join(', ') || 'unknown', observedName: active.observations.map(o => o.name).join(', ') || 'No output', runtime: active.runtime,
      outcome: evaluateTrial(active.expected, active.observations.map(o => o.id)) };
    try { await store.saveTrial(trial); setTrials(t => [trial, ...t]); trialRef.current = null; setTrialCount(null); setPaused(true); setPage('practice'); }
    catch { setStorageError('Could not save the trial. Try finishing again.'); }
  }

  const local = settings.runtime === 'local';
  const modelReady = local ? runtimeStatus?.local.ready : runtimeStatus?.cloud.configured && consent;
  const enabled = gestures.filter(g => g.enabled);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('communicate')} aria-label="Handline home"><img src="/handline.svg" alt="" /><span>handline<span className="brand-period">.</span></span></button>
      <div className="sidebar-caption">YOUR PERSONAL COMMUNICATOR</div>
      <nav aria-label="Main navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} className={page === id ? 'nav-active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} weight={page === id ? 'fill' : 'regular'} /><span>{label}</span>{id === 'library' && <span className="nav-count">{gestures.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Hand size={25} weight="thin" /><p>Made for your gestures.<br /><strong>And your way of saying things.</strong></p></div><button aria-label="Runtime status and setup" className="sidebar-runtime" onClick={() => navigate('setup')}><span className="sidebar-runtime-icon">{local ? <Desktop size={20} /> : <Cloud size={20} />}</span><span><strong>{local ? 'Local runtime' : 'Cloud runtime'}</strong><small><span className={`status-dot ${modelReady ? '' : 'dot-muted'}`} />{modelReady ? 'Ready for custom gestures' : 'View model setup'}</small></span><ArrowUpRight size={16} /></button><span className="prototype-label">AIDN · HACK DAY PROTOTYPE</span></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb">Your space<span>/</span><strong>{NAV.find(n => n.id === page)?.label}</strong></div><div className="topbar-actions">{camera.status === 'ready' && <button className="camera-on-button" onClick={camera.stop} title="Turn off camera"><span className="status-dot" />Camera on<Camera size={16} /></button>}<div className="mode-switch" aria-label="Recognition runtime"><button aria-pressed={local} onClick={() => updateSettings({ ...settings, runtime: 'local' })} disabled={trialCount !== null}><Desktop size={16} />Offline</button><button aria-pressed={!local} onClick={() => updateSettings({ ...settings, runtime: 'cloud' })} disabled={trialCount !== null}><Cloud size={17} />Online</button></div><button className="help-button" aria-label="How Handline works" onClick={() => setHelp(true)}><Info size={21} /></button></div></header>
      <main id="main-content" tabIndex={-1}>
        {storageError && <div className="notice mb-5" role="alert">{storageError}</div>}
        {!loaded && !storageError && <div className="loading-state" role="status"><div /><div /><span>Opening your vocabulary…</span></div>}
        <div hidden={page !== 'communicate'}>
          <div className="page-title"><div><span className="eyebrow">YOUR GESTURES. YOUR WORDS.</span><h1>A space to be understood.</h1><p>Say what you mean, in a way that feels like you.</p></div><button className="button button-secondary" onClick={() => editGesture()} disabled={!loaded || trialCount !== null}><Plus size={18} />Add a gesture</button></div>
          {trialCount !== null && trialRef.current && <div className="trial-banner" role="status"><Flask size={22} /><div><strong>Trial in progress · {trialRef.current.expectedName}</strong><p>{trialCount} automatic output{trialCount === 1 ? '' : 's'} recorded. Show your pose, then finish.</p></div><button className="button button-primary" onClick={() => void finishTrial()}>Finish trial<Check size={18} /></button><button className="icon-button" aria-label="Discard trial" onClick={() => { trialRef.current = null; setTrialCount(null); setPaused(true); }}><X size={20} /></button></div>}
          <div className="workspace-grid">
            <CameraPanel camera={camera} recognition={recognition} paused={paused} onPause={() => { recognition.reset(); setPaused(p => !p); speech.cancel(); }} onSetup={() => navigate('setup')} />
            <section className={`message-panel ${currentMessage ? 'has-message' : ''}`} aria-labelledby="message-title">
              <div className="message-panel-top"><span className="eyebrow" id="message-title">YOUR MESSAGE</span><label className="auto-speak-label" title="Speak messages automatically"><input type="checkbox" checked={settings.autoSpeak} onChange={e => updateSettings({ ...settings, autoSpeak: e.target.checked })} aria-label="Auto speak" />{settings.autoSpeak ? <SpeakerHigh size={17} /> : <SpeakerSlash size={17} />}<span>Auto speak {settings.autoSpeak ? 'on' : 'off'}</span></label></div>
              <div className="message-stage"><span className="quote-mark" aria-hidden="true">“</span><div aria-live="polite" aria-atomic="true" className="message-text">{currentMessage ? currentMessage.phrase : <>Your next thought,<br /><span>in your words.</span></>}</div><p className="message-caption">{currentMessage ? `${currentMessage.source === 'gesture' ? 'Recognized gesture' : 'Selected manually'} · ${gestures.find(g => g.id === currentMessage.gestureId)?.name ?? 'Saved gesture'}` : 'Make a gesture, or choose a phrase below.'}</p></div>
              <div className="message-actions"><button className="button button-primary" disabled={!currentMessage} onClick={() => currentMessage && speech.speak(currentMessage.phrase)}><SpeakerHigh size={20} />{speech.speaking ? 'Speak again' : 'Speak message'}</button><button className="icon-button" disabled={!currentMessage} aria-label="Undo last message" onClick={() => { speech.cancel(); setMessages(m => m.slice(1)); }}><ArrowUUpLeft size={21} /></button></div>
              {speech.error && <p role="alert" className="error-text text-sm mt-3">{speech.error}</p>}
              <div className="message-panel-foot"><span className="status-dot" />Your exact saved phrase. Every time.</div>
            </section>
          </div>
          {settings.runtime === 'cloud' && !consent && <div className="inline-runtime-note"><Cloud size={19} /><p>Cloud custom gestures need image permission. Presets and phrase buttons are ready.</p><button className="text-button" onClick={() => navigate('setup')}>Review setup<ArrowRight size={16} /></button></div>}
          <section className="quick-phrases" aria-labelledby="quick-phrases-title"><div className="section-label"><div><h2 id="quick-phrases-title">A few words, always within reach.</h2><p>Tap a phrase at any time. Your camera can stay off.</p></div><button className="text-button" onClick={() => navigate('library')}>Your library<span className="count-pill">{gestures.length}</span><ArrowRight size={17} /></button></div><div className="phrase-grid">{enabled.map(gesture => <button key={gesture.id} className={`phrase-button ${currentMessage?.gestureId === gesture.id ? 'phrase-selected' : ''}`} onClick={() => say(gesture, 'manual')}><span className="gesture-icon"><GestureIcon gesture={gesture} /></span><span><strong>{gesture.phrase}</strong><small>{gesture.name}</small></span><ArrowUpRight size={18} /></button>)}{!enabled.length && loaded && <p className="muted">All gestures are disabled. Enable or add one in your library.</p>}</div></section>
          <div className="workspace-bottom"><div className="how-it-works"><span className="step-number">01</span><span>Show one hand</span><span className="step-line" /><span className="step-number">02</span><span>Hold your gesture</span><span className="step-line" /><span className="step-number">03</span><span>Let your words speak</span></div><button className="text-button" onClick={() => setHelp(true)}>How it works<ArrowUpRight size={16} /></button></div>
          {messages.length > 1 && <section className="recent-messages"><div className="section-label"><h2>Earlier in this conversation</h2><button className="text-button" onClick={() => { speech.cancel(); setMessages([]); }}>Clear conversation</button></div>{messages.slice(1, 5).map(message => <button key={message.id} className="recent-message" onClick={() => speech.speak(message.phrase)}><span>{message.phrase}</span><time>{new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><SpeakerHigh size={18} /></button>)}</section>}
        </div>
        {page === 'library' && <Library gestures={gestures} onAdd={() => editGesture()} onEdit={editGesture} onDelete={setDeleteTarget} onToggle={g => { void upsertGesture({ ...g, enabled: !g.enabled }).catch(() => setStorageError('Could not save the gesture. Please try again.')); }} onSay={g => { say(g, 'manual'); setPage('communicate'); }} />}
        {page === 'practice' && <Practice gestures={gestures} trials={trials} onStart={startTrial} onClear={() => setClearLog(true)} />}
        {page === 'setup' && <Setup settings={settings} status={runtimeStatus} statusError={statusError} consent={consent} voices={speech.voices} onSettings={updateSettings} onConsent={v => { recognition.reset(); setConsent(v); }} onRefresh={refreshStatus} onSpeak={() => speech.speak('Your gestures. Your words.')} />}
      </main>
      <footer className="app-footer"><span>Made for a more personal kind of communication.</span><span><span className="status-dot" />{loaded ? 'Vocabulary saved on this device' : storageError ? 'Local storage unavailable' : 'Opening local vocabulary…'}</span></footer>
    </div>
    {enrollment && <Enrollment gesture={enrollment.gesture} gestures={gestures} camera={camera} onSave={upsertGesture} onClose={() => setEnrollment(null)} />}
    {deleteTarget && <Dialog title={`Delete ${deleteTarget.name}?`} onClose={() => setDeleteTarget(null)}><p className="dialog-intro">This removes the gesture, its phrase, and its recorded hand examples from this device.</p><div className="dialog-footer"><button className="button button-secondary" onClick={() => setDeleteTarget(null)}>Keep gesture</button><button className="button button-danger" onClick={() => void removeGesture()}>Delete gesture</button></div></Dialog>}
    {clearLog && <Dialog title="Clear your practice log?" onClose={() => setClearLog(false)}><p className="dialog-intro">Export your results first if you want to keep them. Your gestures will remain available.</p><div className="dialog-footer"><button className="button button-secondary" onClick={() => setClearLog(false)}>Keep results</button><button className="button button-danger" onClick={async () => { try { await store.clearTrials(); setTrials([]); setClearLog(false); } catch { setStorageError('Could not clear the log. Please try again.'); } }}>Clear log</button></div></Dialog>}
    {help && <Dialog title="A gesture, then your words" onClose={() => setHelp(false)}><div className="help-steps"><div><span className="step-number">01</span><p><strong>Start with one hand.</strong> Turn on the camera in good light. Static, one-hand poses work best.</p></div><div><span className="step-number">02</span><p><strong>Hold for {(settings.holdMs / 1000).toFixed(1)} seconds.</strong> Your saved phrase appears after a confident match. Custom poses also need a Gemma visual check.</p></div><div><span className="step-number">03</span><p><strong>Release before repeating.</strong> Lower your hand for at least 0.6 seconds. A held gesture speaks once.</p></div></div><p className="dialog-intro">You can always tap a phrase, pause recognition, undo a message, or speak it again. An unknown gesture stays silent.</p><div className="dialog-footer"><button className="button button-primary" onClick={() => setHelp(false)}>Got it<Check size={18} /></button></div></Dialog>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17} /></button></div>}
  </div>;
}
