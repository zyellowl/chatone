import Foundation

enum ServerProbeError: LocalizedError {
  case insecureAddress
  case unreachable
  case unexpectedStatus(Int)

  var errorDescription: String? {
    switch self {
    case .insecureAddress:
      return "公网连接必须使用 HTTPS；HTTP 只允许 localhost、.local 或私有局域网地址。"
    case .unreachable:
      return "没有收到 ChatOne 服务响应。请确认 Mac 服务正在运行，并且手机与 Mac 网络互通。"
    case .unexpectedStatus(let status):
      return "服务器可以访问，但返回了异常状态（HTTP \(status)）。"
    }
  }
}

enum ServerProbe {
  static func check(_ serverURL: URL) async throws {
    guard ServerAddress.isSecureEnoughForDevice(serverURL) else {
      throw ServerProbeError.insecureAddress
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 8
    configuration.timeoutIntervalForResource = 10
    configuration.waitsForConnectivity = false
    let session = URLSession(configuration: configuration)

    var request = URLRequest(url: ServerAddress.healthURL(for: serverURL))
    request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    request.setValue("application/json", forHTTPHeaderField: "Accept")

    do {
      let (_, response) = try await session.data(for: request)
      guard let httpResponse = response as? HTTPURLResponse else {
        throw ServerProbeError.unreachable
      }
      guard (200..<500).contains(httpResponse.statusCode) else {
        throw ServerProbeError.unexpectedStatus(httpResponse.statusCode)
      }
    } catch let error as ServerProbeError {
      throw error
    } catch {
      throw ServerProbeError.unreachable
    }
  }
}
