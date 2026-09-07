import SwiftUI
import UIKit
import WebKit

final class ChatContentWebView: WKWebView {
  override var inputAccessoryView: UIView? { nil }
}

@MainActor
final class WebViewState: ObservableObject {
  @Published var isLoading = true
  @Published var errorMessage: String?
  @Published var canGoBack = false
  @Published var canGoForward = false
  @Published var isAuthPage = true
  @Published var isShowingAppSettings = false
  @Published var routePath = "/"

  fileprivate var reloadAction: (() -> Void)?
  fileprivate var goBackAction: (() -> Void)?
  fileprivate var goForwardAction: (() -> Void)?
  fileprivate var openSidebarAction: (() -> Void)?
  fileprivate var newChatAction: (() -> Void)?

  func retry() {
    errorMessage = nil
    isLoading = true
    reloadAction?()
  }

  func goBack() {
    goBackAction?()
  }

  func goForward() {
    goForwardAction?()
  }

  func openSidebar() {
    openSidebarAction?()
  }

  func newChat() {
    newChatAction?()
  }
}

struct ChatWebView: UIViewRepresentable {
  let serverURL: URL
  @ObservedObject var state: WebViewState
  @Environment(\.colorScheme) private var colorScheme

  func makeCoordinator() -> Coordinator {
    Coordinator(serverURL: serverURL, state: state)
  }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.applicationNameForUserAgent = "ChatOne-iOS/1.0"
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true

    let appModeScript = WKUserScript(
      source: Self.appModeSource,
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(appModeScript)
    configuration.userContentController.add(context.coordinator, name: "chatOneNative")

    let webView = ChatContentWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = false
    webView.allowsLinkPreview = false
    webView.isOpaque = false
    Self.applyAppearance(colorScheme, to: webView)
    webView.scrollView.keyboardDismissMode = .interactive
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.scrollView.alwaysBounceVertical = false
    webView.scrollView.decelerationRate = .normal

    context.coordinator.webView = webView
    state.reloadAction = { [weak webView] in
      webView?.load(URLRequest(url: serverURL, cachePolicy: .reloadRevalidatingCacheData))
    }
    state.goBackAction = { [weak webView] in
      if webView?.canGoBack == true { webView?.goBack() }
    }
    state.goForwardAction = { [weak webView] in
      if webView?.canGoForward == true { webView?.goForward() }
    }
    state.openSidebarAction = { [weak webView] in
      webView?.evaluateJavaScript(
        "document.querySelector('[data-testid=\\\"open-sidebar-button\\\"]')?.click()"
      )
    }
    state.newChatAction = { [weak webView] in
      guard let newChatURL = URL(string: "/c/new", relativeTo: serverURL)?.absoluteURL else { return }
      webView?.evaluateJavaScript("""
        (() => {
          const button = document.querySelector('[data-testid="chatone-new-chat"], [data-testid="new-chat-button"]');
          if (!button) return false;
          document.activeElement?.blur();
          button.click();
          return true;
        })();
        """) { [weak webView] result, _ in
          if result as? Bool != true {
            webView?.load(URLRequest(url: newChatURL))
          }
        }
    }
    context.coordinator.restoreSessionAndLoad(webView)
    return webView
  }

  private static let brandLogoBase64 = UIImage(named: "BrandLogo")?.pngData()?.base64EncodedString() ?? ""

