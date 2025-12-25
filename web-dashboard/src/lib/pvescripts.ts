/**
 * PVEScriptsLocal Integration Library
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { readFile, writeFile, readdir, mkdir, unlink, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

// Default PVEScriptsLocal installation path
const PVESCRIPTS_PATH = process.env.PVESCRIPTS_PATH || '/opt/ProxmoxVE-Local'
const IMPORTS_FILE = join(PVESCRIPTS_PATH, 'json', '.pvescripts-imports.json')

export interface ScriptManifest {
  name: string
  slug: string
  categories: number[]
  date_created: string
  type: string
  updateable: boolean
  privileged: boolean
  interface_port: number | null
  documentation: string | null
  website: string | null
  logo: string | null
  description: string
  install_methods: InstallMethod[]
  default_credentials: {
    username: string | null
    password: string | null
  }
  notes: Note[]
}

interface InstallMethod {
  type: string
  script: string
  resources: {
    cpu: number
    ram: number
    hdd: number
    os: string
    version: string | number
  }
}

interface Note {
  text: string
  type: string
}

export interface ImportRecord {
  slug: string
  name: string
  source: string
  sourceType: 'github' | 'community-scripts' | 'selfhst'
  importedAt: string
  category?: string
  manifestPath?: string
}

interface ImportsData {
  imports: ImportRecord[]
}

export async function checkPVEScriptsExists(): Promise<boolean> {
  try {
    await access(PVESCRIPTS_PATH, constants.R_OK | constants.W_OK)
    return true
  } catch {
    return false
  }
}

export async function getJsonPath(): Promise<string> {
  return join(PVESCRIPTS_PATH, 'json')
}

export async function getInstallScriptsPath(): Promise<string> {
  return join(PVESCRIPTS_PATH, 'install')
}

export async function loadImports(): Promise<ImportRecord[]> {
  try {
    const data = await readFile(IMPORTS_FILE, 'utf-8')
    const parsed: ImportsData = JSON.parse(data)
    return parsed.imports || []
  } catch {
    return []
  }
}

export async function saveImports(imports: ImportRecord[]): Promise<void> {
  const jsonPath = join(PVESCRIPTS_PATH, 'json')
  try {
    await access(jsonPath, constants.W_OK)
  } catch {
    await mkdir(jsonPath, { recursive: true })
  }
  await writeFile(IMPORTS_FILE, JSON.stringify({ imports }, null, 2))
}

export async function addImport(record: ImportRecord): Promise<void> {
  const imports = await loadImports()
  const existing = imports.findIndex(i => i.slug === record.slug)
  if (existing >= 0) {
    imports[existing] = record
  } else {
    imports.push(record)
  }
  await saveImports(imports)
}

export async function removeImport(slug: string): Promise<boolean> {
  const imports = await loadImports()
  const filtered = imports.filter(i => i.slug !== slug)
  if (filtered.length === imports.length) {
    return false
  }
  await saveImports(filtered)
  return true
}

export async function getImportBySlug(slug: string): Promise<ImportRecord | null> {
  const imports = await loadImports()
  return imports.find(i => i.slug === slug) || null
}

export async function writeManifest(manifest: ScriptManifest): Promise<string> {
  const jsonPath = await getJsonPath()
  const filePath = join(jsonPath, `${manifest.slug}.json`)
  await writeFile(filePath, JSON.stringify(manifest, null, 2))
  return filePath
}

export async function deleteManifest(slug: string): Promise<boolean> {
  const jsonPath = await getJsonPath()
  const filePath = join(jsonPath, `${slug}.json`)
  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}

export async function writeInstallScript(slug: string, content: string): Promise<string> {
  const installPath = await getInstallScriptsPath()
  try {
    await access(installPath, constants.W_OK)
  } catch {
    await mkdir(installPath, { recursive: true })
  }
  const filePath = join(installPath, `${slug}-install.sh`)
  await writeFile(filePath, content, { mode: 0o755 })
  return filePath
}

export async function deleteInstallScript(slug: string): Promise<boolean> {
  const installPath = await getInstallScriptsPath()
  const filePath = join(installPath, `${slug}-install.sh`)
  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

export async function detectProjectType(repoFiles: string[]): Promise<{
  type: string
  port: number | null
}> {
  const fileSet = new Set(repoFiles.map(f => f.toLowerCase()))

  if (fileSet.has('package.json')) {
    return { type: 'nodejs', port: 3000 }
  }
  if (fileSet.has('requirements.txt') || fileSet.has('pyproject.toml') || fileSet.has('setup.py')) {
    return { type: 'python', port: 8000 }
  }
  if (fileSet.has('docker-compose.yml') || fileSet.has('docker-compose.yaml') || fileSet.has('dockerfile')) {
    return { type: 'docker', port: null }
  }
  if (fileSet.has('go.mod')) {
    return { type: 'golang', port: 8080 }
  }
  if (fileSet.has('cargo.toml')) {
    return { type: 'rust', port: 8080 }
  }

  return { type: 'generic', port: null }
}

export function generateInstallScript(
  name: string,
  slug: string,
  projectType: string,
  repoUrl: string,
  port: number | null
): string {
  const baseScript = `#!/usr/bin/env bash

# ${name} Installation Script
# Generated by PVEScriptsLocal Customiser
# Source: ${repoUrl}

set -euo pipefail

# Color codes
YW="\e[33m"
GN="\e[32m"
RD="\e[31m"
CL="\e[0m"

msg_info() { echo -e "\${YW}[INFO]\${CL} \$1"; }
msg_ok() { echo -e "\${GN}[SUCCESS]\${CL} \$1"; }
msg_error() { echo -e "\${RD}[ERROR]\${CL} \$1"; }

APP_NAME="${name}"
APP_DIR="/opt/${slug}"
REPO_URL="${repoUrl}"

msg_info "Installing \${APP_NAME}..."

# Create app directory
mkdir -p "\${APP_DIR}"
cd "\${APP_DIR}"

# Clone repository
if command -v git &>/dev/null; then
  git clone "\${REPO_URL}" . || git pull
else
  msg_error "Git not found. Please install git."
  exit 1
fi

`

  const typeSpecificScript = getTypeSpecificInstall(projectType, port, slug)

  return baseScript + typeSpecificScript
}

function getTypeSpecificInstall(projectType: string, port: number | null, slug: string): string {
  switch (projectType) {
    case 'nodejs':
      return `
# Install Node.js dependencies
if command -v npm &>/dev/null; then
  npm install --production
  npm run build 2>/dev/null || true
else
  msg_error "npm not found. Please install Node.js."
  exit 1
fi

# Create systemd service
cat > /etc/systemd/system/${slug}.service << 'EOF'
[Unit]
Description=${slug}
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/${slug}
ExecStart=/usr/bin/npm start
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${slug}
systemctl start ${slug}

msg_ok "${slug} installed successfully!"
${port ? `msg_info "Application available on port ${port}"` : ''}
`
    case 'python':
      return `
# Install Python dependencies
if command -v python3 &>/dev/null; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt 2>/dev/null || pip install .
else
  msg_error "Python3 not found. Please install Python."
  exit 1
fi

# Create systemd service
cat > /etc/systemd/system/${slug}.service << 'EOF'
[Unit]
Description=${slug}
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/${slug}
ExecStart=/opt/${slug}/venv/bin/python -m ${slug}
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${slug}
systemctl start ${slug}

msg_ok "${slug} installed successfully!"
${port ? `msg_info "Application available on port ${port}"` : ''}
`
    case 'docker':
      return `
# Start with Docker Compose
if command -v docker &>/dev/null; then
  docker compose up -d
else
  msg_error "Docker not found. Please install Docker."
  exit 1
fi

msg_ok "${slug} installed successfully!"
msg_info "Container started with docker compose"
`
    default:
      return `
msg_ok "${slug} cloned successfully!"
msg_info "Please check the repository README for additional setup instructions."
`
  }
}

export const CATEGORIES = [
  { id: 0, name: 'Proxmox VE Tools' },
  { id: 1, name: 'Databases' },
  { id: 2, name: 'Docker' },
  { id: 3, name: 'OS' },
  { id: 4, name: 'Home Automation' },
  { id: 5, name: 'Media' },
  { id: 6, name: 'Monitoring' },
  { id: 7, name: 'Networking' },
  { id: 8, name: 'Misc' },
  { id: 9, name: 'NAS' },
  { id: 10, name: 'File Sharing' },
  { id: 11, name: 'Remote Desktop' },
  { id: 12, name: 'SMB' },
  { id: 13, name: 'Server' },
  { id: 14, name: 'Custom' },
] as const
