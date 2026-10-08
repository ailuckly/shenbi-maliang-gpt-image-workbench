#!/usr/bin/env bash
# One-shot (re-runnable) ShenBi install/upgrade for a Debian/Ubuntu or RHEL-family server.
# Usage (as root): bash install-server.sh [path-to-shenbi-data.tgz]
#   - code:  /srv/shenbi/app   (git clone/pull of REPO, built with Bun)
#   - data:  /srv/shenbi/data  (restored from the tarball only when no data exists yet)
#   - service: systemd "shenbi", listening on 127.0.0.1:8787, Nginx proxying port 80
#   - HTTPS: set SHENBI_DOMAIN once (saved to /etc/shenbi/domain); a Let's Encrypt certificate is
#     requested on the first run and Nginx then redirects HTTP to HTTPS on every later run.
set -euo pipefail

REPO="${SHENBI_REPO:-https://github.com/ailuckly/shenbi-maliang-gpt-image-workbench.git}"
BRANCH="${SHENBI_BRANCH:-main}"
ROOT_DIR=/srv/shenbi
APP_DIR="$ROOT_DIR/app"
DATA_DIR="$ROOT_DIR/data"
DATA_TARBALL="${1:-}"
TIMEZONE="${SHENBI_TIMEZONE:-Asia/Shanghai}"
DOMAIN_FILE=/etc/shenbi/domain
if [ -n "${SHENBI_DOMAIN:-}" ]; then
  mkdir -p /etc/shenbi && printf '%s\n' "$SHENBI_DOMAIN" > "$DOMAIN_FILE"
fi
DOMAIN="$(cat "$DOMAIN_FILE" 2>/dev/null || true)"
ACME_WEBROOT=/var/www/letsencrypt
SERVICE_USER=shenbi
BUN="/home/$SERVICE_USER/.bun/bin/bun"

log() { printf '\n==> %s\n' "$*"; }
as_user() { runuser -u "$SERVICE_USER" -- bash -lc "$*"; }

log "Installing system packages"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y git curl unzip ca-certificates nginx
  [ -z "$DOMAIN" ] || apt-get install -y certbot
elif command -v dnf >/dev/null; then
  dnf install -y git curl unzip ca-certificates nginx
  [ -z "$DOMAIN" ] || dnf install -y certbot
else
  echo "Unsupported distribution: install git, curl, unzip and nginx manually." >&2
  exit 1
fi

log "Timezone ($TIMEZONE)"
# Daily quotas and scheduled backups follow the server's local day.
timedatectl set-timezone "$TIMEZONE" 2>/dev/null || ln -sf "/usr/share/zoneinfo/$TIMEZONE" /etc/localtime

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
# Build into dist-next and swap only on success, so the running site never serves a half-built dist.
as_user "cd $APP_DIR && $BUN install --frozen-lockfile && $BUN run check && $BUN x vite build --outDir dist-next --emptyOutDir"
# A restart fails in-flight image jobs, so give running generations up to 5 minutes to finish
# before the new frontend and backend go live together.
if systemctl is-active --quiet shenbi 2>/dev/null && [ -f "$DATA_DIR/app.db" ]; then
  for _ in $(seq 1 60); do
    running="$(as_user "cd $APP_DIR && $BUN scripts/deploy/running-jobs.ts $DATA_DIR/app.db" || echo 0)"
    [ "${running:-0}" -gt 0 ] 2>/dev/null || break
    echo "Waiting for $running running image job(s) before switching versions…"
    sleep 5
  done
fi
as_user "cd $APP_DIR && rm -rf dist.old && { [ -d dist ] && mv dist dist.old || true; } && mv dist-next dist"

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
TZ=$TIMEZONE
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

log "Nginx"
NGINX_CONF=/etc/nginx/conf.d/shenbi.conf
mkdir -p "$ACME_WEBROOT"
write_nginx() {
  local mode="$1" # http | https
  local proxy='
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
        proxy_send_timeout 120s;'
  local app="
    client_max_body_size 24m;
    client_body_timeout 120s;
    # Password logins: at most 10 per minute per IP (the app also locks accounts and IPs).
    location ~ ^/api/(config/)?auth/login\$ {
        limit_req zone=shenbi_login burst=5 nodelay;
        limit_req_status 429;$proxy
    }
    location / {$proxy
    }"
  {
    echo 'limit_req_zone $binary_remote_addr zone=shenbi_login:10m rate=10r/m;'
    if [ "$mode" = https ]; then
      cat <<CONF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root $ACME_WEBROOT; }
    location / { return 301 https://$DOMAIN\$request_uri; }
}
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:shenbi_ssl:10m;
    add_header Strict-Transport-Security "max-age=31536000" always;$app
}
CONF
    else
      cat <<CONF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root $ACME_WEBROOT; }$app
}
CONF
    fi
  } > "$NGINX_CONF"
}
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ -n "$DOMAIN" ] && [ -f "$CERT_DIR/fullchain.pem" ]; then write_nginx https; else write_nginx http; fi
# Distribution default sites also claim port 80; disable them so ours is the default server.
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null
systemctl restart nginx

if [ -n "$DOMAIN" ] && [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  log "Requesting a Let's Encrypt certificate for $DOMAIN"
  # Renewal runs from certbot's own timer; the hook reloads Nginx after each renewal.
  certbot certonly --webroot -w "$ACME_WEBROOT" -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook "systemctl reload nginx"
  write_nginx https
  nginx -t
  systemctl reload nginx
fi

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http --add-service=https >/dev/null && firewall-cmd --reload >/dev/null
fi

log "Health check"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then break; fi
  sleep 2
done
if ! curl -fsS http://127.0.0.1:8787/api/health; then
  echo "Health check failed; recent service log:" >&2
  journalctl -u shenbi -n 40 --no-pager >&2
  exit 1
fi
echo
if [ -n "$DOMAIN" ] && [ -f "$CERT_DIR/fullchain.pem" ]; then
  curl -fsS -o /dev/null -w "nginx https -> %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health"
else
  curl -fsS -o /dev/null -w "nginx :80 -> %{http_code}\n" http://127.0.0.1/api/health
fi
systemctl --no-pager --lines 5 status shenbi | head -12
