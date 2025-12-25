#!/bin/bash
#
# PVEScriptsLocal Custom Importer
# Import custom projects from GitHub/Claude Code repositories
# Supports: Ubuntu 24.04 LTS, Debian 13, Alpine 3.23
#
# Copyright (c) 2024-2025 b0bfranklin
# License: MIT (see LICENSE file)
#
# This tool imports scripts - imported content retains its original license.
#
# Usage: ./pvescripts-import.sh [OPTIONS] <command> [arguments]
#

set -euo pipefail

# Configuration
PVESCRIPTS_DIR="${PVESCRIPTS_DIR:-/opt/ProxmoxVE-Local}"
CUSTOM_SCRIPTS_DIR="${PVESCRIPTS_DIR}/json/custom"
CUSTOM_INSTALL_DIR="${PVESCRIPTS_DIR}/custom-install"
CUSTOM_CT_DIR="${PVESCRIPTS_DIR}/custom-ct"
DATA_DIR="${PVESCRIPTS_DIR}/data"
CONFIG_FILE="${DATA_DIR}/custom-imports.json"
VERSION="1.1.0"

# Import sources
COMMUNITY_SCRIPTS_API="https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/json"
SELFHST_API="https://raw.githubusercontent.com/rocketnova/selfhst-apps/main/data/projects.json"

# Categories (matching PVEScriptsLocal)
declare -A CATEGORIES=(
    [1]="Automation"
    [2]="Database"
    [3]="Development"
    [4]="Docker"
    [5]="File Sharing"
    [6]="Home Automation"
    [7]="Media"
    [8]="Monitoring"
    [9]="Networking"
    [10]="Security"
    [11]="Storage"
    [12]="Utilities"
    [13]="Virtualization"
    [14]="Custom"
    [15]="Proxmox"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$ID"
        OS_VERSION="$VERSION_ID"
        OS_CODENAME="${VERSION_CODENAME:-}"
    elif [ -f /etc/alpine-release ]; then
        OS_NAME="alpine"
        OS_VERSION=$(cat /etc/alpine-release)
    else
        log_error "Unable to detect OS"
        exit 1
    fi

    log_info "Detected OS: $OS_NAME $OS_VERSION"
}

# Install dependencies based on OS
install_dependencies() {
    log_info "Installing dependencies for $OS_NAME..."

    case "$OS_NAME" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq curl git jq wget unzip >/dev/null 2>&1
            ;;
        alpine)
            apk update -q
            apk add --no-cache curl git jq wget unzip bash >/dev/null 2>&1
            ;;
        *)
            log_error "Unsupported OS: $OS_NAME"
            exit 1
            ;;
    esac

    log_success "Dependencies installed"
}

# Check if PVEScriptsLocal is installed
check_pvescripts() {
    if [ ! -d "$PVESCRIPTS_DIR" ]; then
        log_error "PVEScriptsLocal not found at $PVESCRIPTS_DIR"
        log_info "Please install PVEScriptsLocal first or set PVESCRIPTS_DIR"
        exit 1
    fi
    log_success "PVEScriptsLocal found at $PVESCRIPTS_DIR"
}

# Parse GitHub URL
parse_github_url() {
    local url="$1"

    # Support various GitHub URL formats
    # https://github.com/owner/repo
    # https://github.com/owner/repo/tree/branch
    # git@github.com:owner/repo.git

    if [[ "$url" =~ github\.com[:/]([^/]+)/([^/]+) ]]; then
        REPO_OWNER="${BASH_REMATCH[1]}"
        REPO_NAME="${BASH_REMATCH[2]}"
        REPO_NAME="${REPO_NAME%.git}"

        # Extract branch if present
        if [[ "$url" =~ /tree/([^/]+) ]]; then
            REPO_BRANCH="${BASH_REMATCH[1]}"
        else
            REPO_BRANCH="main"
        fi

        log_info "Repository: $REPO_OWNER/$REPO_NAME (branch: $REPO_BRANCH)"
    else
        log_error "Invalid GitHub URL: $url"
        exit 1
    fi
}