  private static let appModeSource = """
      (() => {
        const root = document.documentElement;
        const fontFamily = '"PingFang SC", ".PingFang UI SC", "Hiragino Sans", -apple-system, BlinkMacSystemFont, sans-serif';
        try {
          window.localStorage.setItem('color-theme', 'system');
        } catch (_) {
          // Private browsing and restricted storage should not block the app shell.
        }
        root.classList.add('chatone-ios');
        root.style.setProperty('--pa-font-ui', fontFamily, 'important');
        root.style.setProperty('--pa-font-display', fontFamily, 'important');
        root.style.setProperty('font-family', fontFamily, 'important');

        const style = document.createElement('style');
        style.id = 'chatone-ios-experience';
        style.textContent = `
          html.chatone-ios {
            --chatone-native-canvas: #faf9f6;
            --chatone-native-surface: #fffefa;
            --chatone-native-line: #ded9cf;
            --chatone-native-ink: #2f2d29;
            --chatone-native-muted: #716e67;
            --chatone-native-accent: #b55f43;
            --chatone-native-logo-surface: rgba(255, 254, 250, 0.78);
            --chatone-native-logo-line: rgba(55, 51, 44, 0.08);
            --chatone-native-logo-shadow: rgba(56, 48, 38, 0.08);
            --chatone-native-focus: rgba(181, 95, 67, 0.16);
            height: 100%;
            color-scheme: light dark;
            -webkit-text-size-adjust: 100%;
            overscroll-behavior: none;
          }

          @media (prefers-color-scheme: dark) {
            html.chatone-ios {
              --chatone-native-canvas: #272724;
              --chatone-native-surface: #2d2d2a;
              --chatone-native-line: #41413c;
              --chatone-native-ink: #f0eee8;
              --chatone-native-muted: #bbb7af;
              --chatone-native-accent: #d37a5d;
              --chatone-native-logo-surface: rgba(45, 45, 42, 0.92);
              --chatone-native-logo-line: rgba(240, 238, 232, 0.10);
              --chatone-native-logo-shadow: rgba(0, 0, 0, 0.30);
              --chatone-native-focus: rgba(211, 122, 93, 0.20);
              color-scheme: dark;
            }
          }

          html.chatone-ios body,
          html.chatone-ios #root {
            width: 100%;
            height: 100%;
            min-height: 100%;
            overflow: hidden;
            background: var(--chatone-native-canvas) !important;
            color: var(--chatone-native-ink);
            -webkit-font-smoothing: antialiased;
            -webkit-tap-highlight-color: transparent;
          }

          html.chatone-ios button,
          html.chatone-ios a,
          html.chatone-ios input,
          html.chatone-ios textarea,
          html.chatone-ios [role='button'] {
            touch-action: manipulation;
          }

          html.chatone-ios input,
          html.chatone-ios textarea,
          html.chatone-ios select {
            font-size: 16px !important;
          }

          html.chatone-ios :focus-visible {
            outline-offset: 2px;
          }

          /* The SwiftUI app bar owns navigation in the iOS container. */
          html.chatone-app .personal-claude-header {
            display: none !important;
          }

          html.chatone-app .personal-claude-sidebar {
            padding-top: 0 !important;
            box-shadow: 16px 0 44px rgba(31, 28, 23, 0.16) !important;
          }

          html.chatone-app .personal-claude-sidebar-header {
            min-height: 54px !important;
            padding-top: 10px !important;
          }

          html.chatone-app .personal-claude-new-chat,
          html.chatone-app .personal-claude-nav-row,
          html.chatone-app .personal-claude-sidebar-body [data-testid='convo-item'] {
            min-height: 44px !important;
            border-radius: 12px !important;
          }

          html.chatone-app .personal-claude-thread .scrollbar-gutter-stable > .flex.flex-col {
            padding-top: 14px !important;
            padding-bottom: 20px !important;
          }

          html.chatone-app .personal-claude-thread .message-render {
            width: calc(100% - 24px) !important;
            max-width: 46rem !important;
            scroll-margin-top: 12px !important;
          }

          html.chatone-app .personal-claude-thread .message-render .agent-turn {
            font-size: 16px !important;
            line-height: 1.68 !important;
          }

          html.chatone-app .personal-claude-thread .message-render .user-turn > .flex {
            max-width: 90% !important;
            border-radius: 18px !important;
            padding: 10px 14px !important;
          }

          html.chatone-app .personal-claude-composer-wrap {
            padding-top: 8px !important;
            background: linear-gradient(to top, var(--pa-canvas) 72%, transparent) !important;
          }

          html.chatone-app .personal-claude-form {
            width: 100% !important;
            padding: 0 10px !important;
          }

          html.chatone-app .personal-claude-form [data-testid='chat-composer'] {
            min-height: 92px !important;
            margin-bottom: max(8px, env(safe-area-inset-bottom)) !important;
            border-radius: 22px !important;
            padding-bottom: 0 !important;
            box-shadow: 0 8px 28px rgba(40, 35, 28, 0.10), 0 1px 2px rgba(40, 35, 28, 0.08) !important;
          }

          html.chatone-app .personal-claude-form [data-testid='text-input'] {
            min-height: 48px !important;
            padding: 13px 15px 6px !important;
            font-size: 16px !important;
            line-height: 1.45 !important;
          }

          html.chatone-app .personal-claude-form [data-testid='chat-composer'] button,
          html.chatone-app .personal-claude-form [data-testid='model-selector-button'] {
            min-width: 40px !important;
            min-height: 40px !important;
            border-radius: 12px !important;
          }

          html.chatone-app .personal-claude-form .chatone-metal-decoration {
            display: none !important;
          }

          html.chatone-app .personal-claude-form .chatone-touch-metal,
          html.chatone-app .personal-claude-form [data-testid='send-button'] {
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
            -webkit-appearance: none;
            appearance: none;
          }

          html.chatone-app .personal-claude-landing {
            padding: 0 20px clamp(36px, 7vh, 62px) !important;
          }

          html.chatone-app .personal-claude-greeting {
            max-width: 20rem !important;
            font-size: clamp(28px, 7.4vw, 35px) !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em !important;
          }

          html.chatone-app [role='dialog'] {
            width: calc(100vw - 20px) !important;
            max-width: 560px !important;
            max-height: calc(100dvh - 24px) !important;
            border-radius: 24px !important;
          }

          html.chatone-app [role='menu'],
          html.chatone-app [role='listbox'] {
            max-width: calc(100vw - 16px) !important;
            border-radius: 16px !important;
          }

          html.chatone-app [role='menuitem'],
          html.chatone-app [role='option'] {
            min-height: 44px !important;
          }

          /* A purpose-built sign-in surface instead of the desktop auth page. */
          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col {
            min-height: 100dvh !important;
            justify-content: flex-start !important;
            background:
              radial-gradient(circle at 50% -10%, rgba(185, 95, 66, 0.13), transparent 34%),
              var(--chatone-native-canvas) !important;
          }

          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > .mt-6.h-10,
          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > .absolute.bottom-0,
          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > footer {
            display: none !important;
          }

          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > main {
            flex: 0 1 auto !important;
            width: 100% !important;
            align-items: flex-start !important;
            padding: clamp(48px, 9vh, 88px) 20px 32px !important;
          }

          html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > main > div {
            width: 100% !important;
            max-width: 430px !important;
            margin: 0 auto !important;
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding: 0 8px !important;
            box-shadow: none !important;
          }

          html.chatone-auth main h1 {
            margin: 0 0 32px !important;
            color: var(--chatone-native-ink) !important;
            text-align: left !important;
            font-size: 34px !important;
            font-weight: 680 !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em !important;
          }

          html.chatone-auth main h1::before {
            display: block;
            width: 58px;
            height: 58px;
            margin-bottom: 26px;
            border-radius: 17px;
            background: var(--chatone-native-logo-surface) url('data:image/png;base64,\(brandLogoBase64)') center / 48px 48px no-repeat;
            box-shadow: inset 0 0 0 1px var(--chatone-native-logo-line), 0 10px 28px var(--chatone-native-logo-shadow);
            content: '';
          }

          html.chatone-auth main h1::after {
            display: block;
            margin-top: 10px;
            color: var(--chatone-native-muted);
            content: '继续你的 ChatOne 对话';
            font-size: 16px;
            font-weight: 430;
            letter-spacing: 0;
            line-height: 1.45;
          }

          html.chatone-auth main form {
            margin-top: 0 !important;
          }

          html.chatone-auth main form > div {
            margin-bottom: 16px !important;
          }

          html.chatone-auth main input {
            height: 56px !important;
            border: 1px solid var(--chatone-native-line) !important;
            border-radius: 16px !important;
            background: var(--chatone-native-surface) !important;
            padding-inline: 16px !important;
            color: var(--chatone-native-ink) !important;
            font-size: 17px !important;
            box-shadow: 0 1px 1px rgba(40, 36, 30, 0.03) !important;
          }

          html.chatone-auth main input:focus {
            border-color: var(--chatone-native-accent) !important;
            box-shadow: 0 0 0 3px var(--chatone-native-focus) !important;
          }

          html.chatone-auth main label {
            background: transparent !important;
            color: var(--chatone-native-muted) !important;
          }

          html.chatone-auth main input.peer ~ label {
            top: 50% !important;
            inset-inline-start: 16px !important;
            padding: 0 !important;
            font-size: 17px !important;
            line-height: 18px !important;
            transform: translateY(-50%) !important;
            pointer-events: none;
          }

          html.chatone-auth main input.peer:focus ~ label,
          html.chatone-auth main input.peer:not(:placeholder-shown) ~ label {
            top: 7px !important;
            font-size: 12px !important;
            line-height: 14px !important;
            transform: none !important;
          }

          html.chatone-auth main input.peer:focus,
          html.chatone-auth main input.peer:not(:placeholder-shown) {
            padding-top: 23px !important;
            padding-bottom: 5px !important;
            line-height: 22px !important;
          }

          html.chatone-auth main input.peer[name='password'] {
            padding-inline-end: 48px !important;
          }

          html.chatone-auth main [data-testid='login-button'] {
            height: 56px !important;
            border: 0 !important;
            border-radius: 16px !important;
            background: var(--chatone-native-accent) !important;
            color: white !important;
            font-size: 17px !important;
            font-weight: 650 !important;
            box-shadow: 0 8px 20px rgba(142, 66, 43, 0.20) !important;
          }

          html.chatone-auth main [data-testid='login-button']:active {
            transform: scale(0.985);
            opacity: 0.92;
          }

          @media (max-height: 700px) {
            html.chatone-auth #root > .relative.flex.min-h-screen.flex-col > main {
              padding-top: 28px !important;
            }

            html.chatone-auth main h1 {
              margin-bottom: 22px !important;
            }

            html.chatone-auth main h1::before {
              width: 48px;
              height: 48px;
              margin-bottom: 18px;
              border-radius: 14px;
              background-size: 32px 32px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            html.chatone-ios *,
            html.chatone-ios *::before,
            html.chatone-ios *::after {
              scroll-behavior: auto !important;
              transition-duration: 0.01ms !important;
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
            }
          }
        `;
        root.appendChild(style);

        const installAppSettings = () => {
          const sidebar = document.querySelector('.chatone-settings [role="tablist"]');
          if (!sidebar || sidebar.parentElement.querySelector('[data-chatone-app-settings]')) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.chatoneAppSettings = 'true';
          button.className = 'flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
          button.textContent = '应用配置';
          button.addEventListener('click', () => {
            window.webkit?.messageHandlers?.chatOneNative?.postMessage({ type: 'settings' });
          });
          sidebar.after(button);
        };
        const settingsObserver = new MutationObserver(installAppSettings);
        settingsObserver.observe(root, { childList: true, subtree: true });
        installAppSettings();

        const updateRoute = () => {
          const path = window.location.pathname || '/';
          const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
          const isAuth = authRoutes.some((route) =>
            path === route || path.endsWith(route) || path.includes(route + '/')
          );
          root.classList.toggle('chatone-auth', isAuth);
          root.classList.toggle('chatone-app', !isAuth);
          window.webkit?.messageHandlers?.chatOneNative?.postMessage({
            type: 'route',
            path,
            isAuth,
          });
        };

        const wrapHistory = (name) => {
          const original = history[name];
          history[name] = function () {
            const result = original.apply(this, arguments);
            queueMicrotask(updateRoute);
            return result;
          };
        };

        wrapHistory('pushState');
        wrapHistory('replaceState');
        window.addEventListener('popstate', updateRoute);
        window.addEventListener('hashchange', updateRoute);
        document.addEventListener('DOMContentLoaded', updateRoute, { once: true });
        updateRoute();
      })();
      """

