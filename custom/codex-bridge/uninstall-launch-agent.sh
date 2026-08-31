#!/bin/zsh
set -euo pipefail

LABEL="app.chatone.subscription-bridge"
LEGACY_LABEL="ai.personal.chat.subscription-bridge"
AGENT_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
RUNTIME_DIR="$HOME/Library/Application Support/ChatOne/subscription-bridge"

launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID/$LEGACY_LABEL" >/dev/null 2>&1 || true
if [[ -f "$AGENT_PATH" ]]; then
  mv "$AGENT_PATH" "$HOME/.Trash/$LABEL.plist"
fi
if [[ -d "$RUNTIME_DIR" ]]; then
  mv "$RUNTIME_DIR" "$HOME/.Trash/subscription-bridge-$(date +%Y%m%d-%H%M%S)"
fi

echo "Uninstalled $LABEL; files were moved to Trash."