# Check for Claude Code manifest
check_manifest() {
    local repo_url="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents"
    local branch_param="?ref=${REPO_BRANCH}"

    log_info "Checking repository for deployment manifest..."

    # Look for pvescripts.json or .pvescripts/manifest.json
    local manifest_locations=(
        "pvescripts.json"
        ".pvescripts/manifest.json"
        "deploy/pvescripts.json"
        ".claude/pvescripts.json"
    )

    for location in "${manifest_locations[@]}"; do
        local response
        response=$(curl -s "${repo_url}/${location}${branch_param}" 2>/dev/null)

        if [[ "$response" != *"Not Found"* ]] && [[ "$response" == *"download_url"* ]]; then
            local download_url
            download_url=$(echo "$response" | jq -r '.download_url')
            MANIFEST_CONTENT=$(curl -s "$download_url")
            MANIFEST_LOCATION="$location"
            log_success "Found manifest at: $location"
            return 0
        fi
    done

    log_warn "No deployment manifest found, will generate from repository"
    return 1
}

# Generate manifest from repository
generate_manifest() {
    log_info "Generating deployment manifest from repository..."

    # Get repository info
    local repo_info
    repo_info=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}")

    local description
    description=$(echo "$repo_info" | jq -r '.description // "Custom imported script"')

    local topics
    topics=$(echo "$repo_info" | jq -r '.topics // []')

    # Detect project type by checking files
    local repo_contents
    repo_contents=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents?ref=${REPO_BRANCH}")

    local project_type="generic"
    local install_script=""
    local resources_cpu=1
    local resources_ram=512
    local resources_hdd=4
    local default_os="debian"
    local default_os_version="13"
    local interface_port=null

    # Check for package.json (Node.js project)
    if echo "$repo_contents" | jq -e '.[] | select(.name == "package.json")' >/dev/null 2>&1; then
        project_type="nodejs"
        resources_ram=1024
        resources_hdd=8
    fi

    # Check for requirements.txt or pyproject.toml (Python project)
    if echo "$repo_contents" | jq -e '.[] | select(.name == "requirements.txt" or .name == "pyproject.toml")' >/dev/null 2>&1; then
        project_type="python"
        resources_ram=1024
    fi

    # Check for Dockerfile
    if echo "$repo_contents" | jq -e '.[] | select(.name == "Dockerfile" or .name == "docker-compose.yml")' >/dev/null 2>&1; then
        project_type="docker"
        resources_ram=2048
        resources_hdd=16
    fi

    # Check for Go project
    if echo "$repo_contents" | jq -e '.[] | select(.name == "go.mod")' >/dev/null 2>&1; then
        project_type="golang"
        resources_ram=1024
    fi

    # Look for existing install scripts
    local install_scripts=("install.sh" "setup.sh" "deploy.sh" "scripts/install.sh")
    for script in "${install_scripts[@]}"; do
        if echo "$repo_contents" | jq -e ".[] | select(.name == \"$(basename "$script")\")" >/dev/null 2>&1; then
            install_script="$script"
            break
        fi
    done

    # Check for web interface (look for common web ports in config)
    if [[ "$project_type" == "nodejs" ]] || [[ "$project_type" == "python" ]]; then
        interface_port=3000
    fi

    # Generate slug from repo name
    local slug
    slug=$(echo "${REPO_NAME}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')

    # Determine category based on topics or project type
    local category=14  # Default to "Other"

    # Create manifest
    MANIFEST_CONTENT=$(cat <<EOF
{
  "name": "${REPO_NAME}",
  "slug": "${slug}",
  "categories": [${category}],
  "date_created": "$(date +%Y-%m-%d)",
  "type": "ct",
  "updateable": true,
  "privileged": false,
  "interface_port": ${interface_port},
  "documentation": "https://github.com/${REPO_OWNER}/${REPO_NAME}#readme",
  "website": "https://github.com/${REPO_OWNER}/${REPO_NAME}",
  "logo": "https://cdn.jsdelivr.net/gh/selfhst/icons/webp/github.webp",
  "description": "${description}",
  "source": {
    "type": "github",
    "owner": "${REPO_OWNER}",
    "repo": "${REPO_NAME}",
    "branch": "${REPO_BRANCH}",
    "project_type": "${project_type}",
    "install_script": "${install_script}"
  },
  "install_methods": [
    {
      "type": "default",
      "script": "custom-ct/${slug}.sh",
      "resources": {
        "cpu": ${resources_cpu},
        "ram": ${resources_ram},
        "hdd": ${resources_hdd},
        "os": "${default_os}",
        "version": "${default_os_version}"
      }
    }
  ],
  "default_credentials": {
    "username": null,
    "password": null
  },
  "notes": [
    {
      "text": "Imported from GitHub: ${REPO_OWNER}/${REPO_NAME}",
      "type": "info"
    },
    {
      "text": "Project type: ${project_type}",
      "type": "info"
    }
  ]
}
EOF
)

    log_success "Generated manifest for $project_type project"
}

