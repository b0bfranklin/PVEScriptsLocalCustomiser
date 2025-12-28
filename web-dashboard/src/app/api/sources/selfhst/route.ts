/**
 * Self-Hosted Apps Source API
 * Uses awesome-selfhosted data for comprehensive app listings
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'

interface SelfhstApp {
  name: string
  description?: string
  repo?: string
  website?: string
  stars?: number
  icon?: string
  tags?: string[]
  license?: string
}

// Fetch apps from awesome-selfhosted GitHub API
async function fetchAwesomeSelfhosted(): Promise<SelfhstApp[]> {
  const apps: SelfhstApp[] = []

  try {
    // Get list of YAML files in the software directory
    const listResponse = await fetch(
      'https://api.github.com/repos/awesome-selfhosted/awesome-selfhosted-data/contents/software',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PVEScriptsLocal-Customiser',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!listResponse.ok) {
      throw new Error(`GitHub API error: ${listResponse.status}`)
    }

    const files = await listResponse.json()

    // Filter YAML files and get a reasonable sample (first 200 alphabetically)
    const yamlFiles = files
      .filter((f: { name: string }) => f.name.endsWith('.yml'))
      .slice(0, 200)

    // Fetch each YAML file and parse it (in batches to avoid rate limiting)
    const batchSize = 50
    for (let i = 0; i < yamlFiles.length; i += batchSize) {
      const batch = yamlFiles.slice(i, i + batchSize)

      const batchPromises = batch.map(async (file: { download_url: string; name: string }) => {
        try {
          const yamlResponse = await fetch(file.download_url, {
            next: { revalidate: 3600 },
          })

          if (!yamlResponse.ok) return null

          const yamlText = await yamlResponse.text()

          // Simple YAML parsing for the fields we need
          const name = yamlText.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] || file.name.replace('.yml', '')
          const description = yamlText.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1]
          const website = yamlText.match(/^website_url:\s*["']?(.+?)["']?\s*$/m)?.[1]
          const repo = yamlText.match(/^source_code_url:\s*["']?(.+?)["']?\s*$/m)?.[1]
          const tagsMatch = yamlText.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m)
          const tags = tagsMatch
            ? tagsMatch[1].split('\n').map(t => t.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
            : []

          return {
            name,
            description,
            website,
            repo,
            tags,
          }
        } catch {
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      apps.push(...batchResults.filter((app): app is SelfhstApp => app !== null))
    }

    return apps
  } catch (error) {
    console.error('Failed to fetch awesome-selfhosted:', error)
    return []
  }
}

// Fallback data if API fails
const fallbackApps: SelfhstApp[] = [
  { name: 'Nextcloud', description: 'A safe home for all your data - file sync, share, and collaboration', repo: 'https://github.com/nextcloud/server', tags: ['file-sharing', 'collaboration'], stars: 26000 },
  { name: 'Jellyfin', description: 'The Free Software Media System', repo: 'https://github.com/jellyfin/jellyfin', tags: ['media', 'streaming'], stars: 32000 },
  { name: 'Home Assistant', description: 'Open source home automation', repo: 'https://github.com/home-assistant/core', tags: ['home-automation', 'iot'], stars: 70000 },
  { name: 'Vaultwarden', description: 'Unofficial Bitwarden compatible server', repo: 'https://github.com/dani-garcia/vaultwarden', tags: ['password-manager', 'security'], stars: 35000 },
  { name: 'Gitea', description: 'Git with a cup of tea - lightweight self-hosted Git', repo: 'https://github.com/go-gitea/gitea', tags: ['git', 'devops'], stars: 43000 },
  { name: 'Immich', description: 'High performance self-hosted photo and video backup', repo: 'https://github.com/immich-app/immich', tags: ['photos', 'backup'], stars: 40000 },
  { name: 'Paperless-ngx', description: 'Document management system', repo: 'https://github.com/paperless-ngx/paperless-ngx', tags: ['documents', 'ocr'], stars: 18000 },
  { name: 'Authentik', description: 'Open-source Identity Provider', repo: 'https://github.com/goauthentik/authentik', tags: ['auth', 'sso'], stars: 8000 },
  { name: 'Uptime Kuma', description: 'Self-hosted monitoring tool', repo: 'https://github.com/louislam/uptime-kuma', tags: ['monitoring'], stars: 52000 },
  { name: 'Portainer', description: 'Container management platform', repo: 'https://github.com/portainer/portainer', tags: ['docker', 'containers'], stars: 30000 },
  { name: 'Traefik', description: 'Cloud native application proxy', repo: 'https://github.com/traefik/traefik', tags: ['proxy', 'networking'], stars: 49000 },
  { name: 'Pi-hole', description: 'Network-wide ad blocking', repo: 'https://github.com/pi-hole/pi-hole', tags: ['dns', 'adblock'], stars: 48000 },
  { name: 'Grafana', description: 'Open observability platform', repo: 'https://github.com/grafana/grafana', tags: ['monitoring', 'dashboards'], stars: 61000 },
  { name: 'Prometheus', description: 'Monitoring system and time series database', repo: 'https://github.com/prometheus/prometheus', tags: ['monitoring', 'metrics'], stars: 54000 },
  { name: 'Syncthing', description: 'Continuous file synchronization', repo: 'https://github.com/syncthing/syncthing', tags: ['file-sync', 'p2p'], stars: 62000 },
  { name: 'Nginx Proxy Manager', description: 'Docker container for managing Nginx proxy hosts', repo: 'https://github.com/NginxProxyManager/nginx-proxy-manager', tags: ['proxy', 'ssl'], stars: 21000 },
  { name: 'Wireguard', description: 'Fast, modern VPN', repo: 'https://github.com/WireGuard/wireguard-go', tags: ['vpn', 'networking'], stars: 15000 },
  { name: 'Minio', description: 'High performance object storage', repo: 'https://github.com/minio/minio', tags: ['storage', 's3'], stars: 45000 },
  { name: 'Mastodon', description: 'Self-hosted social networking', repo: 'https://github.com/mastodon/mastodon', tags: ['social', 'fediverse'], stars: 46000 },
  { name: 'Matrix/Synapse', description: 'Decentralized communication', repo: 'https://github.com/matrix-org/synapse', tags: ['chat', 'messaging'], stars: 12000 },
  { name: 'Ollama', description: 'Run large language models locally', repo: 'https://github.com/ollama/ollama', tags: ['ai', 'llm'], stars: 80000 },
  { name: 'LocalAI', description: 'Self-hosted OpenAI alternative', repo: 'https://github.com/mudler/LocalAI', tags: ['ai', 'llm'], stars: 22000 },
  { name: 'Open WebUI', description: 'User-friendly WebUI for LLMs', repo: 'https://github.com/open-webui/open-webui', tags: ['ai', 'llm'], stars: 35000 },
  { name: 'n8n', description: 'Workflow automation tool', repo: 'https://github.com/n8n-io/n8n', tags: ['automation', 'workflow'], stars: 43000 },
  { name: 'Owncloud', description: 'File hosting and sharing', repo: 'https://github.com/owncloud/core', tags: ['file-sharing'], stars: 8200 },
]

export async function GET() {
  try {
    // Try to fetch from awesome-selfhosted
    let apps = await fetchAwesomeSelfhosted()

    // If we got less than 10 apps, use fallback
    if (apps.length < 10) {
      console.log('Using fallback data for selfhosted apps')
      apps = fallbackApps
    }

    // Sort alphabetically by name
    apps.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ apps, count: apps.length })
  } catch (error) {
    console.error('Failed to fetch selfhosted apps:', error)
    return NextResponse.json({ apps: fallbackApps, count: fallbackApps.length })
  }
}
