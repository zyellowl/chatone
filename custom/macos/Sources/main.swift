import AppKit
import Foundation
import WebKit

private enum AppConstants {
  static let appName = "ChatOne"
  static let defaultServerURL = URL(string: "http://127.0.0.1:3080/")!
  static let healthPath = "api/config"
}

private enum ServiceError: LocalizedError {
  case dockerUnavailable
  case composeFailed
  case serverTimedOut

  var errorDescription: String? {
    switch self {
    case .dockerUnavailable:
      return "无法连接 Docker Desktop，请确认已经安装并可以正常启动。"
    case .composeFailed:
      return "找不到已安装的 ChatOne 服务，请先完成一次 Docker 初始化。"
    case .serverTimedOut:
      return "本地 AI 服务启动时间过长，请稍后重试。"
    }
  }
}

private final class LauncherLog {
  private let url: URL

  init() {
    let logsDirectory = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("Logs/ChatOne", isDirectory: true)
    try? FileManager.default.createDirectory(
      at: logsDirectory,
      withIntermediateDirectories: true
    )
    url = logsDirectory.appendingPathComponent("launcher.log")
  }

  func append(_ message: String) {
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let line = "[\(timestamp)] \(message)\n"
    guard let data = line.data(using: .utf8) else { return }

    if !FileManager.default.fileExists(atPath: url.path) {
      FileManager.default.createFile(atPath: url.path, contents: data)
      return
    }

    guard let handle = try? FileHandle(forWritingTo: url) else { return }
    defer { try? handle.close() }
    _ = try? handle.seekToEnd()
    try? handle.write(contentsOf: data)
  }
}

private final class ServiceController {
  let serverURL: URL

  private let log = LauncherLog()
  private let session: URLSession

  init() {
    serverURL = AppConstants.defaultServerURL
    session = URLSession(configuration: .ephemeral)
  }

  func ensureRunning(status: @escaping (String) -> Void, completion: @escaping (Result<Void, Error>) -> Void) {
    ensureLibreChatRunning(status: status, completion: completion)
  }

  private func ensureLibreChatRunning(
    status: @escaping (String) -> Void,
    completion: @escaping (Result<Void, Error>) -> Void
  ) {
    checkHealth { [weak self] isHealthy in
      guard let self else { return }
      if isHealthy {
        completion(.success(()))
        return
      }

      status("正在启动本地 AI 服务…")
      DispatchQueue.global(qos: .userInitiated).async {
        let result = self.startService(status: status)
        DispatchQueue.main.async {
          completion(result)
        }
      }
    }
  }

  func checkHealth(completion: @escaping (Bool) -> Void) {
    let healthURL = serverURL.appendingPathComponent(AppConstants.healthPath)
    var request = URLRequest(url: healthURL)
    request.timeoutInterval = 3
    request.cachePolicy = .reloadIgnoringLocalCacheData

    session.dataTask(with: request) { _, response, _ in
      let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
      DispatchQueue.main.async {
        completion((200..<500).contains(statusCode))
      }
    }.resume()
  }

  private func startService(status: @escaping (String) -> Void) -> Result<Void, Error> {
    guard let docker = dockerExecutable() else {
      log.append("Docker executable was not found")
      return .failure(ServiceError.dockerUnavailable)
    }

    if !ensureDockerReady(docker, status: status) {
      log.append("Docker did not become ready before timeout")
      return .failure(ServiceError.dockerUnavailable)
    }

    DispatchQueue.main.async { status("正在启动 ChatOne…") }
    let startExitCode = run(
      docker,
      arguments: ["start", "chat-mongodb", "chat-meilisearch", "ChatOne"],
      timeout: 30
    )
    guard startExitCode == 0 else {
      log.append("docker start exited with status \(startExitCode)")
      return .failure(ServiceError.composeFailed)
    }

    let serverReady = waitUntil(timeout: 90) {
      self.synchronousHealthCheck()
    }
    if !serverReady {
      log.append("Server health check timed out")
      return .failure(ServiceError.serverTimedOut)
    }

    log.append("ChatOne service is ready")
    return .success(())
  }

