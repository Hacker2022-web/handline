import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createElevenLabsRouter } from '../../server/elevenlabs';

let server: Server;
afterEach(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
async function start(client: unknown, configured = true) {
  const app = express(); app.use(express.json()); app.use('/api/elevenlabs', createElevenLabsRouter(client as ElevenLabsClient, configured));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  return `http://127.0.0.1:${address.port}/api/elevenlabs`;
}
const post = (url: string, data: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
describe('ElevenLabs bridge', () => {
  it('constructs without a key and without initializing the SDK', () => {
    expect(() => createElevenLabsRouter(undefined, false)).not.toThrow();
  });
  it('reports missing setup and rejects cloud work without invoking any provider', async () => {
    const convert = vi.fn(); const url = await start({ textToSpeech: { convert } }, false);
    expect(await (await fetch(`${url}/status`)).json()).toEqual(expect.objectContaining({ configured: false }));
    expect((await post(`${url}/tts`, { consent: true, voiceId: 'voice', text: 'Yes' })).status).toBe(503);
    expect(convert).not.toHaveBeenCalled();
  });
  it('requires explicit phrase consent, forwards exact text and returns audio', async () => {
    const convert = vi.fn().mockImplementation(async () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([73,68,51])); controller.close(); } }));
    const url = await start({ textToSpeech: { convert } });
    expect((await post(`${url}/tts`, { voiceId: 'voice', text: 'Yes' })).status).toBe(400);
    expect(convert).not.toHaveBeenCalled();
    const response = await post(`${url}/tts`, { voiceId: 'voice', text: 'Water, please.', modelId: 'eleven_multilingual_v2', languageCode: 'hi', consent: true });
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('audio/mpeg');
    expect(convert).toHaveBeenCalledWith('voice', expect.objectContaining({ text: 'Water, please.', modelId: 'eleven_multilingual_v2' }));
    expect(convert.mock.calls[0][1].languageCode).toBeUndefined();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([73,68,51]));
  });
  it('does not reveal upstream exception or key details to the browser', async () => {
    const url = await start({ voices: { getAll: vi.fn().mockRejectedValue({ statusCode: 401, body: 'secret-upstream-details' }) } });
    const response = await fetch(`${url}/voices`); expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain('secret-upstream-details');
  });
  it('requires voice ownership permission and preserves verification requirements', async () => {
    const create = vi.fn().mockResolvedValue({ voiceId: 'new-voice', requiresVerification: true });
    const url = await start({ voices: { ivc: { create } } });
    const denied = new FormData(); denied.set('name', 'My voice'); denied.append('samples', new Blob(['test'], { type: 'audio/wav' }), 'sample.wav');
    expect((await fetch(`${url}/clone`, { method: 'POST', body: denied })).status).toBe(400); expect(create).not.toHaveBeenCalled();
    const body = new FormData(); body.set('name', 'My voice'); body.set('consent', 'true'); body.set('isolate', 'true'); body.append('samples', new Blob(['test'], { type: 'audio/wav' }), 'sample.wav');
    const response = await fetch(`${url}/clone`, { method: 'POST', body });
    expect(await response.json()).toEqual(expect.objectContaining({ voiceId: 'new-voice', requiresVerification: true }));
    expect(create.mock.calls[0][0].removeBackgroundNoise).toBe(true);
  });
  it('requires partner permission before transcription', async () => {
    const convert = vi.fn().mockResolvedValue({ text: 'Would you like water?', languageCode: 'en' });
    const url = await start({ speechToText: { convert } });
    const denied = new FormData(); denied.append('audio', new Blob(['test'], { type: 'audio/webm' }), 'partner.webm');
    expect((await fetch(`${url}/transcribe`, { method: 'POST', body: denied })).status).toBe(400); expect(convert).not.toHaveBeenCalled();
    const body = new FormData(); body.set('consent', 'true'); body.append('audio', new Blob(['test'], { type: 'audio/webm' }), 'partner.webm');
    const response = await fetch(`${url}/transcribe`, { method: 'POST', body });
    expect(await response.json()).toEqual({ text: 'Would you like water?', languageCode: 'en' });
  });
});
