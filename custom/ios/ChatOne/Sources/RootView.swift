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
      Color(red: 0.97, green: 0.96, blue: 0.93)
        .ignoresSafeArea()

      ScrollView {
        VStack(spacing: 26) {
          Spacer(minLength: 54)

          Image(systemName: "message.and.waveform.fill")
            .font(.system(size: 42, weight: .medium))
            .foregroundStyle(Color(red: 0.25, green: 0.40, blue: 0.34))
            .frame(width: 88, height: 88)
            .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 25))

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
              .background(.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 15))
              .overlay {
                RoundedRectangle(cornerRadius: 15)
                  .stroke(.black.opacity(0.08), lineWidth: 1)
              }

            Text("同一 Wi-Fi 可填写 http://你的Mac局域网IP:3080；外网使用建议配置 HTTPS。")
              .font(.system(size: 12))
              .foregroundStyle(.secondary)

            if let errorMessage {
              Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundStyle(Color(red: 0.66, green: 0.22, blue: 0.18))
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
    ZStack(alignment: .topTrailing) {
      ChatWebView(serverURL: serverURL, state: state)
        .ignoresSafeArea(.container, edges: .bottom)

      if let error = state.errorMessage {
        ConnectionErrorView(message: error, retry: state.retry, editServer: onEditServer)
      } else if state.isLoading {
        ProgressView()
          .controlSize(.regular)
          .padding(12)
          .background(.ultraThinMaterial, in: Circle())
          .padding(.top, 8)
          .padding(.trailing, 10)
          .accessibilityLabel("正在连接")
      } else {
        Menu {
          if state.canGoBack {
            Button("后退", systemImage: "chevron.backward", action: state.goBack)
          }
          if state.canGoForward {
            Button("前进", systemImage: "chevron.forward", action: state.goForward)
          }
          Button("重新加载", systemImage: "arrow.clockwise", action: state.retry)
          Button("修改服务器", systemImage: "server.rack", action: onEditServer)
          Button("在 Safari 打开", systemImage: "safari") {
            UIApplication.shared.open(serverURL)
          }
        } label: {
          Image(systemName: "ellipsis")
            .font(.system(size: 15, weight: .semibold))
            .frame(width: 36, height: 36)
            .background(.ultraThinMaterial, in: Circle())
        }
        .foregroundStyle(.secondary)
        .padding(.top, 8)
        .padding(.trailing, 10)
        .accessibilityLabel("应用菜单")
      }
    }
    .background(Color(red: 0.97, green: 0.96, blue: 0.93))
    .onChange(of: scenePhase) { phase in
      if phase == .active, state.errorMessage != nil {
        state.retry()
      }
    }
  }
}

private struct ConnectionErrorView: View {
  let message: String
  let retry: () -> Void
  let editServer: () -> Void

  var body: some View {
    ZStack {
      Color(red: 0.97, green: 0.96, blue: 0.93)
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