  /// Docker Desktop can leave its port proxy running while the engine itself
  /// stops answering. Opening the already-running app does not repair that
  /// state, so try a normal launch first and then perform one clean relaunch.
  private func ensureDockerReady(
    _ docker: URL,
    status: @escaping (String) -> Void
  ) -> Bool {
    if run(docker, arguments: ["info"], timeout: 8) == 0 {
      return true
    }

    log.append("Docker is not ready; asking Docker Desktop to launch")
    DispatchQueue.main.async { status("正在等待 Docker Desktop…") }
    _ = run(
      URL(fileURLWithPath: "/usr/bin/open"),
      arguments: ["-gja", "Docker"],
      timeout: 8
    )

    if waitUntil(timeout: 20, condition: { self.dockerIsReady(docker) }) {
      return true
    }

    log.append("Docker engine stayed unresponsive; relaunching Docker Desktop")
    DispatchQueue.main.async { status("正在恢复 Docker Desktop…") }
    _ = run(
      URL(fileURLWithPath: "/usr/bin/osascript"),
      arguments: ["-e", "tell application \"Docker\" to quit"],
      timeout: 12
    )
    Thread.sleep(forTimeInterval: 2)
    _ = run(
      URL(fileURLWithPath: "/usr/bin/open"),
      arguments: ["-gja", "Docker"],
      timeout: 8
    )

    return waitUntil(timeout: 75, condition: { self.dockerIsReady(docker) })
  }

  private func dockerIsReady(_ docker: URL) -> Bool {
    run(docker, arguments: ["info"], timeout: 4) == 0
  }

  private func synchronousHealthCheck() -> Bool {
    let semaphore = DispatchSemaphore(value: 0)
    var isHealthy = false
    checkHealth {
      isHealthy = $0
      semaphore.signal()
    }
    _ = semaphore.wait(timeout: .now() + 4)
    return isHealthy
  }

  private func waitUntil(timeout: TimeInterval, condition: () -> Bool) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if condition() { return true }
      Thread.sleep(forTimeInterval: 1.5)
    }
    return false
  }

  private func dockerExecutable() -> URL? {
    let candidates = [
      "/usr/local/bin/docker",
      "/opt/homebrew/bin/docker",
      "/Applications/Docker.app/Contents/Resources/bin/docker",
    ]
    return candidates
      .first(where: { FileManager.default.isExecutableFile(atPath: $0) })
      .map { URL(fileURLWithPath: $0) }
  }

  @discardableResult
  private func run(
    _ executable: URL,
    arguments: [String],
    currentDirectory: URL? = nil,
    timeout: TimeInterval = 15
  ) -> Int32 {
    let process = Process()
    let output = Pipe()
    process.executableURL = executable
    process.arguments = arguments
    process.currentDirectoryURL = currentDirectory
    process.standardOutput = output
    process.standardError = output

    var environment = ProcessInfo.processInfo.environment
    environment["PATH"] = [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/Applications/Docker.app/Contents/Resources/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ].joined(separator: ":")
    process.environment = environment

    do {
      try process.run()
      let deadline = Date().addingTimeInterval(timeout)
      while process.isRunning && Date() < deadline {
        Thread.sleep(forTimeInterval: 0.1)
      }

      if process.isRunning {
        log.append(
          "Command timed out after \(Int(timeout))s: \(executable.path) \(arguments.joined(separator: " "))"
        )
        process.terminate()
        let terminationDeadline = Date().addingTimeInterval(2)
        while process.isRunning && Date() < terminationDeadline {
          Thread.sleep(forTimeInterval: 0.05)
        }
        if process.isRunning {
          kill(process.processIdentifier, SIGKILL)
        }
        process.waitUntilExit()
        return 124
      }

      process.waitUntilExit()
      let data = output.fileHandleForReading.readDataToEndOfFile()
      if let rendered = String(data: data, encoding: .utf8), !rendered.isEmpty {
        log.append(rendered.trimmingCharacters(in: .whitespacesAndNewlines))
      }
      return process.terminationStatus
    } catch {
      log.append("Command failed: \(error.localizedDescription)")
      return -1
    }
  }
}

private final class StatusView: NSView {
  private let spinner = NSProgressIndicator()
  private let titleLabel = NSTextField(labelWithString: AppConstants.appName)
  private let statusLabel = NSTextField(labelWithString: "正在连接本地服务…")
  private let retryButton = NSButton(title: "重试", target: nil, action: nil)

  var onRetry: (() -> Void)?

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true

    spinner.style = .spinning
    spinner.controlSize = .regular
    spinner.startAnimation(nil)

    titleLabel.font = .systemFont(ofSize: 24, weight: .semibold)
    titleLabel.alignment = .center
    titleLabel.textColor = .labelColor

