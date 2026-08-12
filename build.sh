#!/bin/bash

# VITE_APP_API_HOST is a dev-only override (points at a specific device IP).
# For the bundled Android WebView build the page is served by the device's
# own HTTP server, so the host must resolve to window.location.host at runtime.
# Empty shell env var overrides .env.local and lets the `|| window.location.host`
# fallback in api.ts take effect.
VITE_APP_API_HOST="" yarn build

# Android APK packaging drops any classpath java-resource whose name starts
# with "_". Rolldown (Vite 8) names the shared @vitejs/plugin-vue helper chunk
# `_plugin-vue_export-helper-*.js`, which would therefore be missing from the
# Android APK (SPA fails to load) while iOS (Xcode Copy Files) works fine.
# Strip the leading underscore from that file and rewrite its references so it
# ships inside the Android app too.
helper=$(ls dist/assets/_plugin-vue_export-helper-*.js 2>/dev/null | head -1)
if [ -n "$helper" ]; then
  base=$(basename "$helper")
  renamed="dist/assets/${base#_}"
  mv "$helper" "$renamed"
  # Update references in index.html and any JS that imports the helper chunk.
  find dist -type f \( -name '*.html' -o -name '*.js' \) \
    -exec sed -i '' "s#/_plugin-vue_export-helper-#/plugin-vue_export-helper-#g" {} +
fi

rm -rf ../plain-app/app/src/main/resources/web/*
cp -r dist/* ../plain-app/app/src/main/resources/web/

