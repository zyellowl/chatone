# Native ChatOne visitor mode

`/visitor/` is a route in the normal ChatOne React application. It uses the same application entrypoint, router, theme, ChatViewFrame, ChatForm controls, message rendering and footer as ChatOne. There is no standalone HTML application or iframe.

The visitor route is outside AuthLayout and Root. It never mounts the private sidebar, owner conversation loader, files, model selectors or tools. The visitor mutation uses only `/api/visitor/chat` with credentials omitted. Its messages are in memory and reset aborts pending work. The current public-only backend boundary remains in place; the planned resume knowledge base is separate future work.

Build the normal frontend with `npm run build --workspace=client`. The parent Jojoo `scripts/build-visitor.mts` builds only the restricted server handler. The derived Dockerfile installs the standard frontend build and visitor handler over the existing ChatOne image. Normal full builds also contain this route.

The API's read-only knowledge mount contains approved public facts only. Owner authentication and conversation/file/model endpoints remain protected independently of the visitor UI. Do not expose or use the owner's authenticated routes as the visitor transport.
