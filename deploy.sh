#!/usr/bin/env bash
# ============================================================
#  ZEVRIX — one-command server install & deploy
#  Usage:  bash deploy.sh yourdomain.com
#  (run as root on a fresh Ubuntu 22.04/24.04 VPS)
# ============================================================
set -euo pipefail
trap 'echo ""; echo "❌  Deploy failed at line $LINENO — copy this output and report it." ' ERR

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "❌  Usage: bash deploy.sh yourdomain.com"
  exit 1
fi

APP_DIR="/var/www/zevrix"
PORT=4100

echo "🚀 ZEVRIX deploy → $DOMAIN"
echo "──────────────────────────────────────────"

# ---------- 1. System packages ----------
echo "📦 Installing system packages..."
apt update -qq
apt install -y -qq curl git nginx ufw certbot python3-certbot-nginx >/dev/null

# Node.js 22 (LTS) — install if missing OR too old (npm must exist too)
NODE_OK=false
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [ "$NODE_MAJOR" -ge 18 ] && NODE_OK=true
fi

if [ "$NODE_OK" = false ]; then
  echo "⬇  Installing Node.js 22 (current: $(node -v 2>/dev/null || echo none))..."
  # remove ancient distro node if present
  apt remove -y -qq nodejs 2>/dev/null || true
  apt autoremove -y -qq 2>/dev/null || true
  if curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1; then
    apt install -y -qq nodejs >/dev/null
  else
    # fallback: official Node.js 22 binary
    echo "   nodesource failed, using official binary..."
    ARCH=$(dpkg --print-architecture)
    [ "$ARCH" = "amd64" ] && ARCH=x64
    curl -fsSL "https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-$ARCH.tar.xz" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.xz
  fi
  # make sure new node/npm win over any stale ones
  hash -r
  export PATH="/usr/local/bin:$PATH"
fi
echo "   Node $(node -v)  |  npm $(npm -v)"

# PM2 (process manager) if missing
if ! command -v pm2 >/dev/null 2>&1; then
  echo "⬇  Installing PM2..."
  npm install -g pm2 || npm install -g pm2 --force
fi

# ---------- 2. Firewall ----------
echo "🛡  Configuring firewall..."
ufw allow OpenSSH  >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

# ---------- 3. App code ----------
echo "📥 Fetching latest code..."
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull -q
else
  git clone -q https://github.com/ehsanh4/zevrix.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ---------- 4. Install & seed ----------
echo "🔧 Installing dependencies & seeding DB..."
cd "$APP_DIR/digital-store/server"
npm install --no-fund --no-audit
[ -f data/store.db ] || [ -f src/data/store.db ] || npm run seed

# ---------- 5. PM2 (keep alive + auto-restart) ----------
echo "♻  Starting with PM2..."
pm2 delete zevrix >/dev/null 2>&1 || true
pm2 start server.js --name zevrix --cwd "$APP_DIR/digital-store/server"
pm2 save >/dev/null 2>&1
pm2 startup systemd -y --service-name pm2-zevrix >/dev/null 2>&1 || true

# ---------- 6. Nginx reverse proxy ----------
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/zevrix <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # uploads can be large
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf /etc/nginx/sites-available/zevrix /etc/nginx/sites-enabled/zevrix
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------- 7. Free SSL (Let's Encrypt) ----------
echo "🔒 Issuing SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
        --redirect --email ehsanh4094@gmail.com || echo "⚠  Certbot failed — check DNS A record"

# ---------- 8. Daily DB backup ----------
echo "💾 Scheduling daily DB backup..."
cat > /usr/local/bin/zevrix-backup <<'EOF'
#!/usr/bin/env bash
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p /var/backups/zevrix
cp /var/www/zevrix/digital-store/server/src/data/store.db "/var/backups/zevrix/store-$ts.db"
find /var/backups/zevrix -name 'store-*.db' -mtime +14 -delete
EOF
chmod +x /usr/local/bin/zevrix-backup
( crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/zevrix-backup" ) \
  | sort -u | crontab -

# ---------- Done ----------
echo ""
echo "──────────────────────────────────────────"
echo "✅  ZEVRIX is live!"
echo ""
echo "   🏪 Storefront : https://$DOMAIN"
echo "   🔐 Admin panel: https://$DOMAIN/admin"
echo "   👤 Login      : admin / admin12345"
echo ""
echo "   Logs    : pm2 logs zevrix"
echo "   Restart : pm2 restart zevrix"
echo "   Backup  : /var/backups/zevrix/"
echo ""
echo "⚠  Change the admin password on first login!"
echo "──────────────────────────────────────────"
