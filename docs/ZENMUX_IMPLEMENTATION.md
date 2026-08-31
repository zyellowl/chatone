# ChatOne: LibreChat + ZenMux

This checkout is based on LibreChat `v0.8.7` at commit
`9e74cc0e57b395926122bd4062c1fcedc48ed465` and keeps custom work on the
`custom/zenmux-claude-experience` branch.

## Repository analysis

The parent workspace was not LibreChat. It was an unrelated Vite/React career-agent project with
no commits and local private state. That project remains untouched. LibreChat lives in the isolated
`librechat/` directory so neither application's source, database, uploads, nor environment variables
are mixed.

| Area                | Location                                             | Role                                                            |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Legacy Express API  | `api/`                                               | HTTP routes, auth, uploads, conversations and endpoint adapters |
| TypeScript backend  | `packages/api/`                                      | New provider, streaming, file and agent logic                   |
| Shared schemas      | `packages/data-schemas/`                             | MongoDB models and persistence schemas                          |
| Shared types/config | `packages/data-provider/`                            | Endpoint schemas, model settings and API types                  |
| React client        | `client/`                                            | Chat, sidebar, settings, artifacts and responsive UI            |
| Shared UI           | `packages/client/`                                   | Theme tokens, primitives and shared components                  |
| Runtime config      | `librechat.yaml`                                     | ZenMux endpoint, favorites, interface and file limits           |
| Deployment          | `docker-compose.yml`, `docker-compose.override.yaml` | Official services plus local custom build                       |

### LibreChat capabilities reused directly

- MongoDB conversation and message persistence, automatic titles and branching.
- Token-by-token SSE streaming, stop generation, resume and regenerate.
- Time-grouped, searchable conversation sidebar with rename, delete and favorites/pinning.
- Model specs, model search, model favorites and a complete endpoint model list.
- Markdown, tables, syntax highlighting, LaTeX, links and copyable code blocks.
- Image paste/drag/drop, file chips, previews, file-size validation and native text parsing.
- Message copy/edit/fork/feedback actions.
- Artifact code/preview panel with a resizeable desktop split and mobile sheet.
- Light/dark/system theme settings, conversation export/delete and PWA generation.
- Mobile drawer, dynamic viewport handling, safe-area support and keyboard shortcuts.

### Required changes

- Add one server-side Anthropic-compatible custom endpoint for ZenMux.
- Add a single model registry and discovery/sync command.
- Add restrained product tokens and composer/message overrides in one custom stylesheet.
- Change app/PWA metadata and the default composer placeholder.
- Use a local Docker build so custom client assets are actually shipped.
- Add first-run environment generation without placing secrets in `.env.example`.

### Deliberately not rewritten

The request layer, database, conversation model, file pipeline, Markdown renderer, sidebar,
settings system, model selector, artifact engine and service worker remain LibreChat-owned. This
keeps the upgrade surface small and preserves upstream fixes.

## Architecture

```text
Browser
  -> LibreChat React client (never receives ZENMUX_API_KEY)
  -> LibreChat Express API
  -> native Anthropic client selected by provider: anthropic
  -> https://zenmux.ai/api/anthropic/v1/messages

MongoDB      -> conversations, messages, titles and branches
Local volumes -> uploads, images, logs and search indexes
Model registry -> favorites + generated ZenMux catalog in librechat.yaml
```

ZenMux speaks Anthropic Messages even when the selected upstream model is Gemini or GPT. LibreChat
therefore keeps one endpoint and one streaming implementation. LibreChat's Anthropic adapter only
constructs Anthropic thinking payloads for matching Claude models, preventing the same UI setting
from adding a Claude thinking object to non-Claude model IDs.

### Native web search

The ZenMux endpoint exposes Anthropic's server-side `web_search_20250305` tool. The
`customParams.paramDefinitions` entry in `librechat.yaml` makes `web_search` available by default,
while preserving the per-conversation switch in LibreChat's Parameters panel. The model decides
whether to search, and ZenMux returns the search-result blocks and citations inside the normal
stream. This path uses only `ZENMUX_API_KEY`; no search-provider credential is sent to or stored by
the browser.

ZenMux model IDs are provider-prefixed and are not present in LibreChat's built-in token map. The
favorite presets therefore carry a 90% working context budget, and `tokenConfig` records the live
ZenMux context metadata. For Claude Opus 5 this exposes 900,000 configurable input tokens instead
of LibreChat's conservative unknown-model fallback.

## Configuration

Create the private local environment once:

```bash
node custom/scripts/setup-env.mjs
```

Then set the only provider secret in `.env`:

```dotenv
ZENMUX_API_KEY=your_server_side_key
ZENMUX_BASE_URL=https://zenmux.ai/api/anthropic
```

`.env` is ignored by Git and created with mode `0600`. Never prefix the key with `VITE_`, never add
it to `client/`, and never store it in browser storage.

## Models

`custom/model-registry.json` is the source of truth for curated models and capabilities. Its shape is
documented by `custom/model-registry.d.ts`. The full ZenMux list is deliberately generated rather
than hard-coded in React:

```bash
node custom/scripts/sync-models.mjs
```

The command reads `https://zenmux.ai/api/anthropic/v1/models`, verifies every enabled favorite,
places favorites first, and refreshes the generated blocks in `librechat.yaml`. Change a display
name, description, favorite or default in the registry, then rerun the command. Raw models remain
available under the expandable ZenMux endpoint and through model search.

