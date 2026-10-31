import { Camera, Hand, Pause, Play, Power, ArrowUpRight } from '@phosphor-icons/react';
import type { useCamera } from '../hooks/useCamera';
import type { useRecognition } from '../hooks/useRecognition';

export function CameraPanel({ camera, recognition, paused, onPause, onSetup }: {
  camera: ReturnType<typeof useCamera>; recognition: ReturnType<typeof useRecognition>;
  paused: boolean; onPause: () => void; onSetup: () => void;
}) {
  const live = camera.status === 'ready';
  const label = live ? paused ? 'Recognition paused' : recognition.state.label : camera.status === 'loading' ? 'Preparing your camera' : 'Camera is off';
  return <section className="camera-panel" aria-label="Camera and gesture recognition">
    <div className="camera-panel-top"><span><span className={`status-dot ${live && !paused ? '' : 'dot-muted'}`} />{live ? 'LIVE CAMERA' : 'CAMERA PREVIEW'}</span><span className="camera-local-label">PROCESSED ON DEVICE</span></div>
    <div className="camera-view">
      <video ref={camera.videoRef} muted playsInline className="camera-video mirror" aria-label="Live webcam preview" />
      <canvas ref={camera.canvasRef} className="camera-landmarks mirror" aria-hidden="true" />
      {!live && <div className="camera-empty">
        <div className="hand-illustration" aria-hidden="true"><div className="hand-orbit orbit-one" /><div className="hand-orbit orbit-two" /><Hand size={92} weight="thin" /><span className="frame-corner top-left" /><span className="frame-corner top-right" /><span className="frame-corner bottom-left" /><span className="frame-corner bottom-right" /></div>
        <h2>{camera.status === 'loading' ? 'Getting ready to listen' : 'A little gesture. Your words.'}</h2>
        <p>{camera.status === 'loading' ? 'Loading local hand tracking. This may take a moment.' : 'Turn on your camera and bring one or two hands into view.'}</p>
        <button className="button button-light" disabled={camera.status === 'loading'} onClick={() => void camera.start()}><Camera size={20} />{camera.status === 'loading' ? 'Starting camera…' : camera.status === 'error' ? 'Try camera again' : 'Start camera'}<ArrowUpRight size={17} /></button>
        <span className="camera-footnote">Camera access starts only when you choose.</span>
      </div>}
      {live && paused && <div className="paused-overlay"><Pause size={38} /><strong>Take your time</strong><span>Recognition is paused.</span><button className="button button-light" onClick={onPause}><Play size={18} />Resume recognition</button></div>}
    </div>
    {camera.error && <div role="alert" className="camera-error">{camera.error}</div>}
    <div className="recognition-bar"><div className="recognition-copy"><div className="recognition-symbol"><Hand size={22} /></div><div><strong aria-live="polite">{label}</strong><p>{live ? paused ? 'Your camera stays on. No gestures will trigger.' : recognition.state.detail : 'Your camera feed stays on this device.'}</p></div></div>
      {live ? <div className="flex gap-2"><button className="icon-button dark" aria-label={paused ? 'Resume recognition' : 'Pause recognition'} onClick={onPause}>{paused ? <Play size={20} /> : <Pause size={20} />}</button><button className="icon-button dark" aria-label="Turn off camera" onClick={camera.stop}><Power size={20} /></button></div> : <button className="icon-button dark" aria-label="View camera and model setup" onClick={onSetup}><ArrowUpRight size={21} /></button>}
    </div>
    <div className="hold-track" role="progressbar" aria-label="Gesture stability" aria-valuemin={0} aria-valuemax={100} aria-valuenow={live && !paused ? Math.round(recognition.state.progress * 100) : 0}><div style={{ transform: `scaleX(${live && !paused ? recognition.state.progress : 0})` }} /></div>
  </section>;
}
