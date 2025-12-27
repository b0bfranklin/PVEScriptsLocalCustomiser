#!/usr/bin/env bash

# FirewallAudit Installation Script for PVEScriptsLocal
# Auto-generated example for Debian 13

source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing base dependencies"
$STD apt-get update
$STD apt-get install -y curl git ca-certificates gnupg
msg_ok "Base dependencies installed"

msg_info "Installing Node.js 24.x"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
$STD apt-get install -y nodejs
msg_ok "Node.js installed: $(node --version)"

msg_info "Cloning FirewallAudit repository"
cd /opt
git clone -b "claude/self-hosted-web-app-fM6hv" "https://github.com/b0bfranklin/FirewallAudit.git" "firewallaudit"
cd /opt/firewallaudit
msg_ok "Repository cloned"

msg_info "Installing npm dependencies"
$STD npm install --production
msg_ok "Dependencies installed"

if grep -q '"build"' package.json 2>/dev/null; then
    msg_info "Building application"
    $STD npm run build
    msg_ok "Application built"
fi

msg_info "Generating credentials"
ADMIN_PASSWORD=$(openssl rand -base64 24)
cat > /opt/firewallaudit/.credentials <<EOF
Admin Username: admin
Admin Password: ${ADMIN_PASSWORD}
Generated: $(date)
EOF
chmod 600 /opt/firewallaudit/.credentials
msg_ok "Credentials generated"

msg_info "Creating environment configuration"
cat > /opt/firewallaudit/.env <<EOF
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
DATABASE_URL=file:/opt/firewallaudit/data/db.sqlite
EOF
chmod 600 /opt/firewallaudit/.env
msg_ok "Environment configured"

msg_info "Creating data directory"
mkdir -p /opt/firewallaudit/data
chmod 755 /opt/firewallaudit/data
msg_ok "Data directory created"

msg_info "Creating systemd service"
cat > /etc/systemd/system/firewallaudit.service <<EOF
[Unit]
Description=FirewallAudit - Firewall Rule Auditing Tool
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/firewallaudit
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now firewallaudit
msg_ok "Service created and started"

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleanup complete"

msg_ok "FirewallAudit installation complete"
echo ""
echo "Access the web interface at: http://$(hostname -I | awk '{print $1}'):3000"
echo "Credentials stored in: /opt/firewallaudit/.credentials"
