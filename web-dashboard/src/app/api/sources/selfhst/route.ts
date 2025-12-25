/**
 * selfh.st Apps Source API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'

interface SelfhstApp {
  name: string
  description?: string
  repo?: string
  stars?: number
  icon?: string
  tags?: string[]
  lastCommit?: string
}

export async function GET() {
  try {
    // Fetch from selfhst-apps GitHub repository
    const response = await fetch(
      'https://raw.githubusercontent.com/rocketnova/selfhst-apps/main/projects.json',
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const data = await response.json()

    // Transform the data to our format
    const apps: SelfhstApp[] = []

    if (Array.isArray(data)) {
      for (const item of data) {
        apps.push({
          name: item.name || item.title || 'Unknown',
          description: item.description || item.tagline,
          repo: item.github || item.repo || item.url,
          stars: item.stars || item.stargazers_count,
          icon: item.icon || item.logo,
          tags: item.tags || item.categories || [],
        })
      }
    } else if (data.projects) {
      for (const item of data.projects) {
        apps.push({
          name: item.name || item.title || 'Unknown',
          description: item.description || item.tagline,
          repo: item.github || item.repo || item.url,
          stars: item.stars || item.stargazers_count,
          icon: item.icon || item.logo,
          tags: item.tags || item.categories || [],
        })
      }
    }

    // Sort by stars if available
    apps.sort((a, b) => (b.stars || 0) - (a.stars || 0))

    return NextResponse.json({ apps })
  } catch (error) {
    console.error('Failed to fetch selfhst apps:', error)

    // Return fallback sample data
    const fallbackApps: SelfhstApp[] = [
      {
        name: 'Nextcloud',
        description: 'A safe home for all your data',
        repo: 'https://github.com/nextcloud/server',
        stars: 26000,
        tags: ['file-sharing', 'collaboration'],
      },
      {
        name: 'Jellyfin',
        description: 'The Free Software Media System',
        repo: 'https://github.com/jellyfin/jellyfin',
        stars: 32000,
        tags: ['media', 'streaming'],
      },
      {
        name: 'Home Assistant',
        description: 'Open source home automation',
        repo: 'https://github.com/home-assistant/core',
        stars: 70000,
        tags: ['home-automation', 'iot'],
      },
      {
        name: 'Vaultwarden',
        description: 'Unofficial Bitwarden compatible server',
        repo: 'https://github.com/dani-garcia/vaultwarden',
        stars: 35000,
        tags: ['password-manager', 'security'],
      },
      {
        name: 'Gitea',
        description: 'Git with a cup of tea',
        repo: 'https://github.com/go-gitea/gitea',
        stars: 43000,
        tags: ['git', 'devops'],
      },
    ]

    return NextResponse.json({ apps: fallbackApps })
  }
}
