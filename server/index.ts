import { config as loadEnv } from 'dotenv';
loadEnv({path:'.env.local', quiet:true});
loadEnv({quiet:true});
import { createApp } from './app';

const ollamaURL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const url = new URL(ollamaURL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:') {
  throw new Error('OLLAMA_URL must use local HTTP on localhost. Local mode must stay on this device.');
}
const port = Number(process.env.PORT ?? 8787);
createApp({
  ollamaURL: ollamaURL.replace(/\/$/, ''), localModel: process.env.OLLAMA_MODEL ?? 'gemma4:12b',
  cloudModel: process.env.GEMINI_MODEL ?? 'gemma-4-26b-a4b-it', apiKey: process.env.GEMINI_API_KEY ?? '',
}).listen(port, '127.0.0.1', () => console.log(`Handline bridge ready at http://localhost:${port}`));
