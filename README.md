# Handline

A personal gesture communicator for Hacktoberfest Hack Day Pune × AIDN. One app with two recognition runtimes: **offline with local Gemma 4 12B**, or **online with cloud Gemma through the Gemini API**.

Handline displays and optionally speaks the exact phrase a person has assigned to a static, one-hand gesture. It is a prototype for personal shortcuts, not a sign-language translator.

## Run this installation

```sh
cd /Users/tatvagnatandel/Documents/AIDN
npm run dev
```

Open **http://localhost:5173**. The development command starts the local bridge on port 8787 and the React app on port 5173. The bridge and app are already running for this build session. Ollama and `gemma4:12b` have been installed on this Mac.

Use the same browser, host, and port each time: IndexedDB storage belongs to the browser origin. `localhost:5173`, `127.0.0.1:5173`, and `localhost:8787` have separate vocabularies.

## Fresh setup

Requirements: Node.js 22.12+ (Node 24 or newer recommended), npm, a webcam, and a current Chrome, Edge, or Safari browser. Local Gemma also needs [Ollama](https://ollama.com/download). This project was built with Node 26 on an Apple Silicon Mac with 16 GB RAM.

```sh
npm install
npm run setup:assets
ollama pull gemma4:12b
npm run dev
```

Ollama must be running. Start its application, or run `ollama serve` in another terminal if a server is not already running. The model is approximately 7.7 GB on this installation; inference requires additional memory. No other installed models are removed or modified.

`setup:assets` downloads the official MediaPipe model and copies the installed MediaPipe WebAssembly runtime into `public/`. Fonts are installed through npm. After this setup, local mode works without internet while the local app and Ollama are running. No CDN, external font service, hosted inference, or remote fallback is used in local mode. A local system speech voice must be installed for offline audio output.

## Use it

1. Start with the four presets: thumbs up → “Yes”, thumbs down → “No”, open palm → “Hello”, and victory sign → “Thank you”. Edit their names, phrases, or enabled state in **Gesture library**.
2. Tap a phrase to communicate without a camera. **Speak message** repeats the displayed words; **Undo** restores the previous message.
3. Start the camera, show exactly one hand in good light, and hold a pose for 0.9 seconds by default. Lower the hand for at least 0.6 seconds before repeating. Holding the same pose does not repeatedly speak.
4. Choose **Add a gesture**, enter a name and exact phrase, and capture at least eight examples. Slightly vary the distance and angle while keeping the same finger pose. Retake individual samples, re-record all examples, or edit/delete a saved custom gesture.
5. Choose **Offline** or **Online**. Presets run locally in both modes. Custom gestures need a successful Gemma visual check. Missing models, missing keys, connection failures, ambiguity, and unknown poses never produce a custom phrase.
6. Use **Practice log** to record trials. Select the expected gesture (or unknown), start a trial, try the pose, and finish the trial. Manual phrase presses do not count as recognitions. Any unexpected automatic output is a false trigger, even if a correct output also occurred. Export measurements as JSON.

Recognition pauses when the page is hidden or when you leave the communication screen. After enrollment or returning from another screen, resume explicitly if the camera is still running. Stopping the camera releases its video tracks.

## Cloud setup

Local mode needs no API key. To enable online custom-gesture verification:

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY` to your [Google AI Studio key](https://aistudio.google.com/apikey).
3. Restart `npm run dev` (or the production server).
4. Choose **Online**, then allow selected hand images under **Runtime & setup**.

The key stays in the server environment. The browser sends one selected hand crop, candidate labels/IDs, and at most two reference crops for each of up to three candidates. Continuous webcam video and saved phrases are not sent. Image payloads and phrases are not logged by the app. Cloud image permission resets on reload, and revoking it cancels in-flight verification.

Default cloud model: `gemma-4-26b-a4b-it`. Google's current [Gemma API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) lists this model and `gemma-4-31b-it`, with image support. Your key must have model access and available quota. Switching runtimes never silently uploads a local request to the cloud.

Cloud adapter request/response behavior is covered by automated tests. A live cloud inference has **not** been run because no Gemini API key is configured in this installation.

## Build and run without the development server

```sh
npm run build
npm start
```

Open http://localhost:8787. This serves the built UI and bridge from one local process. Keep the same origin for subsequent visits to retain the vocabulary created there. For an existing vocabulary on port 5173, stop the development process and run `PORT=5173 npm start`, then continue using http://localhost:5173.

The app binds to `127.0.0.1`. Camera access requires localhost or HTTPS. A hosted page by itself cannot reach a visitor's local model; this local bridge is the connection path. A shared hosted deployment would need its own operational setup.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | empty | Optional server-side cloud credential |
| `GEMINI_MODEL` | `gemma-4-26b-a4b-it` | Cloud image model |
| `OLLAMA_MODEL` | `gemma4:12b` | Installed local vision model |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama connection; only local HTTP addresses are accepted |
| `PORT` | `8787` | Bridge / production UI port |

Settings in the app control auto-speech, local voice selection, speech speed, and gesture hold time. Local requests use a bounded 4096-token context and disable thinking. This Mac's Ollama MLX runner does not support schema-constrained output; the adapter retries that specific capability error without a schema and still strictly validates the returned candidate ID.

## Architecture

```text
Webcam → bundled MediaPipe → landmarks + preset category
                                ↓
                       custom nearest-example matcher
                                ↓
                     stable, unambiguous candidate
                                ↓
                    selected hand crop + references
                         ↙                   ↘
             local bridge / Ollama     app bridge / Gemini API
                         ↘                   ↙
                        validated saved ID or unknown
                                ↓
                     exact stored phrase → text + speech
```

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Phosphor icons, locally bundled Geist fonts.
- **Tracking:** MediaPipe Tasks Vision; loaded only after camera start, throttled to approximately 12 updates/second. Two detected hands are rejected.
- **Matching:** wrist-relative, scale-normalized 21-point landmarks, retaining hand orientation. Mean distance over the three nearest examples must be ≤ 0.16. Top candidates separated by less than 0.025 are ambiguous and are rejected before model calls. A confident custom match takes priority over a preset. Opposite-hand variants may need their own examples.
- **Stability:** continuous pose hold, then release to repeat; pending results are invalidated when pose, runtime, consent, visibility, or recognition state changes.
- **Storage:** IndexedDB for mappings, selected hand reference JPEGs, settings, and evaluation results. Webcam video is never persisted. Conversation text is kept only in session memory.
- **Bridge:** Express and Zod; separate Ollama/Gemini adapters, bounded image requests, strict candidate validation, model status, and actionable failure states.
- **Visual comparison:** the bridge creates a labeled contact sheet of the live crop and candidate references in memory. Both adapters receive this single image, keeping image order unambiguous across runtimes. No sheet is written to disk.
- **Speech:** browser speech synthesis, using device-local voices only. Text output remains usable when speech is unavailable.

Thresholds are prototype settings, not measured clinical guarantees. Moving gestures, two-hand gestures, accounts, and emergency-service actions are outside this MVP.

## Validation

```sh
npm test                  # matching, stability, lifecycle, provider, and endpoint tests
npm run typecheck
npm run build
npx playwright install chromium  # first run only
npm run test:e2e           # isolated browser contexts, fake camera with real MediaPipe
HANDLINE_LIVE_MODEL=1 npm run test:e2e # also exercise real local Gemma after enrollment
node scripts/smoke-local.mjs     # actual Ollama vision requests with public fixtures
```

Browser tests use public MediaPipe hand images instead of accessing your webcam. Speech is stubbed in automation. Provider unit tests stub remote responses. The local smoke script uses the actual installed model through the actual app endpoint; its results and timings are saved in `docs/local-smoke.json`. Those two public-fixture checks establish connectivity and basic behavior, not real-world recognition accuracy.

See [validation details](docs/VALIDATION.md) and the desktop/mobile screenshots in `docs/`.

## Source references

- [MediaPipe Gesture Recognizer for web](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [Gemma on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Ollama Gemma 4 variants](https://ollama.com/library/gemma4)
- [Ollama vision REST inputs](https://docs.ollama.com/capabilities/vision)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
