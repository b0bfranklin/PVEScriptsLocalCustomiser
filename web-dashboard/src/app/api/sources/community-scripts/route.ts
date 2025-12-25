/**
 * Community Scripts Source API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'

interface CommunityScript {
  name: string
  slug: string
  description?: string
  categories?: number[]
  interface_port?: number | null
  logo?: string
}

export async function GET() {
  try {
    // Fetch the JSON files list from community-scripts GitHub repo
    const apiUrl = 'https://api.github.com/repos/community-scripts/ProxmoxVE/contents/json'
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'PVEScriptsLocal-Customiser',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const files = await response.json()

    // Filter JSON files and extract script info
    const jsonFiles = files.filter(
      (f: { name: string }) => f.name.endsWith('.json') && !f.name.startsWith('.')
    )

    // Fetch a sample of script details (limit to avoid rate limiting)
    const scripts: CommunityScript[] = []

    for (const file of jsonFiles.slice(0, 500)) {
      const slug = file.name.replace('.json', '')
      const name = slug
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      scripts.push({
        name,
        slug,
        description: `Install ${name} from community-scripts`,
      })
    }

    // Sort alphabetically
    scripts.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ scripts })
  } catch (error) {
    console.error('Failed to fetch community scripts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch community scripts', scripts: [] },
      { status: 500 }
    )
  }
}
