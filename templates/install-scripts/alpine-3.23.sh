#!/usr/bin/env bash
#
# PVEScriptsLocal Custom Install Script Template - Alpine 3.23
# This template is used for generating installation scripts for custom imports
# Alpine uses a minimal footprint - ideal for lightweight deployments
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
apk update
apk add --no-cache \
    curl \
    wget \
    git \
    ca-certificates \
    bash \
    openssl
msg_ok "Base dependencies installed"

# ============================================================
# PROJECT TYPE SPECIFIC INSTALLATION
# Uncomment the section matching your project type
# ============================================================

# --- Node.js Project ---
# msg_info "Installing Node.js"
# apk add --no-cache nodejs npm
# msg_ok "Node.js installed: $(node --version)"

# --- Python Project ---
# msg_info "Installing Python 3"
# apk add --no-cache python3 py3-pip py3-virtualenv
# msg_ok "Python installed: $(python3 --version)"

# --- Docker Project ---
# msg_info "Installing Docker"
# apk add --no-cache docker docker-cli-compose
# rc-update add docker boot
# service docker start
# msg_ok "Docker installed"

# --- Go Project ---
# msg_info "Installing Go"
# apk add --no-cache go
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
mkdir -p /opt
cd /opt
git clone -b "${REPO_BRANCH}" "${REPO_URL}" "${APP_SLUG}"
cd "${INSTALL_DIR}"
msg_ok "Repository cloned to ${INSTALL_DIR}"

# --- Node.js Build ---
# msg_info "Installing npm dependencies"
# npm install --production 2>&1 | tail -1
# if [ -f "package.json" ] && grep -q '"build"' package.json; then
#     msg_info "Building application"
#     npm run build 2>&1 | tail -1
# fi
# msg_ok "Application built"

# --- Python Setup ---
# msg_info "Setting up Python virtual environment"
# python3 -m venv venv
# source venv/bin/activate
# if [ -f "requirements.txt" ]; then
#     pip install -r requirements.txt 2>&1 | tail -1
# fi
# if [ -f "pyproject.toml" ]; then
#     pip install . 2>&1 | tail -1
# fi
# msg_ok "Python environment configured"

# --- Docker Compose ---
# msg_info "Starting Docker containers"
# if [ -f "docker-compose.yml" ]; then
#     docker compose up -d 2>&1 | tail -1
# fi
# msg_ok "Containers running"

# ============================================================
# OPENRC SERVICE (Alpine uses OpenRC instead of systemd)
# ============================================================

msg_info "Creating OpenRC service"
cat > /etc/init.d/${APP_SLUG} <<'INITSCRIPT'
#!/sbin/openrc-run

name="${APP_NAME}"
description="${APP_NAME} service"
command="/usr/bin/npm"
command_args="start"
command_background="yes"
pidfile="/run/${APP_SLUG}.pid"
directory="${INSTALL_DIR}"

depend() {
    need net
    after firewall
}

start_pre() {
    export NODE_ENV=production
    export PORT=3000
}
INITSCRIPT

# Replace placeholders in init script
sed -i "s|\${APP_NAME}|${APP_NAME}|g" /etc/init.d/${APP_SLUG}
sed -i "s|\${INSTALL_DIR}|${INSTALL_DIR}|g" /etc/init.d/${APP_SLUG}
sed -i "s|\${APP_SLUG}|${APP_SLUG}|g" /etc/init.d/${APP_SLUG}

chmod +x /etc/init.d/${APP_SLUG}
rc-update add ${APP_SLUG} default
rc-service ${APP_SLUG} start
msg_ok "Service created and started"

# ============================================================
# FINALIZATION
# ============================================================

motd_ssh
customize

msg_info "Cleaning up"
rm -rf /var/cache/apk/*
msg_ok "Cleanup complete"

msg_ok "Installation of ${APP_NAME} complete"
