# Handline validation

Date: 31 October 2026. Environment: Apple Silicon macOS, 16 GB unified memory, Node 26.12.0, Ollama 0.40.13, `gemma4:12b` (7.7 GB, MLX runner).

## Automated logic and bridge tests

`npm test`: **32 tests passed**.

Coverage includes translation/scale normalization, orientation preservation, invalid landmarks, insufficient enrollment, disabled gestures, nearest-example outliers, ambiguity, overlap warnings, hold/release behavior, and separate false-trigger accounting. Recognition lifecycle tests discard late responses after pose changes, pausing, runtime changes, and consent revocation. Conflicting custom poses are rejected even when MediaPipe also returns a valid preset category.

Provider tests validate candidate IDs, malformed output, cloud consent, absent credentials, local-only routing, unavailable models, rate limits, bounded context, and the MLX structured-output fallback. Endpoint tests exercise the running Express app in isolated temporary listeners. Image composition is tested using valid JPEG data; no user images are used.

`npm run build`: TypeScript checking and the production Vite build pass. MediaPipe is loaded as a separate chunk when the camera is started. All runtime assets, fonts, and the MediaPipe model are bundled locally.

## Browser checks

`HANDLINE_LIVE_MODEL=1 npm run test:e2e`: **7 tests passed** in the final run, including the actual local model integration. The final suite completed in 48.9 seconds. Gesture persistence checks wait for the explicit saved confirmation before reloading.

The Playwright suite uses isolated browser contexts and an in-memory fake webcam stream containing Google's public MediaPipe fixtures. It loads the real MediaPipe model. Speech is stubbed to count phrase emissions; this is not an automated test of the user's speakers or OS voices.

Checks cover:

- Exact saved phrase output, repeat speech, undo, preset edits, and enabled state persistence.
- Real MediaPipe recognition after a hold; no repeated speech while held; repeat after release; silence for absent hands and an unsupported pointing pose; pause and stop camera.
- Two custom gesture enrollments with eight examples each; overlap warning; persistence after reload; phrase editing; deletion.
- Cloud runtime selection, consent gating, permission reset on reload, and missing-key messaging.
- Practice misses, unknown rejections, manual-output exclusion, and trial persistence.
- All four screens at 390, 768, and 1440 CSS pixels without horizontal overflow; no external font, asset, or model requests.
- Optional actual local Gemma verification after camera enrollment, returning and speaking the exact saved custom phrase.

Run the optional live model check with `HANDLINE_LIVE_MODEL=1 npm run test:e2e`. It contacts the installed local model only and does not read the user's browser vocabulary or camera.

## Actual local inference

`node scripts/smoke-local.mjs` exercises the actual local bridge and Gemma model using public fixtures. The latest machine-readable result is [local-smoke.json](local-smoke.json).

| Direct verification probe | Expected | Observed | Warm-model time |
| --- | --- | --- | --- |
| Matching enrolled thumbs-up pose | saved test ID | saved test ID | 1.63 s |
| Different pointing pose | unknown | unknown | 1.76 s |

The MLX runner declined schema-constrained output with HTTP 501. The adapter supports this specific capability difference without changing candidate validation. A direct multiple-image negative probe initially produced a false match. The final adapters use a single labeled contact sheet in memory to establish which image is live and which images are references; both final smoke checks pass. The browser's local candidate filter remains mandatory before calling a model.

These are connectivity and basic behavior checks over two public fixtures. They are not a recognition accuracy benchmark, a clinical claim, or evidence that every unknown pose will be rejected. Real user demo measurements should be recorded separately in Practice log.

## Remaining external setup and manual checks

- **Cloud live inference:** not tested. No `GEMINI_API_KEY` is configured. The implemented cloud adapter has unit coverage, but a real account/key with model access and available quota is needed for a live check.
- **Physical camera and audio:** the app was made available in the live preview. Automated results do not establish the quality of a user's camera, lighting, hand motion, local speech voice, or speaker output. Test these together before a demo.
- **Runtime:** first inference can be slower while the local model loads. Local mode requires the app process and Ollama to remain running. It does not switch to a remote provider on failure.
- **Storage:** gestures, examples, and trial results are scoped to browser origin. Keep the same host and port. No continuous video is stored.
- **Deployment:** the deliverable runs on localhost. No public deployment or account setup was performed.

## Sources

- [Google MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [Google Gemma API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Ollama model registry](https://ollama.com/library/gemma4)
- [Ollama vision API](https://docs.ollama.com/capabilities/vision)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)

## Feature expansion validation — 31 October 2026

Final expanded build: **42 unit tests passed; all 9 browser tests passed** with `HANDLINE_LIVE_MODEL=1 npm run test:e2e` (1.2 minutes); TypeScript and production build passed. New coverage includes 126-dimensional two-hand normalization, inter-wrist separation, 49% rejection / 50% acceptance, persisted theme/threshold preferences, real MediaPipe two-hand enrollment, and ElevenLabs endpoint consent/failure behavior.

An actual local Visual Reasoner request returned the saved ID, the exact contact sheet, and an observable pose description in 10.42 seconds. This single public-fixture probe validates the integration, not general reasoning accuracy. Real local enrollment-to-speech integration also passed the final browser suite.

ElevenLabs onboarded successfully with its key in ignored `.env.local`. A user-approved stock-voice test generated “Your gestures. Your words.” in 1.74 seconds and native playback exited successfully. Cloning, personal sample isolation, transcription, and sound-effect generation have not been live-validated with personal recordings. Cached chime playback is opt-in after explicitly generating a chime.

Headroom is installed and configured on loopback port 8788; a real SDK probe preserved negation and saved zero tokens for its short input. Only prior text history is eligible for compression. Gemini cloud recognition/composition still needs its separate API key for live validation.

Dark mode has responsive browser coverage but has not undergone a complete WCAG AAA audit. Partner Scribe uses short batch recordings, not continuous live streaming. Priority two-hand gestures produce local attention alerts after a 400 ms hold plus visual verification; they do not dispatch emergency services. No Git commit or push was performed for this expansion.
