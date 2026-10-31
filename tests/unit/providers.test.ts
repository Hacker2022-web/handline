import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { Server } from 'node:http';
import { createApp } from '../../server/app';
import { parseModelChoice, verificationSchema, verifyGesture, type ProviderConfig } from '../../server/verification';
import type { VerificationRequest } from '../../src/lib/types';

const config: ProviderConfig = { ollamaURL: 'http://127.0.0.1:11434', localModel: 'gemma4:12b', cloudModel: 'gemma-4-26b-a4b-it', apiKey: 'test-key' };
const jpeg = `data:image/jpeg;base64,${(await sharp({ create: { width: 16, height: 16, channels: 3, background: '#f0e8d0' } }).jpeg().toBuffer()).toString('base64')}`;
const request: VerificationRequest = { runtime: 'local', cloudConsent: false, image: jpeg, candidates: [{ id: 'custom-water', name: 'Water', references: [jpeg] }] };

describe('Model output handling', () => {
  it.each(['', 'custom-water', '{"gestureId":"invented"}', '{"gestureId":"custom-water","phrase":"invented phrase"}', 'null', '[]', '{"gestureId":1}', 'Here is the result: {"gestureId":"custom-water"}'])('rejects malformed or unapproved outputs: %s', value => {
    expect(parseModelChoice(value, ['custom-water'])).toBe('unknown');
  });
  it('accepts only a candidate ID in a single-key JSON object', () => {
    expect(parseModelChoice('{"gestureId":"custom-water"}', ['custom-water'])).toBe('custom-water');
    expect(parseModelChoice('```json\n{"gestureId":"custom-water"}\n```', ['custom-water'])).toBe('custom-water');
    expect(parseModelChoice('{"gestureId":"unknown"}', ['custom-water'])).toBe('unknown');
  });
  it('validates crop counts and duplicate candidates', () => {
    expect(verificationSchema.safeParse(request).success).toBe(true);
    expect(verificationSchema.safeParse({ ...request, candidates: [request.candidates[0], request.candidates[0]] }).success).toBe(false);
    expect(verificationSchema.safeParse({ ...request, candidates: [] }).success).toBe(false);
    expect(verificationSchema.safeParse({ ...request, image: 'video/mp4' }).success).toBe(false);
  });
});

describe('Runtime adapters', () => {
  it('local mode calls only the local Ollama endpoint with bounded context and image data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: { content: '{"gestureId":"custom-water"}' } }));
    expect(await verifyGesture(request, config, fetcher)).toBe('custom-water');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(init!.body as string);
    expect(body.messages[0].images).toHaveLength(1);
    const sheet = await sharp(Buffer.from(body.messages[0].images[0], 'base64')).metadata();
    expect(sheet.width).toBe(640); expect(sheet.height).toBe(358); expect(sheet.format).toBe('jpeg');
    expect(body.options.num_ctx).toBe(4096);
    expect(body.stream).toBe(false);
  });
  it('does not send cloud requests before consent or without a configured key', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(verifyGesture({ ...request, runtime: 'cloud' }, config, fetcher)).rejects.toThrow('Allow selected');
    await expect(verifyGesture({ ...request, runtime: 'cloud', cloudConsent: true }, { ...config, apiKey: '' }, fetcher)).rejects.toThrow('GEMINI_API_KEY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('supports MLX vision runners that explicitly decline schema-constrained output', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'structured output is unavailable' }, { status: 501 }))
      .mockResolvedValueOnce(Response.json({ message: { content: '{"gestureId":"custom-water"}' } }));
    expect(await verifyGesture(request, config, fetcher)).toBe('custom-water');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).format).toBeDefined();
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).format).toBeUndefined();
    expect(fetcher.mock.calls.every(([url]) => url === 'http://127.0.0.1:11434/api/chat')).toBe(true);
  });
  it('cloud mode sends inline images to the configured model without saved phrases', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ thought: true, text: 'Do not parse this thought.' }, { text: '{"gestureId":"custom-water"}' }] } }] }));
    expect(await verifyGesture({ ...request, runtime: 'cloud', cloudConsent: true }, config, fetcher)).toBe('custom-water');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain('gemma-4-26b-a4b-it:generateContent');
    expect(init!.body).not.toContain('phrase":');
    expect(init!.headers).toEqual(expect.objectContaining({ 'x-goog-api-key': 'test-key' }));
  });
  it('returns unknown on an invented response and fails clearly when runtime is unavailable', async () => {
    const invented = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: { content: '{"gestureId":"not-a-candidate"}' } }));
    expect(await verifyGesture(request, config, invented)).toBe('unknown');
    const stopped = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(verifyGesture(request, config, stopped)).rejects.toThrow('Local model unavailable');
    const limited = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    await expect(verifyGesture({ ...request, runtime: 'cloud', cloudConsent: true }, config, limited)).rejects.toThrow('rate limit');
  });
});

describe('Bridge endpoints', () => {
  let server: Server | undefined;
  afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => { server!.close(error => error ? reject(error) : resolve()); }); });
  async function start(fetcher: typeof fetch) {
    server = createApp(config, fetcher).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    return `http://127.0.0.1:${address.port}`;
  }
  it('reports missing models and never exposes the key in status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ models: [] }));
    const response = await fetch(`${await start(fetcher)}/api/status`);
    const status = await response.json();
    expect(status.local.ready).toBe(false); expect(status.local.installed).toBe(false);
    expect(status.cloud.configured).toBe(true); expect(JSON.stringify(status)).not.toContain('test-key');
  });
  it('refuses invalid and unconsented verification requests without a provider call', async () => {
    const fetcher = vi.fn<typeof fetch>(); const url = await start(fetcher);
    const invalid = await fetch(`${url}/api/verify-gesture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(invalid.status).toBe(400);
    const denied = await fetch(`${url}/api/verify-gesture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, runtime: 'cloud' }) });
    expect(denied.status).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
});
