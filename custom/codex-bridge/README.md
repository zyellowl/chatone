# ChatGPT subscription model bridge

This local-only service reuses Pi's open-source `openai-codex-responses` provider
as one small OpenAI-compatible endpoint for LibreChat. It calls `gpt-5.6-sol`
through the ChatGPT subscription request layer without launching the Codex CLI,
so the model receives LibreChat's conversation and system prompt directly. It
supports real token streaming, cancellation, text, inline images, token usage, and server-side web
search.

The bridge binds to `127.0.0.1:4317`; it is not published to the LAN or internet.
The macOS app can start it on demand. For the iPhone client, install the included
per-user LaunchAgent so the bridge remains available while the macOS window is
closed. ChatOne starts Pi's ChatGPT OAuth flow itself: the system browser
opens `auth.openai.com`, OpenAI redirects to the loopback callback at
`http://localhost:1455/auth/callback`, and the bridge stores the resulting OAuth
credential at `~/Library/Application Support/ChatOne/auth/openai.json` with
owner-only permissions. Pi's credential store refreshes that login automatically.
No credential is sent to the browser UI, iPhone, or LibreChat.

For live or time-sensitive questions, the bridge searches Bing's public RSS endpoint, falls back to
the bundled SearXNG container, safely reads a few top public HTTPS pages, and also exposes a
`web_search` tool to the model. Weather requests receive structured
Open-Meteo data in addition to ordinary search results. SearXNG listens only on
`127.0.0.1:8088`; start it with `docker compose up -d searxng`. This search path needs no additional
API key. Queries sent for web search are forwarded to Bing or SearXNG's enabled public search
engines, as expected for a web-search feature. Page reads validate DNS and every redirect, reject
local/private destinations, cap downloaded bytes, and account for Clash fake-IP DNS on macOS.

The bridge does not use a fixed list of topics as its main search gate. A lightweight model from the
same ChatGPT subscription first reviews recent conversation context on every turn, decides whether
external retrieval is necessary, resolves references in follow-up questions, and writes optimized
search queries. Stable and self-contained requests skip retrieval. Explicit tool calling remains
available to the answering model as a second chance.

Weather and A-share lookups are optional structured enrichers selected after that general decision.
The A-share enricher retrieves three benchmark indices, Shanghai plus Shenzhen turnover, and
advancing/declining/unchanged counts from public Tencent Finance and Eastmoney market feeds. These
enrichers improve precision but do not decide whether arbitrary topics are allowed to search.

This is a local subscription client integration rather than OpenAI Platform API
access. It remains subject to ChatGPT plan limits and OpenAI safeguards. The
ChatGPT backend route used by Pi is not a documented general-purpose public API
and may need maintenance when either side changes. Pi must be installed as the
local OAuth and model-provider runtime, but it does not need to be logged in
separately.

Transient upstream overload and gateway failures are absorbed by an adaptive
same-model recovery layer. It serializes requests for this personal deployment,
shares an overload cooldown across queued turns, and retries up to six attempts
over roughly twenty seconds before returning an error to LibreChat. A retry is
only transparent before response text starts, so streaming output can never be
duplicated. It never falls back to a different model. Authentication,
subscription limits, unsupported models, and overload are reported as separate
error codes so the UI does not mislabel every upstream failure as a model
problem.

For local diagnostics:

```bash
node custom/codex-bridge/server.mjs
curl http://127.0.0.1:4317/health
```

Install or update the persistent user service:

```bash
zsh custom/codex-bridge/install-launch-agent.sh
curl http://127.0.0.1:4317/v1/subscription/usage
```

It runs only while this macOS user is logged in and starts again at login. To
remove it, use `zsh custom/codex-bridge/uninstall-launch-agent.sh`; the installed
files are moved to Trash.
