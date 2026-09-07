# ChatOne for iOS

This is a native SwiftUI/WebKit client for the existing LibreChat deployment. It preserves
LibreChat authentication cookies in the iOS WebKit data store and never reads, receives, or bundles
provider credentials.

## Requirements

- Xcode 15 or newer with an iOS Simulator runtime.
- The existing ChatOne Docker services running on the Mac.
- iOS 16 or newer.

The scripts discover Xcode in either `/Applications/Xcode.app` or
`~/Applications/Xcode.app`. A user-local installation avoids changing the machine-wide
`xcode-select` setting; `DEVELOPER_DIR` can also point at another Xcode installation.

## Prepare and build

The iOS app icon uses `artwork/feather-natural-quill.png`, based on the website's blue-green
feather with reduced padding and a restored slender quill. `ios:prepare` generates
the opaque iPhone, iPad, and App Store icon sizes without cropping the quill.

```bash
npm run ios:prepare
npm run ios:build
npm run ios:run
```

`ios:run` builds, boots an available iPhone Simulator, installs the app, and launches it. You can
also open `custom/ios/ChatOne.xcodeproj` in Xcode and run the `ChatOne` scheme manually. The
simulator defaults to `http://127.0.0.1:3080`, which reaches the Mac-hosted Docker service.

For the first Simulator preview, supply an existing ordinary preview account using the
`CHATONE_PREVIEW_EMAIL` and `CHATONE_PREVIEW_PASSWORD` environment variables when running
`npm run ios:run`. The Debug Simulator build signs in through `/api/auth/login` and saves the
resulting session in its cookie vault. Later launches restore that session without these variables.
This option only accepts loopback servers, refuses redirects, and is absent from Release and
physical-device builds. It does not enable registration or change server authentication.

The iPhone never receives OpenAI OAuth or ZenMux credentials. It talks only to LibreChat; GPT calls
then pass through the Mac's loopback-only ChatGPT subscription bridge.

## Run on a physical iPhone

1. Make sure the iPhone and Mac are on the same trusted Wi-Fi network.
2. Find the Mac's LAN address, for example with `ipconfig getifaddr en0`.
3. In the first-launch screen enter `http://MAC_LAN_IP:3080`.
4. In Xcode, select your Apple development team and the connected iPhone, then Run.

A free Apple Account can install a development build on a connected personal device from Xcode.
That build must be refreshed when its development provisioning expires. TestFlight or App Store
distribution requires an Apple Developer Program membership.

The app requests local-network access the first time it connects. Plain HTTP is supported for a
trusted private LAN so the existing Docker service works without another proxy. For access outside
the home network, place LibreChat behind HTTPS or a private VPN such as Tailscale; never expose port
3080 directly to the public internet.

## Native behavior

- Persistent LibreChat login and conversation state through `WKWebsiteDataStore.default()`.
- A native server preflight check before saving the address.
- A centered native ChatOne title with conversation history and new chat buttons.
- Settings → 应用配置 contains server address, reload, history navigation and Safari handoff.
  The sign-in screen retains an app-settings button so the server can be changed before login.
- Route-aware iPhone layouts for authentication, conversations, composer controls, menus and dialogs.
- Interactive keyboard dismissal with 16-point-or-larger web inputs to prevent focus zoom.
- Camera, microphone, photo-library and document upload permission descriptions.
- Native download handoff to the iOS share sheet; external Web Search citations open in Safari.
- A connection recovery screen can retry or change the server address.
- iPhone and iPad layouts, orientation support, safe-area handling and `100dvh` web layout.
- System CJK font fallback inside WebKit so Chinese labels render correctly on iOS.
- A privacy manifest, opaque App Store icon, and no broad arbitrary-network-load exception.

The server address is a non-secret preference stored in `UserDefaults`. GPT traffic continues
through the server-side subscription endpoint configured by `librechat.yaml`.

## Verified locally

The project has been compiled and launched with Xcode 26.3 and the iOS 26.3 Simulator. Run
`npm run ios:test` for the wrapper's safety and integration checks, then `npm run ios:run` to rebuild,
install, and launch the current source on an available iPhone Simulator.
