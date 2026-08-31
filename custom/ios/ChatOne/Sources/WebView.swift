import SwiftUI
import UIKit
import WebKit

@MainActor
final class WebViewState: ObservableObject {
  @Published var isLoading = true
  @Published var errorMessage: String?
  @Published var canGoBack = false
  @Published var canGoForward = false

  fileprivate var reloadAction: (() -> Void)?
  fileprivate var goBackAction: (() -> Void)?
  fileprivate var goForwardAction: (() -> Void)?

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
}

struct ChatWebView: UIViewRepresentable {
  let serverURL: URL
  @ObservedObject var state: WebViewState

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
      source: "document.documentElement.classList.add('chatone-ios')",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(appModeScript)

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = true
    webView.allowsLinkPreview = false
    webView.isOpaque = false
    webView.backgroundColor = UIColor(red: 0.97, green: 0.96, blue: 0.93, alpha: 1)
    webView.scrollView.backgroundColor = webView.backgroundColor
    webView.scrollView.keyboardDismissMode = .interactive
    webView.scrollView.contentInsetAdjustmentBehavior = .never

    let refreshControl = UIRefreshControl()
    refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.refresh), for: .valueChanged)
    webView.scrollView.refreshControl = refreshControl

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
    webView.load(URLRequest(url: serverURL))
    return webView
  }

  func updateUIView(_ webView: WKWebView, context: Context) {
    guard context.coordinator.serverURL != serverURL else { return }
    context.coordinator.serverURL = serverURL
    webView.load(URLRequest(url: serverURL))
  }

  static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
    webView.stopLoading()
    webView.navigationDelegate = nil
    webView.uiDelegate = nil
    coordinator.state.reloadAction = nil
    coordinator.state.goBackAction = nil
    coordinator.state.goForwardAction = nil
  }

  @MainActor
  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    var serverURL: URL
    let state: WebViewState
    weak var webView: WKWebView?
    private var downloadDestinations: [ObjectIdentifier: URL] = [:]

    init(serverURL: URL, state: WebViewState) {
      self.serverURL = serverURL
      self.state = state
    }

    @objc func refresh(_ sender: UIRefreshControl) {
      webView?.reload()
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
