import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(2000), voiceId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  modelId: z.enum(['eleven_multilingual_v2', 'eleven_turbo_v2_5']).default('eleven_multilingual_v2'),
  languageCode: z.string().regex(/^[a-z]{2,3}$/).optional(), consent: z.literal(true),
});
const uploads = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 2 }, fileFilter: (_req, file, done) => {
  if (!/^audio\//.test(file.mimetype)) { done(new Error('Please choose an audio file.')); return; }
  done(null, true);
} });

export function createElevenLabsRouter(client?: ElevenLabsClient, configured = !!process.env.ELEVENLABS_API_KEY) {
  const getClient = () => client ??= new ElevenLabsClient();
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/status', (_req, res) => res.json({ configured, message: configured ? 'Server key configured. Load voices to check account access.' : 'Run ElevenLabs onboarding to connect your account.' }));
  router.use((_req, res, next) => { if (!configured) { res.status(503).json({ error: 'ElevenLabs is not configured. Device speech remains available.' }); return; } next(); });
  const failure = (res: import('express').Response, error: unknown) => {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 503;
    res.status([401, 403, 429].includes(status) ? status : 503).json({ error: status === 429 ? 'ElevenLabs quota or rate limit reached. Use device speech or try later.' : status === 401 || status === 403 ? 'ElevenLabs access was refused. Check account access and plan permissions.' : 'ElevenLabs is unavailable. Use device speech or try again.' });
  };
  router.get('/voices', async (_req, res) => {
    try { const data = await getClient().voices.getAll(); res.json({ voices: data.voices.map(v => ({ id: v.voiceId, name: v.name, category: v.category })) }); }
    catch (error) { failure(res, error); }
  });
  router.post('/tts', async (req, res) => {
    const input = ttsSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: 'Choose a voice, valid phrase, and allow cloud speech.' }); return; }
    try {
      const audio = await getClient().textToSpeech.convert(input.data.voiceId, { text: input.data.text, modelId: input.data.modelId, outputFormat: 'mp3_44100_128', ...(input.data.modelId !== 'eleven_multilingual_v2' && input.data.languageCode ? { languageCode: input.data.languageCode } : {}) });
      res.type('audio/mpeg').send(Buffer.from(await new Response(audio).arrayBuffer()));
    } catch (error) { failure(res, error); }
  });
  router.post('/clone', uploads.array('samples', 2), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (req.body.consent !== 'true' || typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.length > 80 || !files?.length) {
      res.status(400).json({ error: 'Provide a name, audio samples, and permission to create this voice.' }); return;
    }
    try {
      const result = await getClient().voices.ivc.create({ name: req.body.name.trim(), files: files.map(f => new File([new Uint8Array(f.buffer)], f.originalname, { type: f.mimetype })), removeBackgroundNoise: req.body.isolate === 'true' });
      res.json({ voiceId: result.voiceId, requiresVerification: result.requiresVerification, message: result.requiresVerification ? 'Voice created; complete verification in ElevenLabs before use.' : 'Voice created and added to your ElevenLabs account.' });
    } catch (error) { failure(res, error); }
  });
  router.post('/sound-effect', async (req, res) => {
    if (req.body.consent !== true) { res.status(403).json({ error: 'Allow cloud audio generation first.' }); return; }
    try {
      const audio = await getClient().textToSoundEffects.convert({ text: 'A soft, short, gentle two-note confirmation chime. No speech, no music, no alarm.', durationSeconds: 0.5, promptInfluence: 0.8 });
      res.type('audio/mpeg').send(Buffer.from(await new Response(audio).arrayBuffer()));
    } catch (error) { failure(res, error); }
  });
  router.post('/transcribe', uploads.fields([{ name: 'audio', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
    const received = req.files as Record<string, Express.Multer.File[]>;
    const inputs = [...received?.audio ?? [], ...received?.file ?? []];
    const file = inputs.length === 1 ? inputs[0] : undefined;
    if (req.body.consent !== 'true' || !file) { res.status(400).json({ error: 'Select a recording and confirm the speaker agrees to cloud transcription.' }); return; }
    try {
      const data = await getClient().speechToText.convert({ file: new File([new Uint8Array(file.buffer)], file.originalname, { type: file.mimetype }), modelId: 'scribe_v2', tagAudioEvents: false });
      res.json({ text: 'text' in data ? data.text : '', languageCode: 'languageCode' in data ? data.languageCode : '' });
    } catch (error) { failure(res, error); }
  });
  router.use((error: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
    res.status(400).json({ error: error instanceof multer.MulterError ? 'Upload at most two audio files, each under 15 MB.' : 'Could not read the audio upload. Use an audio recording under 15 MB.' });
  });
  return router;
}
