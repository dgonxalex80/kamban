#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$DESKTOP_DIR/kamban-flow.desktop"

mkdir -p "$DESKTOP_DIR"

cat >"$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Kamban Flow
Comment=Tablero Kanban local con Express y SQLite
Exec=$APP_DIR/scripts/kamban-launcher.sh
Icon=$APP_DIR/assets/kamban-flow.svg
Terminal=false
Categories=Office;ProjectManagement;
StartupNotify=true
EOF

chmod +x "$APP_DIR/scripts/kamban-launcher.sh" "$DESKTOP_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

printf 'Lanzador instalado: %s\n' "$DESKTOP_FILE"
printf 'Busca "Kamban Flow" en el menu de Ubuntu.\n'
