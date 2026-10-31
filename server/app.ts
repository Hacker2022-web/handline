import express from 'express';
import { totalmem } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderError, verificationSchema, verifyGesture, type ProviderConfig } from './verification';

export function createApp(config: ProviderConfig, fetcher: typeof fetch = fetch) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/status', async (_req, res) => {
    const memoryGB = Math.round(totalmem() / 1024 ** 3);
    const local = { ready: false, model: config.localModel, installed: false, memoryGB, message: 'Ollama is not running. Start Ollama to use custom gestures locally.' };
    try {
      const response = await fetcher(`${config.ollamaURL}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        local.installed = data.models?.some((m: { name: string }) => m.name === config.localModel) ?? false;
        if (local.installed) {
          const show = await fetcher(`${config.ollamaURL}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.localModel }), signal: AbortSignal.timeout(4000) });
          const details = show.ok ? await show.json() : {};
          local.ready = Array.isArray(details.capabilities) && details.capabilities.includes('vision');
          local.message = local.ready ? 'Ready. Selected hand images are verified on this device.' : 'The installed model could not be confirmed as vision-capable. Check Ollama.';
        } else local.message = `Model not installed yet. Run ollama pull ${config.localModel}.`;
      }
    } catch { /* Return an actionable offline state without logging payloads. */ }
    res.json({ local, cloud: { configured: !!config.apiKey, model: config.cloudModel, message: config.apiKey ? 'API key configured. Connection is checked when verifying a gesture.' : 'Add GEMINI_API_KEY to the server .env file, then restart the app.' } });
  });
  app.post('/api/verify-gesture', async (req, res) => {
    const parsed = verificationSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid gesture request. Supply a live JPEG and 1–3 candidates with reference images.' }); return; }
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const gestureId = await verifyGesture(parsed.data, config, fetcher, controller.signal);
      res.json({ gestureId });
    } catch (error) {
      res.status(error instanceof ProviderError ? error.status : 503).json({ error: error instanceof ProviderError ? error.message : 'Verification unavailable. Presets and manual phrases are still available.' });
    }
  });
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => {
      if (req.path.startsWith('/api/')) { res.status(404).json({ error: 'Endpoint not found' }); return; }
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  app.use((error: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'Could not read request. Please try again with a smaller image.' });
  });
  return app;
}
