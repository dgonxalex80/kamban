#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/kamban-flow"
PID_FILE="$LOG_DIR/server.pid"
LOG_FILE="$LOG_DIR/server.log"

mkdir -p "$LOG_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # Desktop launchers do not load the interactive shell profile.
  # Load nvm so native modules use the same Node version as the terminal.
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

server_responds() {
  if command -v curl >/dev/null 2>&1; then
    curl --silent --fail --max-time 1 "http://localhost:$PORT" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q --spider -T 1 "http://localhost:$PORT" >/dev/null 2>&1
  else
    return 1
  fi
}

if server_responds; then
  :
else
  cd "$APP_DIR"
  if command -v setsid >/dev/null 2>&1; then
    setsid env PORT="$PORT" npm start >>"$LOG_FILE" 2>&1 < /dev/null &
  else
    PORT="$PORT" nohup npm start >>"$LOG_FILE" 2>&1 < /dev/null &
  fi
  echo "$!" >"$PID_FILE"
fi

for _ in {1..20}; do
  server_responds && break
  sleep 0.25
done

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &
else
  printf 'Kamban Flow iniciado en http://localhost:%s\n' "$PORT"
fi
