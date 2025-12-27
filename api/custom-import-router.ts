/**
 * PVEScriptsLocal Custom Import API Router
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT (see LICENSE file)
 *
 * This file provides the tRPC router for the web interface to import
 * custom scripts from GitHub/Claude Code repositories.
 *
 * IMPORTANT: This tool imports content - imported content retains its
 * original license from the source repository.
 *
 * Add this to your existing PVEScriptsLocal installation by including
 * it in your tRPC router configuration.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const PVESCRIPTS_DIR = process.env.PVESCRIPTS_DIR || '/opt/ProxmoxVE-Local';
const CUSTOM_SCRIPTS_DIR = path.join(PVESCRIPTS_DIR, 'json', 'custom');
const CUSTOM_CT_DIR = path.join(PVESCRIPTS_DIR, 'custom-ct');
const DATA_DIR = path.join(PVESCRIPTS_DIR, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'custom-imports.json');

// Types
interface ImportEntry {
  slug: string;
  source: string;
  branch: string;
  imported_at: string;
  version: string;
}

interface CustomImportsConfig {
  imports: ImportEntry[];
  last_updated: string;
}

interface ManifestSource {
  type: string;
  owner: string;
  repo: string;
  branch: string;
  project_type: string;
  install_script?: string;
}

interface ScriptManifest {
  name: string;
  slug: string;
  categories: number[];
  date_created: string;
  type: string;
  updateable: boolean;
  privileged: boolean;
  interface_port: number | null;
  documentation: string;
  website: string;
  logo: string;
  description: string;
  source: ManifestSource;
  install_methods: Array<{
    type: string;
    script: string;
    resources: {
      cpu: number;
      ram: number;
      hdd: number;
      os: string;
      version: string;
    };
  }>;
  default_credentials: {
    username: string | null;
    password: string | null;
  };
  notes: Array<{
    text: string;
    type: string;
  }>;
}

// Validation schemas
const GitHubUrlSchema = z.string().regex(
  /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+(\/tree\/[\w\/-]+)?$/,
  'Invalid GitHub URL format'
);

const ImportRequestSchema = z.object({
  url: GitHubUrlSchema,
  customName: z.string().optional(),
  customDescription: z.string().optional(),
  customResources: z.object({
    cpu: z.number().min(1).max(16).optional(),
    ram: z.number().min(128).max(32768).optional(),
    hdd: z.number().min(1).max(500).optional(),
    os: z.enum(['debian', 'ubuntu', 'alpine']).optional(),
    version: z.string().optional(),
  }).optional(),
});

// Helper functions
async function ensureDirectories(): Promise<void> {
  await fs.mkdir(CUSTOM_SCRIPTS_DIR, { recursive: true });
  await fs.mkdir(CUSTOM_CT_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function getConfig(): Promise<CustomImportsConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { imports: [], last_updated: '' };
  }
}

async function saveConfig(config: CustomImportsConfig): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/(.+))?/);
  if (!match) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid GitHub URL',
    });
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    branch: match[3] || 'main',
  };
}

async function fetchGitHubApi(endpoint: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PVEScriptsLocal-Importer',
    },
  });

  if (!response.ok) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `GitHub API error: ${response.statusText}`,
    });
  }

  return response.json();
}

async function detectProjectType(owner: string, repo: string, branch: string): Promise<string> {
  try {
    const contents = await fetchGitHubApi(`/repos/${owner}/${repo}/contents?ref=${branch}`) as Array<{ name: string }>;
    const files = contents.map(f => f.name);

    if (files.includes('package.json')) return 'nodejs';
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'python';
    if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) return 'docker';
    if (files.includes('go.mod')) return 'golang';
    if (files.includes('Cargo.toml')) return 'rust';

    return 'generic';
  } catch {
    return 'generic';
  }
}

async function checkForManifest(owner: string, repo: string, branch: string): Promise<ScriptManifest | null> {
  const locations = [
    'pvescripts.json',
    '.pvescripts/manifest.json',
    'deploy/pvescripts.json',
    '.claude/pvescripts.json',
  ];

  for (const location of locations) {
    try {
      const response = await fetchGitHubApi(`/repos/${owner}/${repo}/contents/${location}?ref=${branch}`) as { download_url: string };
      const manifestResponse = await fetch(response.download_url);
      if (manifestResponse.ok) {
        return await manifestResponse.json() as ScriptManifest;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function generateManifest(
  owner: string,
  repo: string,
  branch: string,
  customOptions?: {
    name?: string;
    description?: string;
    resources?: {
      cpu?: number;
      ram?: number;
      hdd?: number;
      os?: string;
      version?: string;
    };
  }
): Promise<ScriptManifest> {
  const repoInfo = await fetchGitHubApi(`/repos/${owner}/${repo}`) as { description: string; topics: string[] };
  const projectType = await detectProjectType(owner, repo, branch);

  const slug = repo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Default resources based on project type
  const defaultResources: Record<string, { cpu: number; ram: number; hdd: number }> = {
    nodejs: { cpu: 1, ram: 1024, hdd: 8 },
    python: { cpu: 1, ram: 1024, hdd: 4 },
    docker: { cpu: 2, ram: 2048, hdd: 16 },
    golang: { cpu: 1, ram: 1024, hdd: 4 },
    rust: { cpu: 2, ram: 2048, hdd: 8 },
    generic: { cpu: 1, ram: 512, hdd: 4 },
  };

  const baseResources = defaultResources[projectType] || defaultResources.generic;

  return {
    name: customOptions?.name || repo,
    slug,
    categories: [14], // Custom category
    date_created: new Date().toISOString().split('T')[0],
    type: 'ct',
    updateable: true,
    privileged: false,
    interface_port: projectType === 'nodejs' ? 3000 : (projectType === 'python' ? 8000 : null),
    documentation: `https://github.com/${owner}/${repo}#readme`,
    website: `https://github.com/${owner}/${repo}`,
    logo: 'https://cdn.jsdelivr.net/gh/selfhst/icons/webp/github.webp',
    description: customOptions?.description || repoInfo.description || 'Custom imported script',
    source: {
      type: 'github',
      owner,
      repo,
      branch,
      project_type: projectType,
    },
    install_methods: [{
      type: 'default',
      script: `custom-ct/${slug}.sh`,
      resources: {
        cpu: customOptions?.resources?.cpu || baseResources.cpu,
        ram: customOptions?.resources?.ram || baseResources.ram,
        hdd: customOptions?.resources?.hdd || baseResources.hdd,
        os: customOptions?.resources?.os || 'debian',
        version: customOptions?.resources?.version || '13',
      },
    }],
    default_credentials: {
      username: null,
      password: null,
    },
    notes: [
      { text: `Imported from GitHub: ${owner}/${repo}`, type: 'info' },
      { text: `Project type: ${projectType}`, type: 'info' },
    ],
  };
}

function generateInstallScript(manifest: ScriptManifest): string {
  const { slug, source, name } = manifest;
  const projectType = source.project_type;

  let depsSection = '';
  let buildSection = '';
  let serviceSection = '';

  switch (projectType) {
    case 'nodejs':
      depsSection = `
msg_info "Installing Node.js"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
$STD apt-get install -y nodejs
msg_ok "Node.js installed"`;
      buildSection = `
msg_info "Installing dependencies"
$STD npm install
if grep -q '"build"' package.json 2>/dev/null; then
    msg_info "Building application"
    $STD npm run build
fi
msg_ok "Application built"`;
      serviceSection = `ExecStart=/usr/bin/npm start`;
      break;

    case 'python':
      depsSection = `
msg_info "Installing Python"
$STD apt-get install -y python3 python3-pip python3-venv
msg_ok "Python installed"`;
      buildSection = `
msg_info "Setting up Python environment"
python3 -m venv venv
source venv/bin/activate
if [ -f "requirements.txt" ]; then
    $STD pip install -r requirements.txt
fi
if [ -f "pyproject.toml" ]; then
    $STD pip install .
fi
msg_ok "Environment configured"`;
      serviceSection = `ExecStart=/opt/${slug}/venv/bin/python -m app`;
      break;

    case 'docker':
      depsSection = `
msg_info "Installing Docker"
$STD apt-get install -y ca-certificates gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
$STD apt-get update
$STD apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
msg_ok "Docker installed"`;
      buildSection = `
msg_info "Building containers"
if [ -f "docker-compose.yml" ]; then
    $STD docker compose build
    $STD docker compose up -d
else
    $STD docker build -t ${slug} .
    $STD docker run -d --name ${slug} --restart unless-stopped ${slug}
fi
msg_ok "Containers running"`;
      break;

    case 'golang':
      depsSection = `
msg_info "Installing Go"
GO_VERSION=$(curl -s https://go.dev/VERSION?m=text | head -1)
wget -q "https://go.dev/dl/\${GO_VERSION}.linux-amd64.tar.gz"
tar -C /usr/local -xzf "\${GO_VERSION}.linux-amd64.tar.gz"
rm "\${GO_VERSION}.linux-amd64.tar.gz"
export PATH=$PATH:/usr/local/go/bin
msg_ok "Go installed"`;
      buildSection = `
msg_info "Building application"
$STD go build -o app .
msg_ok "Built"`;
      serviceSection = `ExecStart=/opt/${slug}/app`;
      break;

    default:
      depsSection = `
msg_info "Installing dependencies"
$STD apt-get install -y wget
msg_ok "Dependencies installed"`;
  }

  const serviceBlock = serviceSection ? `
msg_info "Creating systemd service"
cat > /etc/systemd/system/${slug}.service <<EOF
[Unit]
Description=${name}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/${slug}
${serviceSection}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ${slug}
msg_ok "Service created"` : '';

  return `#!/usr/bin/env bash

# Auto-generated installation script for ${name}
# Imported from: https://github.com/${source.owner}/${source.repo}

source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing base dependencies"
$STD apt-get install -y curl git
msg_ok "Base dependencies installed"
${depsSection}

msg_info "Cloning repository"
cd /opt
git clone -b "${source.branch}" "https://github.com/${source.owner}/${source.repo}.git" "${slug}"
cd "/opt/${slug}"
msg_ok "Repository cloned"
${buildSection}
${serviceBlock}

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleaned"
`;
}

// Export the router procedures
export const customImportProcedures = {
  /**
   * Import a GitHub repository
   */
  import: {
    input: ImportRequestSchema,
    mutation: async ({ input }: { input: z.infer<typeof ImportRequestSchema> }) => {
      await ensureDirectories();

      const { owner, repo, branch } = parseGitHubUrl(input.url);

      // Check for existing manifest or generate one
      let manifest = await checkForManifest(owner, repo, branch);

      if (!manifest) {
        manifest = await generateManifest(owner, repo, branch, {
          name: input.customName,
          description: input.customDescription,
          resources: input.customResources,
        });
      } else if (input.customResources) {
        // Merge custom resources with existing manifest
        manifest.install_methods[0].resources = {
          ...manifest.install_methods[0].resources,
          ...input.customResources,
        };
      }

      // Generate install script
      const installScript = generateInstallScript(manifest);

      // Save files
      const manifestPath = path.join(CUSTOM_SCRIPTS_DIR, `${manifest.slug}.json`);
      const scriptPath = path.join(CUSTOM_CT_DIR, `${manifest.slug}.sh`);

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      await fs.writeFile(scriptPath, installScript);
      await fs.chmod(scriptPath, 0o755);

      // Also copy to main json directory
      await fs.writeFile(
        path.join(PVESCRIPTS_DIR, 'json', `custom-${manifest.slug}.json`),
        JSON.stringify(manifest, null, 2)
      );

      // Update registry
      const config = await getConfig();
      const existingIndex = config.imports.findIndex(i => i.slug === manifest!.slug);

      const importEntry: ImportEntry = {
        slug: manifest.slug,
        source: `https://github.com/${owner}/${repo}`,
        branch,
        imported_at: new Date().toISOString(),
        version: 'latest',
      };

      if (existingIndex >= 0) {
        config.imports[existingIndex] = importEntry;
      } else {
        config.imports.push(importEntry);
      }

      config.last_updated = new Date().toISOString();
      await saveConfig(config);

      return {
        success: true,
        manifest,
        message: `Successfully imported ${manifest.name}`,
      };
    },
  },

  /**
   * List all imported scripts
   */
  list: {
    query: async () => {
      const config = await getConfig();

      const imports = await Promise.all(
        config.imports.map(async (imp) => {
          try {
            const manifestPath = path.join(CUSTOM_SCRIPTS_DIR, `${imp.slug}.json`);
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent) as ScriptManifest;

            return {
              ...imp,
              name: manifest.name,
              description: manifest.description,
              projectType: manifest.source.project_type,
              resources: manifest.install_methods[0]?.resources,
            };
          } catch {
            return imp;
          }
        })
      );

      return { imports };
    },
  },

  /**
   * Get details of a specific import
   */
  get: {
    input: z.object({ slug: z.string() }),
    query: async ({ input }: { input: { slug: string } }) => {
      const manifestPath = path.join(CUSTOM_SCRIPTS_DIR, `${input.slug}.json`);

      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content) as ScriptManifest;
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Import not found: ${input.slug}`,
        });
      }
    },
  },

  /**
   * Remove an imported script
   */
  remove: {
    input: z.object({ slug: z.string() }),
    mutation: async ({ input }: { input: { slug: string } }) => {
      const { slug } = input;

      // Remove files
      await fs.unlink(path.join(CUSTOM_SCRIPTS_DIR, `${slug}.json`)).catch(() => {});
      await fs.unlink(path.join(CUSTOM_CT_DIR, `${slug}.sh`)).catch(() => {});
      await fs.unlink(path.join(PVESCRIPTS_DIR, 'json', `custom-${slug}.json`)).catch(() => {});

      // Update registry
      const config = await getConfig();
      config.imports = config.imports.filter(i => i.slug !== slug);
      config.last_updated = new Date().toISOString();
      await saveConfig(config);

      return { success: true, message: `Removed ${slug}` };
    },
  },

  /**
   * Update an imported script from its source
   */
  update: {
    input: z.object({ slug: z.string() }),
    mutation: async ({ input }: { input: { slug: string } }) => {
      const config = await getConfig();
      const importEntry = config.imports.find(i => i.slug === input.slug);

      if (!importEntry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Import not found: ${input.slug}`,
        });
      }

      // Re-import from source
      const url = `${importEntry.source}/tree/${importEntry.branch}`;
      const { owner, repo, branch } = parseGitHubUrl(url);

      let manifest = await checkForManifest(owner, repo, branch);
      if (!manifest) {
        manifest = await generateManifest(owner, repo, branch);
      }

      const installScript = generateInstallScript(manifest);

      await fs.writeFile(
        path.join(CUSTOM_SCRIPTS_DIR, `${manifest.slug}.json`),
        JSON.stringify(manifest, null, 2)
      );
      await fs.writeFile(path.join(CUSTOM_CT_DIR, `${manifest.slug}.sh`), installScript);
      await fs.writeFile(
        path.join(PVESCRIPTS_DIR, 'json', `custom-${manifest.slug}.json`),
        JSON.stringify(manifest, null, 2)
      );

      // Update registry entry
      importEntry.imported_at = new Date().toISOString();
      await saveConfig(config);

      return { success: true, message: `Updated ${manifest.name}` };
    },
  },

  /**
   * Preview import without saving
   */
  preview: {
    input: z.object({ url: GitHubUrlSchema }),
    query: async ({ input }: { input: { url: string } }) => {
      const { owner, repo, branch } = parseGitHubUrl(input.url);

      let manifest = await checkForManifest(owner, repo, branch);
      if (!manifest) {
        manifest = await generateManifest(owner, repo, branch);
      }

      return {
        manifest,
        hasExistingManifest: !!manifest,
        installScriptPreview: generateInstallScript(manifest).slice(0, 500) + '...',
      };
    },
  },
};

export type CustomImportRouter = typeof customImportProcedures;
