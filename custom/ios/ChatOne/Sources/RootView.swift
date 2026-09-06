import SwiftUI
import UIKit

struct RootView: View {
  @AppStorage("chatOne.serverAddress") private var serverAddress = ServerAddress.initialValue
  @State private var draftAddress = ""
  @State private var isEditingServer = false
  @State private var isCheckingServer = false
  @State private var connectionError: String?

  private var serverURL: URL? {
    ServerAddress.normalize(serverAddress)
  }

  var body: some View {
    Group {
      if let serverURL, !isEditingServer {
        ChatContainer(serverURL: serverURL) {
          draftAddress = serverAddress
          isEditingServer = true
        }
      } else {
        ServerSetupView(
          address: $draftAddress,
          hasExistingServer: serverURL != nil,
          isConnecting: isCheckingServer,
          errorMessage: connectionError,
          onCancel: cancelEditing,
          onConnect: saveServer
        )
      }
    }
    .preferredColorScheme(nil)
    .onAppear {
      if draftAddress.isEmpty {
        draftAddress = serverAddress
      }
    }
  }

  private func cancelEditing() {
    draftAddress = serverAddress
    connectionError = nil
    isEditingServer = false
  }

  private func saveServer() {
    guard let normalized = ServerAddress.normalize(draftAddress) else { return }
    isCheckingServer = true
    connectionError = nil

    Task {
      do {
        try await ServerProbe.check(normalized)
        serverAddress = ServerAddress.storageValue(for: normalized)
        draftAddress = serverAddress
        isEditingServer = false
      } catch {
        connectionError = error.localizedDescription
      }
      isCheckingServer = false
    }
  }
}

private struct ServerSetupView: View {
  @Binding var address: String
  let hasExistingServer: Bool
  let isConnecting: Bool
  let errorMessage: String?
  let onCancel: () -> Void
  let onConnect: () -> Void

  @FocusState private var isAddressFocused: Bool

  private var isValid: Bool {
    ServerAddress.normalize(address) != nil
  }

  var body: some View {
    ZStack {
      AppPalette.canvas
        .ignoresSafeArea()

      ScrollView {
        VStack(spacing: 26) {
          Spacer(minLength: 54)

          Image(systemName: "message.and.waveform.fill")
            .font(.system(size: 42, weight: .medium))
            .foregroundStyle(AppPalette.accent)
            .frame(width: 88, height: 88)
            .background(AppPalette.surface, in: RoundedRectangle(cornerRadius: 25))

          VStack(spacing: 8) {
            Text("连接 ChatOne")
              .font(.system(size: 28, weight: .semibold, design: .rounded))
            Text("iPhone 连接你的 LibreChat 服务；ZenMux API Key 不会进入手机。")
              .font(.system(size: 15))
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }

          VStack(alignment: .leading, spacing: 10) {
            Text("服务器地址")
              .font(.system(size: 13, weight: .semibold))
              .foregroundStyle(.secondary)

            TextField("https://chat.example.com", text: $address)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
              .keyboardType(.URL)
              .submitLabel(.go)
              .focused($isAddressFocused)
              .onSubmit {
                if isValid { onConnect() }
              }
              .padding(.horizontal, 16)
              .frame(height: 52)
              .background(AppPalette.surface, in: RoundedRectangle(cornerRadius: 15))
              .overlay {
                RoundedRectangle(cornerRadius: 15)
                  .stroke(AppPalette.divider, lineWidth: 1)
              }

            Text("同一 Wi-Fi 可填写 http://你的Mac局域网IP:3080；外网使用建议配置 HTTPS。")
              .font(.system(size: 12))
              .foregroundStyle(.secondary)

            if let errorMessage {
              Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundStyle(AppPalette.danger)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("server-connection-error")
            }
          }

          VStack(spacing: 12) {
            Button(action: onConnect) {
              HStack(spacing: 9) {
                if isConnecting {
                  ProgressView()
                    .tint(.white)
                }
                Text(isConnecting ? "正在检查…" : "连接")
                  .font(.system(size: 16, weight: .semibold))
              }
              .frame(maxWidth: .infinity)
              .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.roundedRectangle(radius: 15))
            .disabled(!isValid || isConnecting)

            if hasExistingServer {
              Button("取消", action: onCancel)
                .font(.system(size: 15, weight: .medium))
            }
          }

          Spacer(minLength: 40)
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
      }
      .scrollDismissesKeyboard(.interactively)
    }
  }
}

private struct ChatContainer: View {
  let serverURL: URL
  let onEditServer: () -> Void

  @StateObject private var state = WebViewState()
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    VStack(spacing: 0) {
      NativeAppBar(
        state: state,
        serverURL: serverURL,
        onEditServer: onEditServer
      )

      ZStack {
        ChatWebView(serverURL: serverURL, state: state)

        if let error = state.errorMessage {
          ConnectionErrorView(message: error, retry: state.retry, editServer: onEditServer)
        }
      }
    }
    .background(AppPalette.canvas)
    .ignoresSafeArea(.container, edges: .bottom)
    .onChange(of: scenePhase) { phase in
      if phase == .active, state.errorMessage != nil {
        state.retry()
      }
    }
  }
}

