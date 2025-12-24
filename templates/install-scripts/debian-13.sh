#!/usr/bin/env bash
#
# PVEScriptsLocal Custom Install Script Template - Debian 13
# This template is used for generating installation scripts for custom imports
#

source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

# ============================================================
# DEPENDENCY INSTALLATION
# ============================================================

msg_info "Installing base dependencies"
$STD apt-get update
$STD apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    build-essential
msg_ok "Base dependencies installed"

# ============================================================
# PROJECT TYPE SPECIFIC INSTALLATION
# Uncomment the section matching your project type
# ============================================================

# --- Node.js Project ---
# msg_info "Installing Node.js 24.x"
# curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
# $STD apt-get install -y nodejs
# msg_ok "Node.js installed: $(node --version)"

# --- Python Project ---
# msg_info "Installing Python 3"
# $STD apt-get install -y python3 python3-pip python3-venv python3-dev
# msg_ok "Python installed: $(python3 --version)"

# --- Docker Project ---
# msg_info "Installing Docker"
# install -m 0755 -d /etc/apt/keyrings
# curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
# chmod a+r /etc/apt/keyrings/docker.gpg
# echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian trixie stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
# $STD apt-get update
# $STD apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# msg_ok "Docker installed"

# --- Go Project ---
# msg_info "Installing Go"
# GO_VERSION=$(curl -s https://go.dev/VERSION?m=text | head -1)
# wget -q "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
# tar -C /usr/local -xzf "${GO_VERSION}.linux-amd64.tar.gz"
# rm "${GO_VERSION}.linux-amd64.tar.gz"
# echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
# source /etc/profile
# msg_ok "Go installed: $(go version)"

# ============================================================
# APPLICATION INSTALLATION
# ============================================================

APP_NAME="{{APP_NAME}}"
APP_SLUG="{{APP_SLUG}}"
REPO_URL="{{REPO_URL}}"
REPO_BRANCH="{{REPO_BRANCH}}"
INSTALL_DIR="/opt/${APP_SLUG}"

msg_info "Cloning repository"
cd /opt
git clone -b "${REPO_BRANCH}" "${REPO_URL}" "${APP_SLUG}"
cd "${INSTALL_DIR}"
msg_ok "Repository cloned to ${INSTALL_DIR}"

# --- Node.js Build ---
# msg_info "Installing npm dependencies"
# $STD npm install --production
# if [ -f "package.json" ] && grep -q '"build"' package.json; then
#     msg_info "Building application"
#     $STD npm run build
# fi
# msg_ok "Application built"

# --- Python Setup ---
# msg_info "Setting up Python virtual environment"
# python3 -m venv venv
# source venv/bin/activate
# if [ -f "requirements.txt" ]; then
#     $STD pip install -r requirements.txt
# fi
# if [ -f "pyproject.toml" ]; then
#     $STD pip install .
# fi
# msg_ok "Python environment configured"

# --- Docker Compose ---
# msg_info "Starting Docker containers"
# if [ -f "docker-compose.yml" ]; then
#     $STD docker compose up -d
# fi
# msg_ok "Containers running"

# ============================================================
# SYSTEMD SERVICE
# ============================================================

msg_info "Creating systemd service"
cat > /etc/systemd/system/${APP_SLUG}.service <<EOF
[Unit]
Description=${APP_NAME}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
# For Node.js:
# ExecStart=/usr/bin/npm start
# For Python:
# ExecStart=${INSTALL_DIR}/venv/bin/python -m app
# For Go:
# ExecStart=${INSTALL_DIR}/app
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ${APP_SLUG}
msg_ok "Service created and started"

# ============================================================
# FINALIZATION
# ============================================================

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleanup complete"

msg_ok "Installation of ${APP_NAME} complete"
