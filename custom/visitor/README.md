# ChatOne public visitor chat

`https://chat.jojoo.cc/visitor/` uses the shared ChatOne theme in an independent document. It never bootstraps the authenticated app, reads browser storage, or includes account credentials in its API requests. Messages live only in React state; reset aborts the current request and clears the page.

`packages/api/src/visitor/router.ts` is mounted at `/api/visitor`. Its strict input schema accepts only a question and up to six prior visitor questions. It does not use MongoDB, owner authentication, conversations, file uploads, model configuration APIs, tools, or search. A fixed subscription model selects fact IDs; its raw output is never sent to the browser. Unknown IDs, extra output fields and ungrounded prose are refused. HTTP errors are generic. There is a global concurrency limit, a 100-call daily budget, and a 20-call/10-minute IP budget (in-memory, reset on process restart).

The read-only `knowledge` mount contains **only approved public facts**, and is re-read and validated on each request. Missing/invalid knowledge fails closed. The Jojoo Pages publisher updates that file atomically after a successful push. Publication failures do not replace the active facts. No private profile, environment file, credential or conversation database belongs in this directory.

From the parent Jojoo project:

```
node --import tsx scripts/build-visitor.mts
npx vitest run scripts/visitor.test.mts
```

The build copies the canonical public policy into `packages/api/src/visitor/policy` so normal LibreChat builds remain self-contained; edit the canonical Jojoo policy and rebuild instead of editing those generated files.

To deploy only this feature without bundling other pending workspace edits, from LibreChat:

```
docker build -f custom/visitor/Dockerfile -t chatone-visitor:20260907 .
docker compose up -d --no-deps api
```

The derived image preserves the existing ChatOne image and adds only the visitor middleware/artifacts. A normal full image build also includes these artifacts. The homepage launcher is maintained in the parent project's `src/ChatOneWidget.tsx`. Do not point it at the authenticated ChatOne root.
