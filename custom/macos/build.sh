#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h:h}"
BUILD_DIR="$SCRIPT_DIR/.build"
APP_DIR="$PROJECT_DIR/dist/ChatOne.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$BUILD_DIR/AppIcon.iconset"
MASTER_ICON="$BUILD_DIR/AppIcon-1024.png"
SOURCE_ICON="$SCRIPT_DIR/AppIcon-troll.png"
export CLANG_MODULE_CACHE_PATH="$BUILD_DIR/clang-module-cache"
export SWIFT_MODULECACHE_PATH="$BUILD_DIR/swift-module-cache"

mkdir -p \
  "$BUILD_DIR" \
  "$CLANG_MODULE_CACHE_PATH" \
  "$SWIFT_MODULECACHE_PATH" \
  "$PROJECT_DIR/dist"

if [[ -d "$APP_DIR" ]]; then
  rm -rf "$APP_DIR"
fi
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$ICONSET_DIR"

swiftc \
  -swift-version 5 \
  -O \
  -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit \
  -framework WebKit \
  "$SCRIPT_DIR/Sources/main.swift" \
  -o "$MACOS_DIR/ChatOne"

cp "$SCRIPT_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"

sips -z 1024 1024 "$SOURCE_ICON" --out "$MASTER_ICON" >/dev/null

typeset -a icon_specs=(
  "16 icon_16x16.png"
  "32 icon_16x16@2x.png"
  "32 icon_32x32.png"
  "64 icon_32x32@2x.png"
  "128 icon_128x128.png"
  "256 icon_128x128@2x.png"
  "256 icon_256x256.png"
  "512 icon_256x256@2x.png"
  "512 icon_512x512.png"
  "1024 icon_512x512@2x.png"
)

for spec in "${icon_specs[@]}"; do
  size="${spec%% *}"
  name="${spec#* }"
  sips -z "$size" "$size" "$MASTER_ICON" --out "$ICONSET_DIR/$name" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns"
codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "$APP_DIR"
