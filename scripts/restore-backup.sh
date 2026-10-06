#!/usr/bin/env bash
set -euo pipefail
# Restore only ShenBi's regular-file archive into a newly created directory.
if [[ $# != 2 ]]; then
  echo 'Usage: bash scripts/restore-backup.sh BACKUP.tar /absolute/new-data-directory' >&2
  exit 2
fi
archive=$1
target=$2
[[ -f "$archive" && "$target" == /* && ! -e "$target" && ! -L "$target" ]] || {
  echo 'Archive must exist; destination must be absolute and must not exist.' >&2
  exit 1
}
tar -tf "$archive" | awk '
  /(^\/|(^|\/)\.\.($|\/))/ { bad=1 }
  !/^(app\.db|config\.db|manifest\.json|files\/.+)$/ { bad=1 }
  $0 == "app.db" { app=1 }
  $0 == "config.db" { config=1 }
  $0 == "manifest.json" { manifest=1 }
  END { exit bad || !app || !config || !manifest }
' || { echo 'Unexpected archive paths or missing required files.' >&2; exit 1; }
tar -tvf "$archive" | awk 'substr($0,1,1)!="-" { bad=1 } END { exit bad }' || {
  echo 'Archive must contain regular files only; links are rejected.' >&2
  exit 1
}
umask 077
mkdir -m 700 "$target"
tar -xf "$archive" -C "$target" --no-same-owner
echo 'Restored into new directory. Keep the original data directory unchanged.'
