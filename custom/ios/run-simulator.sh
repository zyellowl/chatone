#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
APP_PATH="$SCRIPT_DIR/.build/DerivedData/Build/Products/Debug-iphonesimulator/ChatOne.app"
BUNDLE_ID="app.chatone.ios"

source "$SCRIPT_DIR/xcode-env.sh"

zsh "$SCRIPT_DIR/build.sh"

DEVICE_ID="${IOS_SIMULATOR_UDID:-}"
if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$({ xcrun simctl list devices booted -j || true; } | /usr/bin/python3 -c '
import json, sys
try:
    payload = json.load(sys.stdin)
    print(next(device["udid"] for devices in payload.get("devices", {}).values() for device in devices if device.get("state") == "Booted"))
except (StopIteration, ValueError):
    pass
')"
fi

if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$(xcrun simctl list devices available -j | /usr/bin/python3 -c '
import json, sys
payload = json.load(sys.stdin)
devices = [device for runtime in payload.get("devices", {}).values() for device in runtime if device.get("isAvailable") and "iPhone" in device.get("name", "")]
print(devices[0]["udid"] if devices else "")
')"
  if [[ -z "$DEVICE_ID" ]]; then
    echo "No available iPhone Simulator was found. Install an iOS Simulator runtime in Xcode." >&2
    exit 3
  fi
  xcrun simctl boot "$DEVICE_ID" >/dev/null 2>&1 || true
fi

open -a Simulator
xcrun simctl bootstatus "$DEVICE_ID" -b
xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID"

echo "Launched ChatOne on Simulator $DEVICE_ID"
