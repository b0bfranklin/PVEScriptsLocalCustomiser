#!/bin/bash
# PVEScripts Customiser Dashboard Update Script
#
# Copyright (c) 2024-2025 b0bfranklin
# License: MIT
#
# Usage: update-dashboard [--check]
#   --check   Only check for updates, don't apply them

set -e

INSTALL_DIR="${INSTALL_DIR:-/opt/pvescripts-customiser}"
SERVICE_NAME="pvescripts-customiser"

# Colors
GN="\e[32m"
YW="\e[33m"
RD="\e[31m"
CL="\e[0m"

msg_info() { echo -e "${YW}[INFO]${CL} $1"; }
msg_ok() { echo -e "${GN}[OK]${CL} $1"; }
msg_error() { echo -e "${RD}[ERROR]${CL} $1"; }

# Check if install directory exists
if [ ! -d "$INSTALL_DIR" ]; then
    msg_error "Installation not found at $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Get current version
CURRENT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo ""
echo "=== PVEScripts Customiser Dashboard Updater ==="
echo ""
msg_info "Current commit: $CURRENT ($BRANCH)"

# Fetch latest
msg_info "Checking for updates..."
git fetch origin "$BRANCH" 2>/dev/null

LATEST=$(git rev-parse --short "origin/$BRANCH" 2>/dev/null || echo "unknown")
BEHIND=$(git rev-list HEAD.."origin/$BRANCH" --count 2>/dev/null || echo "0")

if [ "$CURRENT" = "$LATEST" ]; then
    msg_ok "Already up to date!"
    echo ""
    exit 0
fi

msg_info "Update available: $CURRENT -> $LATEST ($BEHIND commit(s) behind)"

# Show latest commit message
LATEST_MSG=$(git log "origin/$BRANCH" -1 --format="%s" 2>/dev/null || echo "")
if [ -n "$LATEST_MSG" ]; then
    echo "       Latest: $LATEST_MSG"
fi
echo ""

# Check-only mode
if [ "$1" = "--check" ]; then
    exit 0
fi

# Confirm update
read -p "Apply update? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    msg_info "Update cancelled"
    exit 0
fi

echo ""

# Pull updates
msg_info "Pulling updates..."
git pull origin "$BRANCH"

# Rebuild dashboard
msg_info "Rebuilding dashboard (this may take a minute)..."
cd "$INSTALL_DIR/web-dashboard"
npm install --production=false 2>/dev/null
npm run build 2>/dev/null

# Restart service
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    msg_info "Restarting service..."
    systemctl restart "$SERVICE_NAME"
    msg_ok "Service restarted!"
elif systemctl list-unit-files 2>/dev/null | grep -q "$SERVICE_NAME"; then
    msg_info "Starting service..."
    systemctl start "$SERVICE_NAME"
    msg_ok "Service started!"
fi

echo ""
msg_ok "Update complete! ($CURRENT -> $LATEST)"
echo ""