# Generate installation script
generate_install_script() {
    local slug
    slug=$(echo "$MANIFEST_CONTENT" | jq -r '.slug')
    local project_type
    project_type=$(echo "$MANIFEST_CONTENT" | jq -r '.source.project_type // "generic"')
    local install_script
    install_script=$(echo "$MANIFEST_CONTENT" | jq -r '.source.install_script // ""')

    log_info "Generating installation script for $slug..."

    mkdir -p "$CUSTOM_CT_DIR"

    local script_path="${CUSTOM_CT_DIR}/${slug}.sh"

    cat > "$script_path" <<'SCRIPT_HEADER'
#!/usr/bin/env bash

# Custom Import Installation Script
# Auto-generated by PVEScriptsLocal Custom Importer

source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing dependencies"
SCRIPT_HEADER

    # Add OS-specific installation commands
    case "$project_type" in
        nodejs)
            cat >> "$script_path" <<'NODEJS_DEPS'
$STD apt-get install -y curl git
msg_ok "Installed base dependencies"

msg_info "Setting up Node.js"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
$STD apt-get install -y nodejs
msg_ok "Node.js installed"

msg_info "Cloning repository"
NODEJS_DEPS
            ;;
        python)
            cat >> "$script_path" <<'PYTHON_DEPS'
$STD apt-get install -y curl git python3 python3-pip python3-venv
msg_ok "Installed Python dependencies"

msg_info "Cloning repository"
PYTHON_DEPS
            ;;
        docker)
            cat >> "$script_path" <<'DOCKER_DEPS'
$STD apt-get install -y curl git ca-certificates gnupg
msg_ok "Installed base dependencies"

msg_info "Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
$STD apt-get update
$STD apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
msg_ok "Docker installed"

msg_info "Cloning repository"
DOCKER_DEPS
            ;;
        golang)
            cat >> "$script_path" <<'GO_DEPS'
$STD apt-get install -y curl git
msg_ok "Installed base dependencies"

msg_info "Installing Go"
GO_VERSION=$(curl -s https://go.dev/VERSION?m=text | head -1)
wget -q "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
tar -C /usr/local -xzf "${GO_VERSION}.linux-amd64.tar.gz"
rm "${GO_VERSION}.linux-amd64.tar.gz"
export PATH=$PATH:/usr/local/go/bin
echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
msg_ok "Go installed"

msg_info "Cloning repository"
GO_DEPS
            ;;
        *)
            cat >> "$script_path" <<'GENERIC_DEPS'
$STD apt-get install -y curl git wget
msg_ok "Installed dependencies"

msg_info "Cloning repository"
GENERIC_DEPS
            ;;
    esac

    # Add clone and install commands
    cat >> "$script_path" <<CLONE_SECTION
