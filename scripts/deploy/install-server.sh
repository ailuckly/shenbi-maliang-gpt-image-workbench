#!/usr/bin/env bash
# One-shot (re-runnable) ShenBi install/upgrade for a Debian/Ubuntu or RHEL-family server.
# Usage (as root): bash install-server.sh [path-to-shenbi-data.tgz]
#   - code:  /srv/shenbi/app   (git clone/pull of REPO, built with Bun)
#   - data:  /srv/shenbi/data  (restored from the tarball only when no data exists yet)
#   - service: systemd "shenbi", listening on 127.0.0.1:8787, Nginx proxying port 80
set -euo pipefail

REPO="${SHENBI_REPO:-https://github.com/ailuckly/shenbi-maliang-gpt-image-workbench.git}"
BRANCH="${SHENBI_BRANCH:-main}"
ROOT_DIR=/srv/shenbi
APP_DIR="$ROOT_DIR/app"
DATA_DIR="$ROOT_DIR/data"
DATA_TARBALL="${1:-}"
SERVICE_USER=shenbi
BUN="/home/$SERVICE_USER/.bun/bin/bun"

log() { printf '\n==> %s\n' "$*"; }
as_user() { runuser -u "$SERVICE_USER" -- bash -lc "$*"; }

log "Installing system packages"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y git curl unzip ca-certificates nginx
elif command -v dnf >/dev/null; then
  dnf install -y git curl unzip ca-certificates nginx
else
  echo "Unsupported distribution: install git, curl, unzip and nginx manually." >&2
  exit 1
fi

log "Service user and directories"
id "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$SERVICE_USER" --shell /bin/bash "$SERVICE_USER"
mkdir -p "$ROOT_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$ROOT_DIR"

log "Bun runtime"
[ -x "$BUN" ] || as_user 'curl -fsSL https://bun.sh/install | bash'
as_user "$BUN --version"

log "Code ($BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  as_user "cd $APP_DIR && git fetch --depth 1 origin $BRANCH && git reset --hard origin/$BRANCH"
else
  as_user "git clone --depth 1 --branch $BRANCH $REPO $APP_DIR"
fi
as_user "cd $APP_DIR && $BUN install --frozen-lockfile && $BUN run build"

log "Data"
if [ -f "$DATA_DIR/app.db" ]; then
  echo "Existing data kept: $DATA_DIR"
elif [ -n "$DATA_TARBALL" ] && [ -f "$DATA_TARBALL" ]; then
  tar -xzf "$DATA_TARBALL" -C "$ROOT_DIR"
  echo "Restored data from $DATA_TARBALL"
else
  mkdir -p "$DATA_DIR"
  echo "Starting with an empty data directory"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 700 "$DATA_DIR"

log "Environment and systemd unit"
cat > /etc/shenbi.env <<ENV
HOST=127.0.0.1
PORT=8787
GPT_IMAGE_DATA_DIR=$DATA_DIR
APP_TRUST_PROXY=1
NODE_ENV=production
ENV
chmod 600 /etc/shenbi.env

cat > /etc/systemd/system/shenbi.service <<UNIT
[Unit]
Description=ShenBi image workbench
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/shenbi.env
ExecStart=$BUN server/index.ts
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable shenbi >/dev/null
systemctl restart shenbi

log "Nginx (HTTP on port 80)"
NGINX_CONF=/etc/nginx/conf.d/shenbi.conf
cat > "$NGINX_CONF" <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 24m;
    client_body_timeout 120s;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header CF-Connecting-IP "";
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1900s;
        proxy_send_timeout 120s;
    }
}
NGINX
# Distribution default sites also claim port 80; disable them so ours is the default server.
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null
systemctl restart nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http >/dev/null && firewall-cmd --reload >/dev/null
fi

log "Health check"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8787/api/health && echo
curl -fsS -o /dev/null -w "nginx :80 -> %{http_code}\n" http://127.0.0.1/api/health
systemctl --no-pager --lines 5 status shenbi | head -12
