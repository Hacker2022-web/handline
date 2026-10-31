import { useState } from 'react';
import { ArrowClockwise, Check, Cloud, Desktop, SpeakerHigh, WifiSlash, ArrowUpRight } from '@phosphor-icons/react';
import type { RuntimeStatus, Settings } from '../lib/types';

export function Setup({ settings, status, statusError, consent, voices, onSettings, onConsent, onRefresh, onSpeak }: {
  settings: Settings; status: RuntimeStatus | null; statusError: string; consent: boolean;
  voices: SpeechSynthesisVoice[]; onSettings: (s: Settings) => void; onConsent: (v: boolean) => void; onRefresh: () => Promise<void>; onSpeak: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  return <>
    <div className="page-title"><div><span className="eyebrow">ONE APP. TWO WAYS TO CONNECT.</span><h1>Runtime & setup</h1><p>Choose where custom gestures are checked. Your vocabulary stays here.</p></div><button className="button button-secondary" disabled={refreshing} onClick={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }}><ArrowClockwise size={18} />{refreshing ? 'Checking…' : 'Check connection'}</button></div>
    {statusError && <div role="alert" className="notice mb-6">{statusError}</div>}
    <div className="runtime-grid">
      <section className={`runtime-card ${settings.runtime === 'local' ? 'selected-runtime' : ''}`}>
        <div className="runtime-card-heading"><span className="runtime-icon"><Desktop size={28} /></span><span className="tag">OFFLINE</span></div>
        <h2>Stay on this device</h2><p>MediaPipe tracks your hand. Gemma verifies selected custom poses through your local Ollama installation.</p>
        <div className="runtime-state"><span className={`status-dot ${status?.local.ready ? '' : 'dot-muted'}`} /><strong>{!status ? 'Checking local model…' : status.local.ready ? 'Local model ready' : 'Local model unavailable'}</strong></div><p className="text-sm muted">{status?.local.message ?? 'Connecting to the local app bridge.'}</p>
        <dl className="runtime-details"><div><dt>Model</dt><dd>{status?.local.model ?? 'gemma4:12b'}</dd></div><div><dt>Device memory</dt><dd>{status ? `${status.local.memoryGB} GB` : '—'}</dd></div><div><dt>Images</dt><dd>Stay on this device</dd></div></dl>
        <button className={`button ${settings.runtime === 'local' ? 'button-primary' : 'button-secondary'} w-full`} onClick={() => onSettings({ ...settings, runtime: 'local' })}>{settings.runtime === 'local' ? <Check size={18} /> : <Desktop size={18} />}{settings.runtime === 'local' ? 'Using local runtime' : 'Use local runtime'}</button>
      </section>
      <section className={`runtime-card ${settings.runtime === 'cloud' ? 'selected-runtime' : ''}`}>
        <div className="runtime-card-heading"><span className="runtime-icon"><Cloud size={28} /></span><span className="tag">ONLINE</span></div>
        <h2>Connect to cloud Gemma</h2><p>Use the Gemini API to verify selected custom poses. This needs internet and a server API key.</p>
        <div className="runtime-state"><span className={`status-dot ${status?.cloud.configured ? '' : 'dot-muted'}`} /><strong>{!status ? 'Checking cloud setup…' : status.cloud.configured ? 'API key configured' : 'API key needed'}</strong></div><p className="text-sm muted">{status?.cloud.message ?? 'Checking server configuration.'}</p>
        <dl className="runtime-details"><div><dt>Model</dt><dd>{status?.cloud.model ?? 'gemma-4-26b-a4b-it'}</dd></div><div><dt>Connection</dt><dd>Internet required</dd></div><div><dt>Images</dt><dd>Selected crops sent to Google</dd></div></dl>
        <button className={`button ${settings.runtime === 'cloud' ? 'button-primary' : 'button-secondary'} w-full`} onClick={() => onSettings({ ...settings, runtime: 'cloud' })}>{settings.runtime === 'cloud' ? <Check size={18} /> : <Cloud size={18} />}{settings.runtime === 'cloud' ? 'Using cloud runtime' : 'Use cloud runtime'}</button>
      </section>
    </div>
    <section className="settings-section"><div><span className="eyebrow">SELECTED IMAGES ONLY</span><h2>Cloud image permission</h2><p>When cloud recognition is active, a selected live hand crop and up to two saved reference crops per candidate are sent to Google through this app’s server. No continuous video is sent. Your saved phrases are not included.</p><p className="field-help">Permission applies to this session and resets when you reload. Switching to Local keeps verification on this device.</p></div><label className="checkbox-label consent-label"><input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} /><span>I allow selected hand images to be sent to Google for cloud gesture verification.</span></label></section>
    <section className="settings-section"><div><span className="eyebrow">A PACE THAT SUITS YOU</span><h2>Voice & recognition</h2><p>Only device voices are used, so speech can work without an internet connection.</p></div><div className="settings-controls">
      <label className="switch-row"><span><strong>Speak messages automatically</strong><small>Text always appears, even when speech is off.</small></span><span className="toggle"><input type="checkbox" role="switch" checked={settings.autoSpeak} onChange={e => onSettings({ ...settings, autoSpeak: e.target.checked })} aria-label="Speak messages automatically" /><span /></span></label>
      <label className="field">Device voice<select value={settings.voiceURI} onChange={e => onSettings({ ...settings, voiceURI: e.target.value })}><option value="">Default local voice</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select>{!voices.length && <span className="field-help">No local voice reported yet. Check your system’s speech voices.</span>}</label>
      <label className="field">Speech speed <span className="range-caption">{settings.speechRate.toFixed(1)}×</span><input type="range" min={0.5} max={1.4} step={0.1} value={settings.speechRate} onChange={e => onSettings({ ...settings, speechRate: Number(e.target.value) })} /></label>
      <label className="field">Hold your gesture for <span className="range-caption">{(settings.holdMs / 1000).toFixed(1)} seconds</span><input type="range" min={600} max={2000} step={100} value={settings.holdMs} onChange={e => onSettings({ ...settings, holdMs: Number(e.target.value) })} /><span className="field-help">Then release for at least 0.6 seconds to repeat.</span></label>
      <button className="button button-secondary justify-self-start" onClick={onSpeak}><SpeakerHigh size={18} />Try voice</button>
    </div></section>
    <section className="setup-guide"><WifiSlash size={28} /><div><h2>Ready for the room. Even without Wi-Fi.</h2><p>Keep the local app running. Once the libraries, MediaPipe assets, and Gemma model are installed, Local mode needs no internet. Presets and manual phrases work even if Gemma is unavailable.</p><details><summary>Local and cloud setup commands</summary><p>In this project folder:</p><pre>npm install{'\n'}npm run setup:assets{'\n'}ollama serve{'\n'}ollama pull gemma4:12b{'\n'}npm run build{'\n'}npm start</pre><p>Ollama may already be running. For cloud access, copy .env.example to .env, set GEMINI_API_KEY, and restart the bridge.</p><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-button">Get a Gemini API key<ArrowUpRight size={16} /></a></details></div></section>
  </>;
}
