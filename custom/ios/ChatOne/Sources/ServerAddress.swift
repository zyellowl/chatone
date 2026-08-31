import Foundation

enum ServerAddress {
  #if targetEnvironment(simulator)
    static let initialValue = "http://127.0.0.1:3080"
  #else
    static let initialValue = ""
  #endif

  static func normalize(_ rawValue: String) -> URL? {
    let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
    guard
      var components = URLComponents(string: candidate),
      let scheme = components.scheme?.lowercased(),
      scheme == "http" || scheme == "https",
      components.host?.isEmpty == false,
      components.user == nil,
      components.password == nil
    else {
      return nil
    }

    components.scheme = scheme
    while components.path.count > 1, components.path.hasSuffix("/") {
      components.path.removeLast()
    }
    if components.path == "/" { components.path = "" }
    components.query = nil
    components.fragment = nil
    return components.url
  }

  static func storageValue(for url: URL) -> String {
    var value = url.absoluteString
    while value.hasSuffix("/") {
      value.removeLast()
    }
    return value
  }

  static func isSecureEnoughForDevice(_ url: URL) -> Bool {
    if url.scheme?.lowercased() == "https" { return true }
    guard url.scheme?.lowercased() == "http", let host = url.host?.lowercased() else {
      return false
    }

    if host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".local") {
      return true
    }

    let parts = host.split(separator: ".").compactMap { Int($0) }
    guard parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }) else { return false }
    return parts[0] == 10
      || (parts[0] == 172 && (16...31).contains(parts[1]))
      || (parts[0] == 192 && parts[1] == 168)
  }

  static func healthURL(for serverURL: URL) -> URL {
    serverURL.appendingPathComponent("api/config")
  }
}