cd /opt
git clone -b "${REPO_BRANCH}" "https://github.com/${REPO_OWNER}/${REPO_NAME}.git" "${slug}"
cd "/opt/${slug}"
msg_ok "Repository cloned"
CLONE_SECTION

    # Add project-specific build commands
    case "$project_type" in
        nodejs)
            cat >> "$script_path" <<'NODEJS_BUILD'

msg_info "Installing Node.js dependencies"
$STD npm install
if [ -f "package.json" ] && grep -q '"build"' package.json; then
    msg_info "Building application"
    $STD npm run build
fi
msg_ok "Application built"
NODEJS_BUILD
            ;;
        python)
            cat >> "$script_path" <<'PYTHON_BUILD'

msg_info "Setting up Python environment"
python3 -m venv venv
source venv/bin/activate
if [ -f "requirements.txt" ]; then
    $STD pip install -r requirements.txt
fi
if [ -f "pyproject.toml" ]; then
    $STD pip install .
fi
msg_ok "Python environment configured"
PYTHON_BUILD
            ;;
        docker)
            cat >> "$script_path" <<'DOCKER_BUILD'

msg_info "Building Docker containers"
if [ -f "docker-compose.yml" ]; then
    $STD docker compose build
    $STD docker compose up -d
else
    $STD docker build -t app .
    $STD docker run -d --name app --restart unless-stopped app
fi
msg_ok "Docker containers running"
DOCKER_BUILD
            ;;
        golang)
            cat >> "$script_path" <<'GO_BUILD'

msg_info "Building Go application"
$STD go build -o app .
msg_ok "Application built"
GO_BUILD
            ;;
    esac

    # Check if there's a custom install script
    if [ -n "$install_script" ] && [ "$install_script" != "null" ]; then
        cat >> "$script_path" <<CUSTOM_INSTALL

msg_info "Running custom install script"
if [ -f "${install_script}" ]; then
    chmod +x "${install_script}"
    $STD ./${install_script}
fi
msg_ok "Custom installation complete"
CUSTOM_INSTALL
    fi

    # Add systemd service for nodejs and python
    if [[ "$project_type" == "nodejs" ]] || [[ "$project_type" == "python" ]] || [[ "$project_type" == "golang" ]]; then
        cat >> "$script_path" <<SERVICE_SECTION

msg_info "Creating systemd service"
cat > /etc/systemd/system/${slug}.service <<EOF
[Unit]
Description=${REPO_NAME}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/${slug}
SERVICE_SECTION

        case "$project_type" in
            nodejs)
                cat >> "$script_path" <<'NODEJS_SERVICE'
ExecStart=/usr/bin/npm start
NODEJS_SERVICE
                ;;
            python)
                cat >> "$script_path" <<'PYTHON_SERVICE'
ExecStart=/opt/${slug}/venv/bin/python -m app
PYTHON_SERVICE
                ;;
            golang)
                cat >> "$script_path" <<'GO_SERVICE'
ExecStart=/opt/${slug}/app
GO_SERVICE
                ;;
        esac

        cat >> "$script_path" <<'SERVICE_END'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ${slug}
msg_ok "Service created and started"
SERVICE_END
    fi

    # Add cleanup and finish
    cat >> "$script_path" <<'SCRIPT_FOOTER'

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleaned"
SCRIPT_FOOTER

    chmod +x "$script_path"
    log_success "Installation script created: $script_path"
}

# Save manifest to PVEScriptsLocal
save_manifest() {
    local slug
    slug=$(echo "$MANIFEST_CONTENT" | jq -r '.slug')

    log_info "Saving manifest to PVEScriptsLocal..."

    mkdir -p "$CUSTOM_SCRIPTS_DIR"

    local manifest_path="${CUSTOM_SCRIPTS_DIR}/${slug}.json"
    echo "$MANIFEST_CONTENT" | jq '.' > "$manifest_path"

    log_success "Manifest saved: $manifest_path"

    # Update custom imports registry
    update_registry "$slug"
}