    statusLabel.font = .systemFont(ofSize: 13, weight: .regular)
    statusLabel.alignment = .center
    statusLabel.textColor = .secondaryLabelColor
    statusLabel.maximumNumberOfLines = 3
    statusLabel.lineBreakMode = .byWordWrapping

    retryButton.bezelStyle = .rounded
    retryButton.target = self
    retryButton.action = #selector(retry)
    retryButton.isHidden = true

    let stack = NSStackView(views: [spinner, titleLabel, statusLabel, retryButton])
    stack.orientation = .vertical
    stack.alignment = .centerX
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -20),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32),
      statusLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 430),
    ])
  }

  required init?(coder: NSCoder) {
    nil
  }

  func setStatus(_ text: String) {
    spinner.isHidden = false
    spinner.startAnimation(nil)
    retryButton.isHidden = true
    statusLabel.stringValue = text
  }

  func setError(_ text: String) {
    spinner.stopAnimation(nil)
    spinner.isHidden = true
    retryButton.isHidden = false
    statusLabel.stringValue = text
  }

  @objc private func retry() {
    onRetry?()
  }
}

private final class MainWindowController: NSWindowController, WKNavigationDelegate, WKUIDelegate {
  private let serviceController = ServiceController()
  private let statusView = StatusView()
  private let webView: WKWebView
  private var healthTimer: Timer?
  private var consecutiveHealthFailures = 0
  private var isRecoveringService = false
  private var reconnectURL: URL?

  init() {
    let webConfiguration = WKWebViewConfiguration()
    webConfiguration.websiteDataStore = .default()
    webConfiguration.preferences.isElementFullscreenEnabled = true
    webConfiguration.applicationNameForUserAgent = "ChatOne-macOS/1.1"
    webView = WKWebView(frame: .zero, configuration: webConfiguration)

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 840),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = AppConstants.appName
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.minSize = NSSize(width: 880, height: 640)
    window.center()
    window.isReleasedWhenClosed = false

    super.init(window: window)

    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsMagnification = true
    webView.translatesAutoresizingMaskIntoConstraints = false
    webView.isHidden = true

    statusView.translatesAutoresizingMaskIntoConstraints = false
    statusView.onRetry = { [weak self] in self?.connect() }

