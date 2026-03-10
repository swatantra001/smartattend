#!/usr/bin/env bash
# Provision a fresh Ubuntu 22.04 VPS for SmartAttend production.
# Run as root on a clean server.
set -euo pipefail

echo "=== SmartAttend Server Provisioning ==="

# ── System updates ────────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq

# ── Docker ────────────────────────────────────────────────────────────────────
apt-get install -y -qq ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                        docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

# ── Create deploy user ────────────────────────────────────────────────────────
useradd -m -s /bin/bash -G docker deploy 2>/dev/null || true

# ── App directory ─────────────────────────────────────────────────────────────
mkdir -p /opt/smartattend/infra/nginx/ssl
chown -R deploy:deploy /opt/smartattend

# ── UFW Firewall ──────────────────────────────────────────────────────────────
apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable

# ── Certbot (Let's Encrypt SSL) ───────────────────────────────────────────────
apt-get install -y -qq certbot

# ── Sysctl tuning for high-concurrency ───────────────────────────────────────
cat >> /etc/sysctl.conf << 'EOF'
# SmartAttend tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
fs.file-max = 2097152
EOF
sysctl -p

# ── Log rotation ──────────────────────────────────────────────────────────────
cat > /etc/logrotate.d/smartattend << 'EOF'
/opt/smartattend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

echo ""
echo "=== Provisioning complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy project to /opt/smartattend"
echo "  2. Run: certbot certonly --standalone -d api.yourdomain.com -d admin.yourdomain.com"
echo "  3. Copy certs to infra/nginx/ssl/"
echo "  4. Copy infra/.env.production to /opt/smartattend/.env"
echo "  5. Run: docker compose -f docker-compose.prod.yml up -d"