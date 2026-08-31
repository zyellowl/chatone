#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
SOURCE_ICON="$SCRIPT_DIR/../macos/AppIcon-troll.png"
ICON_DIR="$SCRIPT_DIR/ChatOne/Assets.xcassets/AppIcon.appiconset"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chatone-ios-icons.XXXXXX")"
MASTER_ICON="$TEMP_DIR/AppIcon-1024.png"
OPAQUE_ICON="$TEMP_DIR/AppIcon-opaque.jpg"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$ICON_DIR"
# App Store icons cannot contain an alpha channel. The JPEG round-trip flattens
# generated icon onto an opaque neutral background before the PNG sizes are made.
sips -s format jpeg "$SOURCE_ICON" --out "$OPAQUE_ICON" >/dev/null
sips -s format png "$OPAQUE_ICON" --out "$MASTER_ICON" >/dev/null

typeset -a sizes=(20 29 40 58 60 76 80 87 120 152 167 180 1024)
for size in "${sizes[@]}"; do
  sips -z "$size" "$size" "$MASTER_ICON" --out "$ICON_DIR/icon-$size.png" >/dev/null
done

echo "Prepared iOS app icons in $ICON_DIR"
