import Foundation
import Security

#if DEBUG && targetEnvironment(simulator)
enum SimulatorPreviewLogin {
  static func cookies(for serverURL: URL) async throws -> [HTTPCookie]? {
    let environment = ProcessInfo.processInfo.environment
    let email = environment["CHATONE_PREVIEW_EMAIL"] ?? ""
    let password = environment["CHATONE_PREVIEW_PASSWORD"] ?? ""
    guard !email.isEmpty || !password.isEmpty else { return nil }
    guard
      !email.isEmpty, !password.isEmpty,
      ["http", "https"].contains(serverURL.scheme?.lowercased() ?? ""),
      ["127.0.0.1", "localhost", "[::1]", "::1"].contains(serverURL.host?.lowercased() ?? "")
    else { throw PreviewError.invalidConfiguration }

    let loginURL = serverURL.appendingPathComponent("api/auth/login")
    var request = URLRequest(url: loginURL)
    request.httpMethod = "POST"
    request.timeoutInterval = 20
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])

    let session = URLSession(
      configuration: .ephemeral, delegate: LocalLoginDelegate(), delegateQueue: nil
    )
    defer { session.finishTasksAndInvalidate() }
    let (_, response) = try await session.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      throw PreviewError.loginFailed
    }
    let cookies = session.configuration.httpCookieStorage?.cookies(for: loginURL) ?? []
    guard cookies.contains(where: { $0.name == "refreshToken" && !$0.value.isEmpty }) else {
      throw PreviewError.loginFailed
    }
    return cookies
  }

  private enum PreviewError: LocalizedError {
    case invalidConfiguration
    case loginFailed

    var errorDescription: String? {
      switch self {
      case .invalidConfiguration:
        return "模拟器预览需要本机服务器和完整的预览账号。"
      case .loginFailed:
        return "预览账号登录失败，请检查账号或使用普通登录。"
      }
    }
  }

  private final class LocalLoginDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
      _ session: URLSession, task: URLSessionTask,
      willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
      completionHandler: @escaping (URLRequest?) -> Void
    ) {
      completionHandler(nil)
    }
  }
}
#endif

enum SessionCookieVault {
  private static let service = "com.wsejoy.chatone.session-cookies"
  private static let authenticationCookieNames: Set<String> = [
    "refreshToken",
    "token_provider",
    "connect.sid",
    "openid_user_id",
    "openid_access_token",
    "openid_id_token",
  ]

  static func load(for serverURL: URL) -> [HTTPCookie] {
    guard let account = account(for: serverURL) else { return [] }
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne,
    ]

    var result: CFTypeRef?
    guard
      SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data,
      let storedCookies = try? JSONDecoder().decode([StoredCookie].self, from: data)
    else { return [] }

    let now = Date()
    return storedCookies.compactMap { stored in
      guard stored.expiresDate.map({ $0 > now }) ?? true else { return nil }
      return stored.cookie
    }
  }

  static func save(_ cookies: [HTTPCookie], for serverURL: URL) {
    guard let account = account(for: serverURL), let host = serverURL.host?.lowercased() else { return }
    let matchingCookies = cookies
      .filter { authenticationCookieNames.contains($0.name) && $0.matches(host: host) }
    guard matchingCookies.contains(where: { $0.name == "refreshToken" }) else {
      clear(for: serverURL)
      return
    }
    let storedCookies = matchingCookies
      .map(StoredCookie.init)

    guard let data = try? JSONEncoder().encode(storedCookies) else { return }
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
    ]
    let update: [CFString: Any] = [kSecValueData: data]

    if SecItemUpdate(query as CFDictionary, update as CFDictionary) == errSecItemNotFound {
      var item = query
      item[kSecValueData] = data
      item[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      SecItemAdd(item as CFDictionary, nil)
    }
  }

  static func clear(for serverURL: URL) {
    guard let account = account(for: serverURL) else { return }
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
    ]
    SecItemDelete(query as CFDictionary)
  }

  private static func account(for serverURL: URL) -> String? {
    guard let scheme = serverURL.scheme?.lowercased(), let host = serverURL.host?.lowercased() else {
      return nil
    }
    let port = serverURL.port.map { ":\($0)" } ?? ""
    return "\(scheme)://\(host)\(port)"
  }
}

private struct StoredCookie: Codable {
  let name: String
  let value: String
  let domain: String
  let path: String
  let expiresDate: Date?
  let isSecure: Bool
  let isHTTPOnly: Bool
  let sameSite: String?

  init(_ cookie: HTTPCookie) {
    name = cookie.name
    value = cookie.value
    domain = cookie.domain
    path = cookie.path
    expiresDate = cookie.expiresDate
    isSecure = cookie.isSecure
    isHTTPOnly = cookie.isHTTPOnly
    sameSite = cookie.properties?[HTTPCookiePropertyKey("SameSite")] as? String
  }

  var cookie: HTTPCookie? {
    var properties: [HTTPCookiePropertyKey: Any] = [
      .name: name,
      .value: value,
      .domain: domain,
      .path: path,
    ]
    if let expiresDate {
      properties[.expires] = expiresDate
    }
    if isSecure {
      properties[.secure] = "TRUE"
    }
    if isHTTPOnly {
      properties[HTTPCookiePropertyKey("HttpOnly")] = "TRUE"
    }
    if let sameSite {
      properties[HTTPCookiePropertyKey("SameSite")] = sameSite
    }
    return HTTPCookie(properties: properties)
  }
}

private extension HTTPCookie {
  func matches(host: String) -> Bool {
    let cookieDomain = domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
    return host == cookieDomain || host.hasSuffix(".\(cookieDomain)")
  }
}
