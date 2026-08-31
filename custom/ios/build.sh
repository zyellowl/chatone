#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT="$SCRIPT_DIR/ChatOne.xcodeproj"
DERIVED_DATA="$SCRIPT_DIR/.build/DerivedData"

source "$SCRIPT_DIR/xcode-env.sh"

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "ChatOne iOS requires the full Xcode app (15 or newer), not Command Line Tools." >&2
  echo "Install Xcode in /Applications or ~/Applications, open it once to install the iOS platform, then rerun npm run ios:build." >&2
  exit 2
fi

zsh "$SCRIPT_DIR/prepare.sh"
mkdir -p "$DERIVED_DATA"

xcodebuild \
  -project "$PROJECT" \
  -scheme ChatOne \
  -configuration Debug \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/ChatOne.app"
echo "$APP_PATH"