  func updateUIView(_ webView: WKWebView, context: Context) {
    Self.applyAppearance(colorScheme, to: webView)
    guard context.coordinator.serverURL != serverURL else { return }
    context.coordinator.serverURL = serverURL
    context.coordinator.restoreSessionAndLoad(webView)
  }

  private static func applyAppearance(_ colorScheme: ColorScheme, to webView: WKWebView) {
    let isDark = colorScheme == .dark
    let background = UIColor(rgb: isDark ? 0x272724 : 0xFAF9F6)
    webView.overrideUserInterfaceStyle = isDark ? .dark : .light
    webView.backgroundColor = background
    webView.scrollView.backgroundColor = background
  }

  static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
    webView.stopLoading()
    webView.navigationDelegate = nil
    webView.uiDelegate = nil
    webView.configuration.websiteDataStore.httpCookieStore.remove(coordinator)
    coordinator.state.reloadAction = nil
    coordinator.state.goBackAction = nil
    coordinator.state.goForwardAction = nil
    coordinator.state.openSidebarAction = nil
    coordinator.state.newChatAction = nil
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "chatOneNative")
  }

  @MainActor
  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler,
    WKHTTPCookieStoreObserver
  {
    var serverURL: URL
    let state: WebViewState
    weak var webView: WKWebView?
    private var downloadDestinations: [ObjectIdentifier: URL] = [:]
    private var isObservingCookies = false

    init(serverURL: URL, state: WebViewState) {
      self.serverURL = serverURL
      self.state = state
    }

    func restoreSessionAndLoad(_ webView: WKWebView) {
      let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
      if isObservingCookies {
        cookieStore.remove(self)
        isObservingCookies = false
      }

      let savedCookies = SessionCookieVault.load(for: serverURL)
      Task { @MainActor [weak self, weak webView] in
        guard let self, let webView else { return }
        var cookies = savedCookies
        #if DEBUG && targetEnvironment(simulator)
        do {
          if let previewCookies = try await SimulatorPreviewLogin.cookies(for: self.serverURL) {
            cookies = previewCookies
            SessionCookieVault.save(previewCookies, for: self.serverURL)
          }
        } catch {
          self.state.isLoading = false
          self.state.errorMessage = error.localizedDescription
          return
        }
        #endif
        for cookie in cookies {
          await cookieStore.setCookie(cookie)
        }
        cookieStore.add(self)
        self.isObservingCookies = true
        webView.load(URLRequest(url: self.serverURL))
      }
    }

    func cookiesDidChange(in cookieStore: WKHTTPCookieStore) {
      persistSessionCookies(from: cookieStore)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
      state.isLoading = true
      state.errorMessage = nil
      updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
      state.isLoading = false
      state.errorMessage = nil
      webView.scrollView.refreshControl?.endRefreshing()
      persistSessionCookies(from: webView.configuration.websiteDataStore.httpCookieStore)
      updateNavigationState(webView)
    }

    func webView(
      _ webView: WKWebView,
      didFailProvisionalNavigation navigation: WKNavigation?,
      withError error: Error
    ) {
      finishWithError(error, webView: webView)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
      finishWithError(error, webView: webView)
    }

    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let url = navigationAction.request.url else {
        decisionHandler(.cancel)
        return
      }

      if navigationAction.targetFrame == nil, isSameServer(url) {
        webView.load(navigationAction.request)
        decisionHandler(.cancel)
        return
      }

      if navigationAction.navigationType == .linkActivated, !isSameServer(url) {
        if isWebURL(url) {
          UIApplication.shared.open(url)
          decisionHandler(.cancel)
        } else {
          decisionHandler(.allow)
        }
        return
      }

      decisionHandler(.allow)
    }

    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationResponse: WKNavigationResponse,
      decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
      if !navigationResponse.canShowMIMEType {
        decisionHandler(.download)
      } else {
        decisionHandler(.allow)
      }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
      download.delegate = self
    }

    func webView(
      _ webView: WKWebView,
      navigationResponse: WKNavigationResponse,
      didBecome download: WKDownload
    ) {
      download.delegate = self
    }

    func webView(
      _ webView: WKWebView,
      createWebViewWith configuration: WKWebViewConfiguration,
      for navigationAction: WKNavigationAction,
      windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
      guard let url = navigationAction.request.url else { return nil }
      if isSameServer(url) {
        webView.load(navigationAction.request)
      } else if isWebURL(url) {
        UIApplication.shared.open(url)
      }
      return nil
    }

    private func finishWithError(_ error: Error, webView: WKWebView) {
      state.isLoading = false
      webView.scrollView.refreshControl?.endRefreshing()

      let nsError = error as NSError
      if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled { return }
      state.errorMessage = "请确认 LibreChat 正在运行，并检查手机与服务器的网络连接。\n\(error.localizedDescription)"
    }

    private func updateNavigationState(_ webView: WKWebView) {
      state.canGoBack = webView.canGoBack
      state.canGoForward = webView.canGoForward
    }

    private func persistSessionCookies(from cookieStore: WKHTTPCookieStore) {
      guard isObservingCookies else { return }
      cookieStore.getAllCookies { [weak self] cookies in
        guard let self else { return }
        SessionCookieVault.save(cookies, for: self.serverURL)
      }
    }

    func userContentController(
      _ userContentController: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      guard
        message.name == "chatOneNative",
        message.frameInfo.isMainFrame,
        let messageURL = message.frameInfo.request.url,
        messageURL.scheme == serverURL.scheme,
        messageURL.host == serverURL.host,
        messageURL.port == serverURL.port,
        let payload = message.body as? [String: Any]
      else { return }

      if payload["type"] as? String == "settings" {
        state.isShowingAppSettings = true
        return
      }
      guard payload["type"] as? String == "route" else { return }
      state.routePath = payload["path"] as? String ?? "/"
      state.isAuthPage = payload["isAuth"] as? Bool ?? false
    }

    private func presentShareSheet(for fileURL: URL) {
      guard
        let scene = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first(where: { $0.activationState == .foregroundActive }),
        let rootController = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
      else { return }

      var presenter = rootController
      while let presented = presenter.presentedViewController {
        presenter = presented
      }

      let shareController = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
      if let popover = shareController.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(
          x: presenter.view.bounds.midX,
          y: presenter.view.bounds.midY,
          width: 1,
          height: 1
        )
      }
      presenter.present(shareController, animated: true)
    }

    private func isSameServer(_ url: URL) -> Bool {
      url.scheme?.lowercased() == serverURL.scheme?.lowercased()
        && url.host?.lowercased() == serverURL.host?.lowercased()
        && effectivePort(url) == effectivePort(serverURL)
    }

    private func isWebURL(_ url: URL) -> Bool {
      let scheme = url.scheme?.lowercased()
      return scheme == "http" || scheme == "https"
    }

    private func effectivePort(_ url: URL) -> Int? {
      if let port = url.port { return port }
      if url.scheme?.lowercased() == "https" { return 443 }
      if url.scheme?.lowercased() == "http" { return 80 }
      return nil
    }
  }
}

extension ChatWebView.Coordinator: WKDownloadDelegate {
  func download(
    _ download: WKDownload,
    decideDestinationUsing response: URLResponse,
    suggestedFilename: String,
    completionHandler: @escaping (URL?) -> Void
  ) {
    let safeName = suggestedFilename.replacingOccurrences(of: "/", with: "-")
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString, isDirectory: true)

    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let destination = directory.appendingPathComponent(safeName.isEmpty ? "download" : safeName)
      downloadDestinations[ObjectIdentifier(download)] = destination
      completionHandler(destination)
    } catch {
      completionHandler(nil)
    }
  }

  func downloadDidFinish(_ download: WKDownload) {
    let identifier = ObjectIdentifier(download)
    guard let destination = downloadDestinations.removeValue(forKey: identifier) else { return }
    presentShareSheet(for: destination)
  }

  func download(
    _ download: WKDownload,
    didFailWithError error: Error,
    resumeData: Data?
  ) {
    downloadDestinations.removeValue(forKey: ObjectIdentifier(download))
    state.errorMessage = "文件下载失败：\(error.localizedDescription)"
  }
}
