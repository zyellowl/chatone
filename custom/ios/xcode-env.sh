#!/bin/zsh

# Keep Xcode discovery local to the iOS wrapper so a user-local installation
# works without changing the machine-wide xcode-select setting.
if [[ -n "${DEVELOPER_DIR:-}" && -x "$DEVELOPER_DIR/usr/bin/xcodebuild" ]]; then
  return 0
fi

typeset -a xcode_candidates=(
  "$HOME/Applications/Xcode.app/Contents/Developer"
  "/Applications/Xcode.app/Contents/Developer"
)

for candidate in "${xcode_candidates[@]}"; do
  if [[ -x "$candidate/usr/bin/xcodebuild" ]]; then
    export DEVELOPER_DIR="$candidate"
    return 0
  fi
done
