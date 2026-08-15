#!/bin/bash
set -e
if [ "$(uname)" = "Darwin" ]; then
  VITE_APP_MODE=tauri yarn tauri build --target aarch64-apple-darwin
  VITE_APP_MODE=tauri yarn tauri build --target x86_64-apple-darwin
else
  VITE_APP_MODE=tauri yarn tauri build
fi
