# macOS distribution

The DMG contains the compiled app, Electron runtime, MediaPipe assets, and local server. It does not contain API keys or the Gemma weights. Install Ollama separately and run `ollama pull gemma4:12b` for local model verification.

Drag Handline to Applications. App data is separate from browser data. Optional API credentials belong in `~/Library/Application Support/Handline/.env.local`, using the variable names from the repository's `.env.example`; restart the app after changing them. No project credentials are copied into the installer.

This development build is ad-hoc signed, not notarized with an Apple Developer account. macOS may require approval through System Settings → Privacy & Security on first launch.
