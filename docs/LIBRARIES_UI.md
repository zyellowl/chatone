# ChatOne interface and Libraries.dev effects

The visual reference is https://libraries.dev/. ChatOne uses the official React
packages, adapted in `client/src/custom/effects/` and mounted in its existing UI:

| Library       | Package            | ChatOne integration                                                                                                              |
| ------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Border beam   | `border-beam`      | `ChatForm` composer; colorful border, stronger while focused or submitting                                                       |
| Thinking orbs | `thinking-orbs`    | 24px waiting indicator using the supported 20px engine preset, 20px solving orb during active reasoning, and running tool status |
| Gooey         | `liquid-gooey`     | Attachment and model button surfaces; 12px spacing and a small filter radius keep the controls visibly separate                  |
| Metal         | `metal-fx`         | Send button; silver ring while enabled                                                                                           |
| Image         | `img-fx` + `three` | Image generation placeholder; removed when the real image arrives, generation ends, or is cancelled                              |

`libraries.css` remains the final visual override. The former imitation CSS
beam was removed. All effects follow ChatOne's light/dark/system preference and
pause for reduced motion or a hidden document. Metal and Image detect WebGL
support before mounting and retain functional plain content when unavailable.
Effects do not provide model or image-generation capabilities: existing tools,
message submission, file handling, and model selection still own those flows.

Mobile layout reserves 44px controls, keeps beam geometry separate from safe-area
spacing, and limits the model button width. Model menus open above the trigger,
focus the panel on phones, use a regular search placeholder and an explicit close
button. Desktop search still receives keyboard focus.

Touch devices retain the official effects. Beam runs continuously while the page is visible,
including when the composer is empty or unfocused, and becomes stronger while focused or submitting;
Metal mounts only for an enabled send button, with a 46px effect and 1px ring without an outer halo.
Light mode uses 0.6 effect strength; dark mode uses 0.5 strength. The stop button retains
the same 44px neutral surface and border as the send control.
The send button stays outside MetalFx's rendering container. The metallic ring is
a pointer-transparent decorative overlay, so a stalled or unavailable first shader
frame cannot hide the control or block sending.
Gooey uses a 1px blur on touch screens with a 12px control gap. Image animation is
limited to active generation. Hidden pages and reduced-motion preferences pause
animations; touch input alone is not a reason to disable them.

On phones, a rightward swipe starting within 40px of the left screen edge opens
chat history; a leftward swipe inside history closes it. Vertical scrolling,
editable fields, code blocks, and modal controls retain their normal gestures.
The iOS shell disables WebKit's competing back/forward swipe gesture.

Mobile sidebars cast no lateral shadow, so a translated, closed sidebar cannot
leave a dark strip on the chat page. The composer has no neutral border or inset
shadow beneath Beam, including while focused; keyboard focus indicators remain.
Floating surfaces use theme-specific soft shadows, and the Metal ring is 1px.

Validation:

- `npm run build:client`
- Targeted ESLint on changed UI components
- Client Jest: `OpenAIImageGen.test.tsx`, `CustomMenu.test.tsx`
- `E2E_CHROMIUM_CHANNEL=chrome E2E_MCP_HTTP_PORT=8767 E2E_BASE_URL=http://127.0.0.1:3096 E2E_USE_MEMORY_MONGO=true MONGO_URI=mongodb://127.0.0.1:27017/LibreChat-effects-e2e npx playwright test --config=e2e/playwright.config.effects.ts`

The browser checks use a separate temporary database and local fake model. They
exercise light/dark mobile and desktop layouts, actual canvas mounting, draft
preservation, model menu focus, send availability, reduced motion, and the
waiting-for-response orb. The full frontend typecheck has existing repository
errors; changes must not add new diagnostics.

The local rollout updates `/app/client/dist` in the running ChatOne container and
builds the same assets into its local image. Previous assets and image are kept
for rollback. No account, provider credential, or conversation migration is needed.
