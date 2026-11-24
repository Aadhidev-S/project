#!/bin/sh
set -e

# 1. Start TigerVNC with dynamic resize support
Xtigervnc :99 -geometry 1280x720 -depth 24 -SecurityTypes None -rfbport 5900 -AlwaysShared &
export DISPLAY=:99
sleep 1

# 2. Lightweight window manager
fluxbox &

# 3. Auto-restarting Incognito Chromium (maximized to match dynamic screen size)
(
  while true; do
    chromium \
      --no-sandbox \
      --disable-dev-shm-usage \
      --disable-gpu \
      --incognito \
      --no-first-run \
      --disable-infobars \
      --start-maximized \
      https://www.google.com
    sleep 1
  done
) &

# 4. WebSocket bridge for noVNC
websockify --web=/usr/share/novnc 6080 localhost:5900 &

# 5. Start Express + React app
exec node server.js
