#!/bin/sh
set -e

# 1. Start virtual screen
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
sleep 1

# 2. Lightweight window manager
fluxbox &

# 3. Auto-restarting Incognito Chromium
(
  while true; do
    chromium \
      --no-sandbox \
      --disable-dev-shm-usage \
      --disable-gpu \
      --incognito \
      --no-first-run \
      --disable-infobars \
      --window-size=1280,720 \
      --window-position=0,0 \
      https://www.google.com
    sleep 1
  done
) &

# 4. VNC + WebSocket bridge (internal port 6080)
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -quiet &
websockify --web=/usr/share/novnc 6080 localhost:5900 &

# 5. Start Express + React app on port 8080
exec node server.js
