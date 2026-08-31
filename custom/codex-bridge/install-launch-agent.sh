#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
LABEL="app.chatone.subscription-bridge"
LEGACY_LABEL="ai.personal.chat.subscription-bridge"
RUNTIME_DIR="$HOME/Library/Application Support/ChatOne/subscription-bridge"
LOG_DIR="$HOME/Library/Logs/ChatOne"
AUTH_DIR="$HOME/Library/Application Support/ChatOne/auth"
LEGACY_AUTH_PATH="$HOME/Library/Application Support/Personal AI/auth/openai.json"
AGENT_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
BRIDGE_PATH="$RUNTIME_DIR/server.mjs"
RESILIENCE_PATH="$RUNTIME_DIR/resilience.mjs"
LOG_PATH="$LOG_DIR/subscription-bridge.log"
AUTH_PATH="$AUTH_DIR/openai.json"

NODE_EXECUTABLE=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [[ -x "$candidate" ]]; then
    NODE_EXECUTABLE="$candidate"
    break
  fi
done

PI_PACKAGE_ROOT=""
for candidate in \
  /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent \
  /usr/local/lib/node_modules/@earendil-works/pi-coding-agent; do
  if [[ -f "$candidate/node_modules/@earendil-works/pi-ai/dist/index.js" ]]; then
    PI_PACKAGE_ROOT="$candidate"
    break
  fi
done

if [[ -z "$NODE_EXECUTABLE" || -z "$PI_PACKAGE_ROOT" ]]; then
  echo "Pi subscription runtime was not found." >&2
  exit 2
fi

mkdir -p "$RUNTIME_DIR" "$LOG_DIR" "$AUTH_DIR" "$HOME/Library/LaunchAgents"
chmod 700 "$AUTH_DIR"

# Preserve an existing local ChatGPT subscription login during the ChatOne rename.
# The legacy credential never leaves this Mac and is copied only when ChatOne has
# no credential of its own yet.
if [[ ! -f "$AUTH_PATH" && -f "$LEGACY_AUTH_PATH" ]]; then
  cp -p "$LEGACY_AUTH_PATH" "$AUTH_PATH"
  chmod 600 "$AUTH_PATH"
fi

cp "$SCRIPT_DIR/server.mjs" "$BRIDGE_PATH"
cp "$SCRIPT_DIR/resilience.mjs" "$RESILIENCE_PATH"
cp "$SCRIPT_DIR/$LABEL.plist" "$AGENT_PATH"

/usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 $NODE_EXECUTABLE" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 $BRIDGE_PATH" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:PI_PACKAGE_ROOT $PI_PACKAGE_ROOT" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:PI_AUTH_FILE $AUTH_PATH" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :WorkingDirectory $RUNTIME_DIR" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :StandardOutPath $LOG_PATH" "$AGENT_PATH"
/usr/libexec/PlistBuddy -c "Set :StandardErrorPath $LOG_PATH" "$AGENT_PATH"

plutil -lint "$AGENT_PATH" >/dev/null
launchctl bootout "gui/$UID/$LEGACY_LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl enable "gui/$UID/$LABEL"

# launchd can briefly retain the old job after bootout. Retry bootstrap so an
# in-place upgrade is reliable instead of leaving the bridge stopped.
bootstrap_status=1
for attempt in 1 2 3; do
  if launchctl bootstrap "gui/$UID" "$AGENT_PATH"; then
    bootstrap_status=0
    break
  fi
  sleep 2
done
if (( bootstrap_status != 0 )); then
  echo "Could not register $LABEL after three attempts." >&2
  exit "$bootstrap_status"
fi
launchctl kickstart -k "gui/$UID/$LABEL"

echo "Installed $LABEL"