enum AppPalette {
  static let canvas = adaptive(light: 0xFAF9F6, dark: 0x272724)
  static let surface = adaptive(light: 0xFFFEFA, dark: 0x2D2D2A)
  static let ink = adaptive(light: 0x2F2D29, dark: 0xF0EEE8)
  static let muted = adaptive(light: 0x716E67, dark: 0xBBB7AF)
  static let accent = adaptive(light: 0xB55F43, dark: 0xD37A5D)
  static let danger = adaptive(light: 0xA83832, dark: 0xE07C74)
  static let divider = adaptive(light: 0xDED9CF, dark: 0x41413C)
  static let pressed = adaptive(light: 0xE9E6DE, dark: 0x393936)

  private static func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(
      uiColor: UIColor { traits in
        UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
      }
    )
  }
}

extension UIColor {
  convenience init(rgb: UInt32) {
    self.init(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }
}

private struct NativeAppBar: View {
  @ObservedObject var state: WebViewState
  let serverURL: URL
  let onEditServer: () -> Void

  var body: some View {
    HStack(spacing: 10) {
      if state.isAuthPage {
        brand
      } else {
        Button(action: perform(state.openSidebar)) {
          Image(systemName: "sidebar.left")
            .font(.system(size: 16, weight: .semibold))
            .frame(width: 38, height: 38)
        }
        .accessibilityLabel("打开对话列表")

        Spacer(minLength: 0)

        Text("ChatOne")
          .font(.system(size: 17, weight: .semibold, design: .rounded))
          .foregroundStyle(AppPalette.ink)
          .accessibilityAddTraits(.isHeader)
      }

      Spacer(minLength: 0)

      if !state.isAuthPage {
        Button(action: perform(state.newChat)) {
          Image(systemName: "square.and.pencil")
            .font(.system(size: 16, weight: .semibold))
            .frame(width: 38, height: 38)
        }
        .accessibilityLabel("新建对话")
      }

      Menu {
        if state.canGoBack {
          Button("后退", systemImage: "chevron.backward", action: perform(state.goBack))
        }
        if state.canGoForward {
          Button("前进", systemImage: "chevron.forward", action: perform(state.goForward))
        }
        Button("重新加载", systemImage: "arrow.clockwise", action: perform(state.retry))
        Divider()
        Button("修改服务器", systemImage: "server.rack", action: onEditServer)
        Button("在 Safari 打开", systemImage: "safari") {
          UIApplication.shared.open(serverURL)
        }
      } label: {
        Image(systemName: "ellipsis")
          .font(.system(size: 16, weight: .semibold))
          .frame(width: 38, height: 38)
      }
      .accessibilityLabel("应用菜单")
    }
    .foregroundStyle(AppPalette.muted)
    .buttonStyle(NativeBarButtonStyle())
    .padding(.horizontal, 10)
    .frame(height: 50)
    .background(AppPalette.canvas)
    .overlay(alignment: .bottom) {
      if state.isLoading {
        ProgressView()
          .progressViewStyle(.linear)
          .tint(AppPalette.accent)
          .frame(height: 2)
          .accessibilityLabel("正在连接")
      } else {
        Rectangle()
          .fill(AppPalette.divider)
          .frame(height: 0.5)
      }
    }
  }

  private var brand: some View {
    HStack(spacing: 9) {
      Image(systemName: "message.and.waveform.fill")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.white)
        .frame(width: 30, height: 30)
        .background(AppPalette.accent, in: RoundedRectangle(cornerRadius: 9))

      Text("ChatOne")
        .font(.system(size: 17, weight: .semibold, design: .rounded))
        .foregroundStyle(AppPalette.ink)
    }
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isHeader)
  }

  private func perform(_ action: @escaping () -> Void) -> () -> Void {
    {
      UIImpactFeedbackGenerator(style: .soft).impactOccurred()
      action()
    }
  }
}

private struct NativeBarButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .contentShape(Rectangle())
      .background(
        AppPalette.pressed.opacity(configuration.isPressed ? 1 : 0),
        in: RoundedRectangle(cornerRadius: 12)
      )
      .scaleEffect(configuration.isPressed ? 0.96 : 1)
      .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
  }
}

private struct ConnectionErrorView: View {
  let message: String
  let retry: () -> Void
  let editServer: () -> Void

  var body: some View {
    ZStack {
      AppPalette.canvas
        .ignoresSafeArea()

      VStack(spacing: 18) {
        Image(systemName: "wifi.exclamationmark")
          .font(.system(size: 34, weight: .medium))
          .foregroundStyle(.secondary)

        VStack(spacing: 7) {
          Text("无法连接 ChatOne")
            .font(.system(size: 21, weight: .semibold))
          Text(message)
            .font(.system(size: 14))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }

        HStack(spacing: 12) {
          Button("修改地址", action: editServer)
            .buttonStyle(.bordered)
          Button("重试", action: retry)
            .buttonStyle(.borderedProminent)
        }
      }
      .padding(30)
    }
  }
}
