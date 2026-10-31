# Additional Handline uses and next experiments

The expansion adds sentence drafting and partner transcription as optional, user-controlled tools. Generated wording is always shown for review and explicitly approved before speech. Saved gesture phrases keep their exact meaning.

Useful applications to validate with intended users:

- **Care routines:** personal gestures for repositioning, water, lighting, a break, or asking a familiar caregiver to come closer. Design each vocabulary with its user; no automatic clinical interpretation.
- **Classroom participation:** an individual's gestures for asking a question, requesting more time, or choosing a saved response. Keep phrase buttons available for difficult camera conditions.
- **Noisy rooms and quiet spaces:** large text can communicate where speech is hard to hear or inappropriate. A future full-screen display could help a conversation partner across a table.
- **Temporary speech difficulty:** a small vocabulary prepared before a procedure or while resting the voice. This remains a general communication prototype, not a medical device claim.
- **Conversation preparation:** users can assemble phrase pieces and review a suggested sentence before an appointment, class, or call.

Potential future features, not represented as already validated:

1. User-controlled vocabulary export/import and an encrypted backup chosen by the user.
2. Session-specific phrase groups such as home, classroom, and travel, with a stable fallback board.
3. Fatigue-aware calibration based on explicit user feedback; do not lower thresholds automatically.
4. Distinct left/right-hand enrollment and seated-camera calibration checks.
5. An optional communication-partner screen with large text and easy correction controls.
6. Practice comparisons across lighting and distance that report false triggers and misses separately.

Headroom is used only for earlier conversation context, through a separately configured local proxy. Current intentions, selected exact phrases, vocabulary IDs, and visual gesture comparisons are not compressed. Compression savings are reported from the runtime response, not assumed.

## Local Headroom runtime

This machine's temporary Python 3.12 environment is `/tmp/handline-headroom-py312`. Its loopback proxy runs on port 8788, avoiding Handline's bridge on 8787. It uses stateless lossless processing with telemetry, subscription tracking, and memory disabled. The TypeScript SDK's synthetic smoke check succeeded and preserved an explicit negation; its short input saved zero tokens. Short AAC conversations should not be expected to produce substantial savings.

For a reproducible installation with Python 3.12:

```sh
python3.12 -m venv .venv-headroom
.venv-headroom/bin/pip install 'headroom-ai[proxy]==0.42.0'
.venv-headroom/bin/headroom proxy --host 127.0.0.1 --port 8788 --stateless --no-telemetry --no-subscription-tracking --lossless --compressor smart_crusher --compressor log
```

In a separate terminal, start the Handline bridge with `HEADROOM_URL=http://127.0.0.1:8788` in its environment. If configuring a local environment folder in the project, exclude `.venv-headroom/` from Git. The adapter accepts local HTTP proxy addresses only and falls back to the original context when compression is unavailable. No provider calls pass through Headroom: only the prior text context goes to `/v1/compress`.