    guard let contentView = window.contentView else { return }
    contentView.addSubview(webView)
    contentView.addSubview(statusView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      webView.topAnchor.constraint(equalTo: contentView.topAnchor),
      webView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      statusView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      statusView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      statusView.topAnchor.constraint(equalTo: contentView.topAnchor),
      statusView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
    ])

    startHealthMonitor()
  }

  required init?(coder: NSCoder) {
    nil
  }

  deinit {
    healthTimer?.invalidate()
  }

  func connect() {
    guard !isRecoveringService else { return }
    isRecoveringService = true
    if let currentURL = webView.url {
      reconnectURL = currentURL
    }
    statusView.isHidden = false
    statusView.setStatus("正在连接本地服务…")
    webView.isHidden = true

    // The native wrapper does not need the web PWA's offline service worker.
    // Clear only rebuildable caches so app updates appear immediately while
    // keeping cookies, local storage, and the signed-in LibreChat session.
    let cacheTypes: Set<String> = [
      WKWebsiteDataTypeDiskCache,
      WKWebsiteDataTypeMemoryCache,
      WKWebsiteDataTypeServiceWorkerRegistrations,
    ]
    webView.configuration.websiteDataStore.removeData(
      ofTypes: cacheTypes,
      modifiedSince: .distantPast
    ) { [weak self] in
      self?.connectAfterCacheReset()
    }
  }

  private func connectAfterCacheReset() {
    serviceController.ensureRunning(
      status: { [weak self] status in
        DispatchQueue.main.async { self?.statusView.setStatus(status) }
      },
      completion: { [weak self] result in
        guard let self else { return }
        self.isRecoveringService = false
        switch result {
        case .success:
          self.consecutiveHealthFailures = 0
          let destination = self.reconnectURL ?? self.serviceController.serverURL
          self.reconnectURL = nil
          self.webView.load(self.freshRequest(for: destination))
        case .failure(let error):
          self.statusView.setError(error.localizedDescription)
        }
      }
    )
  }

  func reload() {
    connect()
  }

  private func startHealthMonitor() {
    healthTimer?.invalidate()
    healthTimer = Timer.scheduledTimer(withTimeInterval: 12, repeats: true) { [weak self] _ in
      self?.checkBackgroundHealth()
    }
  }

  private func checkBackgroundHealth() {
    guard !isRecoveringService else { return }
    serviceController.checkHealth { [weak self] isHealthy in
      guard let self else { return }
      if isHealthy {
        self.consecutiveHealthFailures = 0
        return
      }

      self.consecutiveHealthFailures += 1
      if self.consecutiveHealthFailures >= 2 {
        self.connect()
      }
    }
  }

  func openNewChat() {
    let url = serviceController.serverURL.appendingPathComponent("c/new")
    webView.load(freshRequest(for: url))
  }

  /// Navigation requests bypass HTTP/PWA caches while cookies, local storage,
  /// and the authenticated LibreChat session remain in the default data store.
  private func freshRequest(for url: URL) -> URLRequest {
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    var queryItems = components?.queryItems ?? []
    queryItems.removeAll { $0.name == "chatone_refresh" }
    queryItems.append(
      URLQueryItem(name: "chatone_refresh", value: String(Int(Date().timeIntervalSince1970)))
    )
    components?.queryItems = queryItems

    var request = URLRequest(
      url: components?.url ?? url,
      cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
      timeoutInterval: 30
    )
    request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
    request.setValue("no-cache", forHTTPHeaderField: "Pragma")
    return request
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    statusView.isHidden = true
    webView.isHidden = false
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    statusView.isHidden = false
    statusView.setError("页面连接中断，请检查本地服务后重试。")
    webView.isHidden = true
    serviceController.checkHealth { [weak self] isHealthy in
      if !isHealthy {
        self?.connect()
      }
    }
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

    let localHosts = Set(["127.0.0.1", "localhost"])
    if let host = url.host, !localHosts.contains(host) {
      NSWorkspace.shared.open(url)
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    guard let url = navigationAction.request.url else { return nil }
    NSWorkspace.shared.open(url)
    return nil
  }
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
  private var mainWindowController: MainWindowController?

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenus()
    let controller = MainWindowController()
    mainWindowController = controller
    controller.showWindow(nil)
    controller.window?.makeKeyAndOrderFront(nil)
    controller.connect()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  @objc private func reload() {
    mainWindowController?.reload()
  }

  @objc private func newChat() {
    mainWindowController?.openNewChat()
  }

  private func configureMenus() {
    let mainMenu = NSMenu()

    let appMenuItem = NSMenuItem()
    let appMenu = NSMenu()
    appMenu.addItem(
      withTitle: "关于 \(AppConstants.appName)",
      action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
      keyEquivalent: ""
    )
    appMenu.addItem(.separator())
    appMenu.addItem(
      withTitle: "退出 \(AppConstants.appName)",
      action: #selector(NSApplication.terminate(_:)),
      keyEquivalent: "q"
    )
    appMenuItem.submenu = appMenu
    mainMenu.addItem(appMenuItem)

    let fileMenuItem = NSMenuItem()
    let fileMenu = NSMenu(title: "文件")
    let newChatItem = NSMenuItem(title: "新建对话", action: #selector(newChat), keyEquivalent: "n")
    newChatItem.target = self
    fileMenu.addItem(newChatItem)
    fileMenuItem.submenu = fileMenu
    mainMenu.addItem(fileMenuItem)

    let editMenuItem = NSMenuItem()
    let editMenu = NSMenu(title: "编辑")
    editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
    editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
    editMenu.addItem(.separator())
    editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editMenuItem.submenu = editMenu
    mainMenu.addItem(editMenuItem)

    let viewMenuItem = NSMenuItem()
    let viewMenu = NSMenu(title: "显示")
    let reloadItem = NSMenuItem(title: "重新载入", action: #selector(reload), keyEquivalent: "r")
    reloadItem.target = self
    viewMenu.addItem(reloadItem)
    viewMenu.addItem(.separator())
    viewMenu.addItem(
      withTitle: "进入全屏幕",
      action: #selector(NSWindow.toggleFullScreen(_:)),
      keyEquivalent: "f"
    ).keyEquivalentModifierMask = [.control, .command]
    viewMenuItem.submenu = viewMenu
    mainMenu.addItem(viewMenuItem)

    NSApplication.shared.mainMenu = mainMenu
  }
}

private let application = NSApplication.shared
private let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.activate(ignoringOtherApps: true)
application.run()
