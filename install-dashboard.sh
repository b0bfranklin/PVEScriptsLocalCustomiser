#!/usr/bin/env bash

# PVEScriptsLocal Customiser - Dashboard Installer
#
# Copyright (c) 2024-2025 b0bfranklin
# License: MIT
#
# This script installs the PVEScriptsLocal Customiser web dashboard
# which allows importing scripts from GitHub, community-scripts, and selfh.st

set -euo pipefail

# Color codes
YW="\e[33m"
GN="\e[32m"
RD="\e[31m"
BL="\e[34m"
CL="\e[0m"

msg_info() { echo -e "${YW}[INFO]${CL} $1"; }
msg_ok() { echo -e "${GN}[SUCCESS]${CL} $1"; }
msg_error() { echo -e "${RD}[ERROR]${CL} $1"; }
msg_header() { echo -e "\n${BL}═══════════════════════════════════════════════════════════${CL}"; echo -e "${BL}  $1${CL}"; echo -e "${BL}═══════════════════════════════════════════════════════════${CL}\n"; }

# Configuration
INSTALL_DIR="/opt/pvescripts-customiser"
DASHBOARD_DIR="${INSTALL_DIR}/web-dashboard"
SERVICE_NAME="pvescripts-customiser"
DASHBOARD_PORT="${DASHBOARD_PORT:-3001}"

msg_header "PVEScriptsLocal Customiser Installer"

# Check for root
if [[ $EUID -ne 0 ]]; then
    msg_error "This script must be run as root"
    exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    OS_NAME="${ID}"
    OS_VERSION="${VERSION_ID}"
    msg_info "Detected OS: ${PRETTY_NAME}"
else
    msg_error "Cannot detect OS"
    exit 1
fi

# Check if PVEScriptsLocal is installed
PVESCRIPTS_PATH="${PVESCRIPTS_PATH:-/opt/ProxmoxVE-Local}"
if [[ ! -d "${PVESCRIPTS_PATH}" ]]; then
    msg_error "PVEScriptsLocal not found at ${PVESCRIPTS_PATH}"
    msg_info "Please install PVEScriptsLocal first from: https://github.com/community-scripts/ProxmoxVE"
    exit 1
fi
msg_ok "Found PVEScriptsLocal at ${PVESCRIPTS_PATH}"

# Install dependencies based on OS
msg_info "Installing dependencies..."

case "${OS_NAME}" in
    debian|ubuntu)
        apt-get update -qq
        apt-get install -y -qq curl git

        # Install Node.js if not present
        if ! command -v node &>/dev/null; then
            msg_info "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y -qq nodejs
        fi
        ;;
    alpine)
        apk update
        apk add --no-cache curl git nodejs npm
        ;;
    *)
        msg_error "Unsupported OS: ${OS_NAME}"
        msg_info "Supported: debian, ubuntu, alpine"
        exit 1
        ;;
esac

NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
msg_ok "Node.js version: ${NODE_VERSION}"

# Create installation directory
msg_info "Creating installation directory..."
mkdir -p "${INSTALL_DIR}"

# Clone or update repository
REPO_URL="https://github.com/b0bfranklin/PVEScriptsLocalCustomiser.git"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
    msg_info "Updating existing installation..."
    cd "${INSTALL_DIR}"
    git pull origin main || git pull origin master
else
    msg_info "Cloning repository..."
    git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

# Install dashboard dependencies
msg_info "Installing dashboard dependencies..."
cd "${DASHBOARD_DIR}"
npm install --production=false

# Build the dashboard
msg_info "Building dashboard..."
npm run build

msg_ok "Dashboard built successfully"

# Create environment file
msg_info "Creating environment configuration..."
cat > "${DASHBOARD_DIR}/.env.local" << EOF
# PVEScriptsLocal Customiser Configuration
PVESCRIPTS_PATH=${PVESCRIPTS_PATH}
PORT=${DASHBOARD_PORT}
EOF

# Create systemd service
msg_info "Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=PVEScriptsLocal Customiser Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${DASHBOARD_DIR}
Environment=NODE_ENV=production
Environment=PORT=${DASHBOARD_PORT}
Environment=PVESCRIPTS_PATH=${PVESCRIPTS_PATH}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
msg_info "Starting service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    msg_ok "Service started successfully"
else
    msg_error "Service failed to start. Check logs with: journalctl -u ${SERVICE_NAME}"
    exit 1
fi

# Run the patch script to add link in PVEScriptsLocal
msg_info "Patching PVEScriptsLocal to add dashboard link..."
if [[ -x "${INSTALL_DIR}/scripts/patch-pvescripts.sh" ]]; then
    bash "${INSTALL_DIR}/scripts/patch-pvescripts.sh"
else
    msg_info "Patch script not found, skipping UI integration"
fi

# Create global update-dashboard command
msg_info "Installing update-dashboard command..."
chmod +x "${INSTALL_DIR}/update-dashboard.sh"
ln -sf "${INSTALL_DIR}/update-dashboard.sh" /usr/local/bin/update-dashboard
msg_ok "Installed: update-dashboard"

msg_header "Installation Complete!"

# Get IP address
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo -e "${GN}Dashboard URL:${CL} http://${IP_ADDR}:${DASHBOARD_PORT}"
echo ""
echo -e "${YW}Useful commands:${CL}"
echo "  Update:       update-dashboard"
echo "  View logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  Restart:      systemctl restart ${SERVICE_NAME}"
echo "  Stop:         systemctl stop ${SERVICE_NAME}"
echo "  Status:       systemctl status ${SERVICE_NAME}"
echo ""
echo -e "${BL}The dashboard allows you to:${CL}"
echo "  • Browse and import from community-scripts"
echo "  • Browse and import from selfh.st apps directory"
echo "  • Import any GitHub repository"
echo "  • Manage your imported scripts"
echo ""
