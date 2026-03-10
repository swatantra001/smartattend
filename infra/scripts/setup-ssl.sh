#!/usr/bin/env bash
# Obtain Let's Encrypt certificates and install for Nginx.
# Run BEFORE starting Nginx for the first time.
set -euo pipefail

DOMAIN_API="api.smartattend.yourdomain.com"
DOMAIN_ADMIN="admin.smartattend.yourdomain.com"
EMAIL="admin@yourdomain.com"
SSL_DIR="/opt/smartattend/infra/nginx/ssl"

# Stop Nginx if running (port 80 needed for certbot)
docker compose -f /opt/smartattend/docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obtain certificate (covers both subdomains)
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN_API" \
  -d "$DOMAIN_ADMIN"

# Copy certs to nginx ssl directory
cp /etc/letsencrypt/live/"$DOMAIN_API"/fullchain.pem "$SSL_DIR/fullchain.pem"
cp /etc/letsencrypt/live/"$DOMAIN_API"/privkey.pem   "$SSL_DIR/privkey.pem"
chmod 600 "$SSL_DIR/privkey.pem"

echo "✅ SSL certificates installed"

# Auto-renewal cron
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/$DOMAIN_API/fullchain.pem $SSL_DIR/fullchain.pem && \
  cp /etc/letsencrypt/live/$DOMAIN_API/privkey.pem $SSL_DIR/privkey.pem && \
  docker exec smartattend-nginx nginx -s reload") | crontab -

echo "✅ Auto-renewal cron installed"