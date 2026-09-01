# ChatOne for macOS

This directory builds a small native AppKit/WebKit shell around the existing LibreChat deployment.
It does not copy the ZenMux API key into the application. The key remains in the server-side `.env`.

## Build

```bash
npm run macos:build
```

The application is generated at `dist/ChatOne.app`. It is ad-hoc signed for local use and can
be opened directly or copied to `/Applications`.

At launch, the app checks `http://127.0.0.1:3080/api/config`. If LibreChat is not available, it
starts Docker Desktop when needed, then starts the existing `chat-mongodb`, `chat-meilisearch`, and
`ChatOne` containers. If Docker Desktop still owns the local port but its engine has stopped
responding, ChatOne performs one clean Docker Desktop relaunch. While the app is open it also checks
the local service periodically and reconnects after two consecutive failures. Run the repository's
Docker setup once before using the app for the first time. This avoids granting the app access to
the source directory or secret files.

Launcher diagnostics are written to `~/Library/Logs/ChatOne/launcher.log`. LibreChat and ZenMux
request diagnostics remain in the existing Docker logs.

GPT requests go through the loopback-only ChatGPT subscription bridge installed with
`zsh custom/codex-bridge/install-launch-agent.sh`. The bridge reads and refreshes the existing Pi
`openai-codex` OAuth login under the macOS user. No OAuth token is copied into the macOS WebKit
client, Docker container, browser storage, or app bundle.

## Distribution

The local build targets the current Mac architecture and uses ad-hoc signing. Distribution to other
Macs requires an Apple Developer ID signature, notarization, and either a matching LibreChat server
installation or a remote HTTPS server configuration.
