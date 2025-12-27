#!/usr/bin/env bash

# PVEScriptsLocal Post-Update Patcher
#
# Run this after updating PVEScriptsLocal to restore the link
# to the Customiser dashboard.
#
# Copyright (c) 2024-2025 b0bfranklin
# License: MIT

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

# Configuration
PVESCRIPTS_PATH="${PVESCRIPTS_PATH:-/opt/ProxmoxVE-Local}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3001}"
BACKUP_SUFFIX=".pre-customiser-patch"

# Check for root
if [[ $EUID -ne 0 ]]; then
    msg_error "This script must be run as root"
    exit 1
fi

# Check PVEScriptsLocal exists
if [[ ! -d "${PVESCRIPTS_PATH}" ]]; then
    msg_error "PVEScriptsLocal not found at ${PVESCRIPTS_PATH}"
    exit 1
fi

msg_info "Patching PVEScriptsLocal to add dashboard link..."

# The link HTML/JSX to inject
LINK_COMPONENT='<a href={`http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:'"${DASHBOARD_PORT}"'`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-400 hover:text-orange-300 hover:bg-slate-700/50 rounded-lg transition-colors" title="Import custom scripts"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg><span className="hidden lg:inline">Import Scripts</span></a>'

# Marker to identify our patch
PATCH_MARKER="<!-- PVEScriptsLocalCustomiser -->"

# Function to patch a file
patch_file() {
    local file="$1"
    local search_pattern="$2"
    local insert_after="$3"

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    # Check if already patched
    if grep -q "PVEScriptsLocalCustomiser" "$file" 2>/dev/null; then
        msg_info "File already patched: $file"
        return 0
    fi

    # Create backup
    cp "$file" "${file}${BACKUP_SUFFIX}"

    # Try to insert the link
    if grep -q "$search_pattern" "$file"; then
        # Use sed to insert after the pattern
        sed -i "s|${search_pattern}|${search_pattern}\n            ${PATCH_MARKER}\n            ${LINK_COMPONENT}|" "$file"
        msg_ok "Patched: $file"
        return 0
    fi

    return 1
}

# Look for common UI files to patch
PATCHED=false

# Try to find the main layout or navigation component
POSSIBLE_FILES=(
    "${PVESCRIPTS_PATH}/src/app/layout.tsx"
    "${PVESCRIPTS_PATH}/src/components/Layout.tsx"
    "${PVESCRIPTS_PATH}/src/components/Navbar.tsx"
    "${PVESCRIPTS_PATH}/src/components/Header.tsx"
    "${PVESCRIPTS_PATH}/src/components/Navigation.tsx"
    "${PVESCRIPTS_PATH}/src/components/Sidebar.tsx"
    "${PVESCRIPTS_PATH}/app/layout.tsx"
    "${PVESCRIPTS_PATH}/components/Layout.tsx"
)

# Common patterns to search for (places where we can insert a link)
SEARCH_PATTERNS=(
    "</nav>"
    "</header>"
    "className=\".*nav.*\""
    "GitHub"
)

for file in "${POSSIBLE_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        msg_info "Found UI file: $file"

        for pattern in "${SEARCH_PATTERNS[@]}"; do
            if patch_file "$file" "$pattern" "$LINK_COMPONENT"; then
                PATCHED=true
                break 2
            fi
        done
    fi
done

# Alternative approach: Create a simple redirect page
if [[ "$PATCHED" == "false" ]]; then
    msg_info "Could not find standard UI files to patch."
    msg_info "Creating redirect helper page instead..."

    # Create a simple HTML page that can be accessed
    REDIRECT_DIR="${PVESCRIPTS_PATH}/public"
    mkdir -p "$REDIRECT_DIR"

    cat > "${REDIRECT_DIR}/import.html" << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to Import Dashboard...</title>
    <script>
        const port = 3001;
        const host = window.location.hostname;
        window.location.href = `http://${host}:${port}`;
    </script>
    <style>
        body {
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #1e293b;
            color: #f1f5f9;
        }
        .container {
            text-align: center;
        }
        a {
            color: #fb923c;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Redirecting to Import Dashboard...</h2>
        <p>If not redirected, <a href="#" onclick="window.location.href='http://'+window.location.hostname+':3001'">click here</a></p>
    </div>
</body>
</html>
HTMLEOF

    msg_ok "Created redirect page at ${REDIRECT_DIR}/import.html"
    msg_info "Access via: http://<your-ip>:3000/import.html"
    PATCHED=true
fi

# Rebuild if needed
if [[ -f "${PVESCRIPTS_PATH}/package.json" ]]; then
    msg_info "Rebuilding PVEScriptsLocal..."
    cd "${PVESCRIPTS_PATH}"

    if npm run build 2>/dev/null; then
        msg_ok "Build completed"
    else
        msg_info "Build skipped (may not be needed for static files)"
    fi
fi

# Restart PVEScriptsLocal service
if systemctl is-active --quiet pvescriptslocal 2>/dev/null; then
    msg_info "Restarting PVEScriptsLocal service..."
    systemctl restart pvescriptslocal
    msg_ok "Service restarted"
elif systemctl is-active --quiet pve-scripts-local 2>/dev/null; then
    msg_info "Restarting pve-scripts-local service..."
    systemctl restart pve-scripts-local
    msg_ok "Service restarted"
fi

echo ""
msg_ok "Patch complete!"
echo ""
echo -e "Access the import dashboard:"
echo -e "  • Direct:   ${BL}http://<your-ip>:${DASHBOARD_PORT}${CL}"
echo -e "  • Via PVE:  ${BL}http://<your-ip>:3000/import.html${CL}"
echo ""