# Update custom imports registry
update_registry() {
    local slug="$1"

    mkdir -p "$DATA_DIR"

    if [ ! -f "$CONFIG_FILE" ]; then
        echo '{"imports": [], "last_updated": ""}' > "$CONFIG_FILE"
    fi

    local import_entry
    import_entry=$(cat <<EOF
{
  "slug": "${slug}",
  "source": "https://github.com/${REPO_OWNER}/${REPO_NAME}",
  "branch": "${REPO_BRANCH}",
  "imported_at": "$(date -Iseconds)",
  "version": "$(git ls-remote "https://github.com/${REPO_OWNER}/${REPO_NAME}" "${REPO_BRANCH}" 2>/dev/null | cut -f1 | head -c8 || echo 'unknown')"
}
EOF
)

    # Add or update import entry
    local updated_config
    updated_config=$(jq --argjson entry "$import_entry" '
        .imports = [.imports[] | select(.slug != $entry.slug)] + [$entry] |
        .last_updated = now | todate
    ' "$CONFIG_FILE")

    echo "$updated_config" > "$CONFIG_FILE"
    log_success "Registry updated"
}

# Trigger PVEScriptsLocal rebuild
trigger_rebuild() {
    log_info "Triggering PVEScriptsLocal rebuild..."

    cd "$PVESCRIPTS_DIR"

    # Check if we need to merge custom JSON files
    if [ -d "$CUSTOM_SCRIPTS_DIR" ] && [ "$(ls -A "$CUSTOM_SCRIPTS_DIR" 2>/dev/null)" ]; then
        # Create a combined category for custom scripts if needed
        log_info "Merging custom scripts into PVEScriptsLocal..."

        # Copy custom JSON files to main json directory with prefix
        for json_file in "$CUSTOM_SCRIPTS_DIR"/*.json; do
            if [ -f "$json_file" ]; then
                local filename
                filename=$(basename "$json_file")
                cp "$json_file" "${PVESCRIPTS_DIR}/json/custom-${filename}"
            fi
        done
    fi

    # Rebuild the application
    if [ -f "${PVESCRIPTS_DIR}/package.json" ]; then
        log_info "Rebuilding application..."
        npm run build 2>/dev/null || log_warn "Rebuild may have issues, check manually"
    fi

    # Restart the service
    if systemctl is-active --quiet pvescriptslocal 2>/dev/null; then
        log_info "Restarting PVEScriptsLocal service..."
        systemctl restart pvescriptslocal
        log_success "Service restarted"
    fi
}

# List imported scripts
list_imports() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_info "No custom imports found"
        return
    fi

    echo ""
    echo -e "${CYAN}=== Custom Imported Scripts ===${NC}"
    echo ""

    jq -r '.imports[] | "  \(.slug)\n    Source: \(.source)\n    Branch: \(.branch)\n    Imported: \(.imported_at)\n"' "$CONFIG_FILE"
}

# Remove imported script
remove_import() {
    local slug="$1"

    log_info "Removing import: $slug"

    # Remove JSON manifest
    rm -f "${CUSTOM_SCRIPTS_DIR}/${slug}.json"
    rm -f "${PVESCRIPTS_DIR}/json/custom-${slug}.json"

    # Remove installation script
    rm -f "${CUSTOM_CT_DIR}/${slug}.sh"

    # Update registry
    if [ -f "$CONFIG_FILE" ]; then
        jq --arg slug "$slug" '.imports = [.imports[] | select(.slug != $slug)]' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
        mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    fi

    log_success "Import removed: $slug"

    trigger_rebuild
}

# Update an imported script
update_import() {
    local slug="$1"

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "No imports found"
        exit 1
    fi

    local import_info
    import_info=$(jq -r --arg slug "$slug" '.imports[] | select(.slug == $slug)' "$CONFIG_FILE")

    if [ -z "$import_info" ]; then
        log_error "Import not found: $slug"
        exit 1
    fi

    local source_url
    source_url=$(echo "$import_info" | jq -r '.source')
    local branch
    branch=$(echo "$import_info" | jq -r '.branch')

    log_info "Updating import: $slug from $source_url (branch: $branch)"

    # Re-import
    GITHUB_URL="${source_url}/tree/${branch}"
    import_from_github "$GITHUB_URL"
}

# Main import function
import_from_github() {
    local url="$1"

    parse_github_url "$url"

    # Check for existing manifest or generate one
    if ! check_manifest; then
        generate_manifest
    fi

    # Generate installation script
    generate_install_script

    # Save manifest
    save_manifest

    # Trigger rebuild
    trigger_rebuild

    echo ""
    log_success "Import complete!"
    echo ""
    echo -e "${CYAN}Script Details:${NC}"
    echo "$MANIFEST_CONTENT" | jq -r '"  Name: \(.name)\n  Slug: \(.slug)\n  Type: \(.source.project_type // "generic")\n  Port: \(.interface_port // "N/A")"'
    echo ""
    echo -e "${CYAN}To deploy this script:${NC}"
    echo "  1. Open PVEScriptsLocal web interface"
    echo "  2. Navigate to the 'Custom' category"
    echo "  3. Select '$(echo "$MANIFEST_CONTENT" | jq -r '.name')'"
    echo ""
}

# Show available categories
show_categories() {
    echo ""
    echo -e "${CYAN}Available Categories:${NC}"
    echo ""
    for id in $(echo "${!CATEGORIES[@]}" | tr ' ' '\n' | sort -n); do
        echo "  $id: ${CATEGORIES[$id]}"
    done
    echo ""
}

# Set category for import
set_category() {
    local category_id="$1"

    if [[ -z "${CATEGORIES[$category_id]:-}" ]]; then
        log_error "Invalid category ID: $category_id"
        show_categories
        exit 1
    fi

    IMPORT_CATEGORY="$category_id"
    log_info "Using category: ${CATEGORIES[$category_id]} (ID: $category_id)"
}

# Browse community-scripts
browse_community_scripts() {
    log_info "Fetching scripts from community-scripts.github.io..."

    local scripts_list
    scripts_list=$(curl -s "https://api.github.com/repos/community-scripts/ProxmoxVE/contents/json" 2>/dev/null)

    if [ -z "$scripts_list" ] || [[ "$scripts_list" == *"Not Found"* ]]; then
        log_error "Failed to fetch community scripts"
        exit 1
    fi

    echo ""
    echo -e "${CYAN}=== Community Scripts (Proxmox VE Helper-Scripts) ===${NC}"
    echo ""
    echo "Available scripts (showing first 50):"
    echo ""

    echo "$scripts_list" | jq -r '.[0:50] | .[] | select(.name | endswith(".json")) | .name' | sed 's/.json$//' | column

    echo ""
    echo -e "${YELLOW}To import a community script:${NC}"
    echo "  pvescripts-import community-import <script-name>"
    echo ""
    echo -e "${YELLOW}To search for a script:${NC}"
    echo "  pvescripts-import community-search <keyword>"
    echo ""
}

# Search community scripts
search_community_scripts() {
    local keyword="$1"

    log_info "Searching community scripts for: $keyword"

    local scripts_list
    scripts_list=$(curl -s "https://api.github.com/repos/community-scripts/ProxmoxVE/contents/json" 2>/dev/null)

    echo ""
    echo -e "${CYAN}=== Search Results for '$keyword' ===${NC}"
    echo ""

    echo "$scripts_list" | jq -r --arg kw "$keyword" '.[] | select(.name | ascii_downcase | contains($kw | ascii_downcase)) | select(.name | endswith(".json")) | .name' | sed 's/.json$//'
    echo ""
}

# Import from community-scripts
import_community_script() {
    local script_name="$1"

    log_info "Importing community script: $script_name"

    # Fetch the script JSON
    local script_url="${COMMUNITY_SCRIPTS_API}/${script_name}.json"
    local script_json
    script_json=$(curl -s "$script_url" 2>/dev/null)

    if [ -z "$script_json" ] || [[ "$script_json" == *"404"* ]]; then
        log_error "Script not found: $script_name"
        exit 1
    fi

    # The community script JSON is already in the right format
    MANIFEST_CONTENT="$script_json"

    # Add source tracking
    MANIFEST_CONTENT=$(echo "$MANIFEST_CONTENT" | jq '. + {
        "source": {
            "type": "community-scripts",
            "script": "'"$script_name"'",
            "url": "'"$script_url"'"
        }
    }')

    # Save manifest (scripts are already on the main repo, just need the JSON)
    save_manifest

    # Update registry
    local slug
    slug=$(echo "$MANIFEST_CONTENT" | jq -r '.slug')

    mkdir -p "$DATA_DIR"
    if [ ! -f "$CONFIG_FILE" ]; then
        echo '{"imports": [], "last_updated": ""}' > "$CONFIG_FILE"
    fi

    local import_entry
    import_entry=$(cat <<EOF
{
  "slug": "${slug}",
  "source": "community-scripts",
  "script_name": "${script_name}",
  "imported_at": "$(date -Iseconds)"
}
EOF
)

    jq --argjson entry "$import_entry" '
        .imports = [.imports[] | select(.slug != $entry.slug)] + [$entry] |
        .last_updated = now | todate
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

    trigger_rebuild

    echo ""
    log_success "Community script imported: $script_name"
    echo ""
    echo "$MANIFEST_CONTENT" | jq -r '"  Name: \(.name)\n  Slug: \(.slug)\n  Category: \(.categories[0] // "N/A")"'
    echo ""
}

# Browse selfh.st apps
browse_selfhst() {
    log_info "Fetching apps from selfh.st..."

    local apps_json
    apps_json=$(curl -s "$SELFHST_API" 2>/dev/null)

    if [ -z "$apps_json" ]; then
        log_error "Failed to fetch selfh.st apps"
        exit 1
    fi

    echo ""
    echo -e "${CYAN}=== selfh.st Apps Directory ===${NC}"
    echo ""
    echo "Popular self-hosted apps (showing top 30 by stars):"
    echo ""

    echo "$apps_json" | jq -r 'sort_by(-.stars) | .[0:30] | .[] | "\(.name) (\(.stars) stars) - \(.repo // "no repo")"'

    echo ""
    echo -e "${YELLOW}To import a selfh.st app:${NC}"
    echo "  pvescripts-import selfhst-import <app-name>"
    echo ""
    echo -e "${YELLOW}To search:${NC}"
    echo "  pvescripts-import selfhst-search <keyword>"
    echo ""
}

# Search selfh.st apps
search_selfhst() {
    local keyword="$1"

    log_info "Searching selfh.st for: $keyword"

    local apps_json
    apps_json=$(curl -s "$SELFHST_API" 2>/dev/null)

    echo ""
    echo -e "${CYAN}=== selfh.st Search Results for '$keyword' ===${NC}"
    echo ""

    echo "$apps_json" | jq -r --arg kw "$keyword" '[.[] | select(.name | ascii_downcase | contains($kw | ascii_downcase))] | sort_by(-.stars) | .[] | "\(.name) (\(.stars) stars) - \(.repo // "no repo")"'
    echo ""
}

# Import from selfh.st
import_selfhst() {
    local app_name="$1"

    log_info "Importing selfh.st app: $app_name"

    local apps_json
    apps_json=$(curl -s "$SELFHST_API" 2>/dev/null)

    local app_info
    app_info=$(echo "$apps_json" | jq --arg name "$app_name" '.[] | select(.name | ascii_downcase == ($name | ascii_downcase))')

    if [ -z "$app_info" ]; then
        log_error "App not found: $app_name"
        log_info "Try: pvescripts-import selfhst-search $app_name"
        exit 1
    fi

    # Extract GitHub URL from app info
    local repo_url
    repo_url=$(echo "$app_info" | jq -r '.repo // empty')

    if [ -z "$repo_url" ] || [ "$repo_url" == "null" ]; then
        log_error "No GitHub repository found for: $app_name"
        exit 1
    fi

    log_info "Found repository: $repo_url"

    # Import using the GitHub importer
    import_from_github "$repo_url"
}

# Show usage
usage() {
    cat <<EOF
PVEScriptsLocal Custom Importer v${VERSION}

Usage: $(basename "$0") [OPTIONS] <command> [arguments]

Commands:
  import <github-url>      Import a GitHub repository
  list                     List all imported scripts
  remove <slug>            Remove an imported script
  update <slug>            Update an imported script
  update-all               Update all imported scripts

  community-browse         Browse community-scripts.github.io
  community-search <term>  Search community scripts
  community-import <name>  Import a community script by name

  selfhst-browse           Browse selfh.st apps directory
  selfhst-search <term>    Search selfh.st apps
  selfhst-import <name>    Import a selfh.st app by name

  categories               Show available categories

Options:
  -h, --help              Show this help message
  -v, --version           Show version
  -c, --category <id>     Set category for import (default: 14 = Custom)
  --no-rebuild            Skip PVEScriptsLocal rebuild after import

Supported OS: Ubuntu 24.04 LTS, Debian 13, Alpine 3.23

Examples:
  $(basename "$0") import https://github.com/user/repo
  $(basename "$0") import -c 8 https://github.com/user/monitoring-app
  $(basename "$0") community-browse
  $(basename "$0") community-import adguard
  $(basename "$0") selfhst-search nextcloud
  $(basename "$0") list

Environment Variables:
  PVESCRIPTS_DIR    PVEScriptsLocal installation directory (default: /opt/ProxmoxVE-Local)

License:
  MIT License - This tool only. Imported content retains its original license.

EOF
}

# Main
main() {
    if [ $# -eq 0 ]; then
        usage
        exit 0
    fi

    local SKIP_REBUILD=false

    # Parse global options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--version)
                echo "PVEScriptsLocal Custom Importer v${VERSION}"
                exit 0
                ;;
            --no-rebuild)
                SKIP_REBUILD=true
                shift
                ;;
            -c|--category)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing category ID"
                    show_categories
                    exit 1
                fi
                set_category "$1"
                shift
                ;;
            import)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing GitHub URL"
                    exit 1
                fi
                detect_os
                install_dependencies
                check_pvescripts
                import_from_github "$1"
                exit 0
                ;;
            list)
                list_imports
                exit 0
                ;;
            remove)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing script slug"
                    exit 1
                fi
                remove_import "$1"
                exit 0
                ;;
            update)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing script slug"
                    exit 1
                fi
                detect_os
                install_dependencies
                check_pvescripts
                update_import "$1"
                exit 0
                ;;
            update-all)
                detect_os
                install_dependencies
                check_pvescripts
                if [ -f "$CONFIG_FILE" ]; then
                    for slug in $(jq -r '.imports[].slug' "$CONFIG_FILE"); do
                        update_import "$slug"
                    done
                else
                    log_info "No imports to update"
                fi
                exit 0
                ;;
            categories)
                show_categories
                exit 0
                ;;
            community-browse)
                install_dependencies
                browse_community_scripts
                exit 0
                ;;
            community-search)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing search term"
                    exit 1
                fi
                install_dependencies
                search_community_scripts "$1"
                exit 0
                ;;
            community-import)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing script name"
                    exit 1
                fi
                detect_os
                install_dependencies
                check_pvescripts
                import_community_script "$1"
                exit 0
                ;;
            selfhst-browse)
                install_dependencies
                browse_selfhst
                exit 0
                ;;
            selfhst-search)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing search term"
                    exit 1
                fi
                install_dependencies
                search_selfhst "$1"
                exit 0
                ;;
            selfhst-import)
                shift
                if [ $# -eq 0 ]; then
                    log_error "Missing app name"
                    exit 1
                fi
                detect_os
                install_dependencies
                check_pvescripts
                import_selfhst "$1"
                exit 0
                ;;
            *)
                log_error "Unknown command: $1"
                usage
                exit 1
                ;;
        esac
    done
}

main "$@"
