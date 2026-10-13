#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

id="${1:-}"
config="$(find . -name script.json -not -path './node_modules/*' -not -path '*/node_modules/*' -print0 | while IFS= read -r -d '' file; do
  if [[ "$(jq -r --arg id "$id" 'select(.id == $id) | .id' "$file")" == "$id" ]]; then
    printf '%s\n' "$file"
    break
  fi
done)"
if [[ -z "$config" ]]; then
  echo "Unknown script '$id'. Available scripts:" >&2
  find . -name script.json -not -path './node_modules/*' -not -path '*/node_modules/*' -print0 |
    xargs -0 -n1 jq -r '.id' >&2
  exit 1
fi

directory="$(dirname "$config")"
type="$(jq -r '.type' "$config")"
if [[ "$type" == vite ]]; then
  (cd "$directory" && eval "$(jq -r '.install' "$(basename "$config")")" && bun run build)
  file="$directory/dist/$(jq -r '.output' "$config")"
else
  file="$directory/$(jq -r '.source' "$config")"
fi

test -f "$file" || { echo "Userscript not found: $file" >&2; exit 1; }

port="${PORT:-8765}"
python3 -m http.server "$port" --bind 127.0.0.1 >/tmp/tampermonkey-userscript-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM

url="http://127.0.0.1:$port/$file"
echo "Opening $url"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then
  open "$url"
else
  echo "Open this URL in a browser with Tampermonkey installed: $url"
fi

echo "Press Ctrl+C to stop the local server."
wait "$server_pid"