## Run

```bash
docker compose build api
docker compose up -d
docker compose ps
```

Open `http://localhost:3080`. On first use, register the single private account, then disable public
registration in `.env` with `ALLOW_REGISTRATION=false` and restart the API.

The default Compose path uses named volumes plus a short-lived non-root permission initializer. This
avoids macOS `Documents` bind-mount stalls while keeping LibreChat, MongoDB and Meilisearch running
as `${UID}:${GID}`. The RAG and pgvector services are placed behind the optional `rag` profile and
are not started by default: ZenMux currently documents chat/model APIs but not an embeddings API,
and starting LibreChat RAG without an embeddings credential fails. Images and text/Markdown files
still use LibreChat's normal provider upload and native parser. PDF/Word semantic ingestion requires
a separately approved, server-side embeddings provider before enabling that profile.

## Verification performed

- Full workspace/client production build, ESLint, Prettier and `git diff --check` passed.
- Fourteen custom security/config/native-shell tests passed.
- LibreChat custom-config tests passed (21/21) and Anthropic custom-endpoint initialization tests
  passed (28/28).
- `docker compose config` and a clean local image build passed; `docker compose up -d` leaves API,
  MongoDB, Meilisearch and the admin panel running, with the permissions initializer exited `0`.
- Browser smoke tests passed for login, welcome/composer, four curated models, model switching,
  missing-Key error handling, image preview/removal control, dark mode and a 390x844 mobile viewport.
- ZenMux native Web Search passed a live Claude Opus 5 request with two server-side searches,
  twenty results and source citations; the saved conversation and source cards render in the native
  macOS app.
- A temporary Claude Opus 5 request confirmed the corrected runtime context budget is over 800K
  tokens and received a complete streamed response.
- PWA manifest/service worker output was generated, and the browser console had no errors or warnings.
- The iOS project plist, Xcode project, scheme XML, asset JSON, Swift parser pass, generated icon
  dimensions and secret boundary passed static validation. Simulator and device compilation remain
  pending because this Mac currently has Command Line Tools but not the full Xcode app/iOS SDK.

Stop/regenerate across successful generations, ten-turn persistence and provider-side Vision
responses were not re-run as part of this web-search change. PDF/Word semantic ingestion also remains
pending the embeddings decision described above.

## Security boundaries

- `ZENMUX_API_KEY` is resolved only by the API process from `librechat.yaml`.
- HTML/React artifacts use LibreChat's Sandpack iframe preview, not main-page DOM injection.
- Upload limits are enforced by the server as well as reflected in the client.
- Provider stack traces stay in server logs; the existing client error boundary/toast path renders
  user-facing errors.
- MongoDB and Meilisearch are not exposed as host ports; the optional RAG/pgvector profile is off.
- The included deployment is intended for a private account. Add HTTPS and an authenticated reverse
  proxy before exposing it outside the local machine.

## Files added

- `.env.example`
- `.dockerignore` inclusion rule for `librechat.yaml`
- `librechat.yaml`
- `docker-compose.override.yaml`
- `custom/model-registry.json`
- `custom/model-registry.d.ts`
- `custom/scripts/setup-env.mjs`
- `custom/scripts/sync-models.mjs`
- `custom/macos/` native macOS shell and build script
- `custom/ios/` native SwiftUI/WebKit iPhone and iPad project
- `client/src/custom/zenmux.css`
- `docs/ZENMUX_IMPLEMENTATION.md`

## Upstream files modified

- `client/src/main.jsx` imports the custom stylesheet.
- `client/src/components/Chat/Input/ChatForm.tsx` adds a stable composer styling hook.
- `client/src/components/Chat/ChatView.tsx` uses the requested placeholder.
- `client/src/components/UnifiedSidebar/UnifiedSidebar.tsx` reduces the expanded minimum width.
- `client/src/locales/en/translation.json` adds the placeholder translation.
- `client/index.html` changes non-provider product metadata.
- `client/vite.config.ts` changes PWA metadata.
- `.gitignore` tracks the custom runtime config and Compose override while keeping secrets ignored.

## Upgrade notes

1. Fetch the desired LibreChat tag and rebase this branch onto it.
2. Resolve the seven small client-file changes above; the custom files should merge unchanged.
3. Compare the new `librechat.example.yaml` schema version and update `version` if required.
4. Confirm `provider: anthropic` custom endpoints are still supported before upgrading production.
5. Run model sync, config tests, client build and browser smoke tests.
6. Do not replace `.env` or the `chatone_*` Docker volumes. The optional PostgreSQL volume is
   only relevant after explicitly enabling the RAG profile.
7. Rebuild both native shells after upstream authentication or user-agent validation changes. They
   append an app token to the system browser user agent instead of replacing the browser identity.

## MVP differences from proprietary Claude applications

- The artifact implementation is LibreChat/Sandpack rather than any proprietary artifact runtime.
- Favorite models are curated by the registry and user pinning; there is no separate ZenMux billing
  dashboard inside the app.
- Thinking is managed by LibreChat's model parameters and backend capability checks rather than a
  pixel-identical three-state Claude control in the composer.
- Built-in keyboard shortcuts cover new chat, model selection, upload and settings. LibreChat's `/`
  surface remains its prompt command picker instead of replacing upstream behavior with a parallel
  command framework.
- File chips, image upload and native text/Markdown parsing work without a second provider. PDF/Word
  semantic ingestion and file search remain off until a server-only embeddings provider is chosen.
