#!/bin/bash

# VITE_APP_API_HOST is a dev-only override (points at a specific device IP).
# For the bundled Android WebView build the page is served by the device's
# own HTTP server, so the host must resolve to window.location.host at runtime.
# Empty shell env var overrides .env.local and lets the `|| window.location.host`
# fallback in api.ts take effect.
VITE_APP_API_HOST="" yarn build
rm -rf ../plain-app/app/src/main/resources/web/*
cp -r dist/* ../plain-app/app/src/main/resources/web/

