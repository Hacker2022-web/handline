# ElevenLabs integration validation

Date: 31 October 2026.

- Official ElevenLabs onboarding created a project key in ignored `.env.local`. The key file was never printed or committed.
- `onboard check --answered --env-path .env.local` confirms the API key works and the SDK is installed and imported by application code.
- After the user explicitly approved one generation/playback test, the official server SDK generated **“Your gestures. Your words.”** using `eleven_multilingual_v2` and an available standard voice.
- The test generated a 30,136-byte MP3 in approximately 1.74 seconds. File: `docs/elevenlabs-test.mp3`. Native playback completed successfully using macOS `afplay` (exit code 0).
- No additional onboarding-generated paid test was requested: its verification result offers another test, while the approved direct SDK test already demonstrates synthesis.
- Unit tests use a fake provider and cover missing configuration, exact phrase forwarding, explicit consent, error handling, clone verification requirements, partner transcription permission, and SDK construction without credentials.
- Voice cloning, noise removal, generated chimes, and partner transcription are implemented but were not tested against the live account. They require user-selected recordings/consent and applicable account permissions/credits.
- Offline runtime makes no new cloud TTS request. It uses cached audio or a device voice. Generated audio is cached in the browser, with cache keys including phrase, voice, model, and language.
