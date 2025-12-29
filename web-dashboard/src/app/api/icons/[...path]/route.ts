/**
 * Icon Proxy and Cache API
 * Caches external icons locally to improve load times and reliability
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { constants } from 'fs'

const CACHE_DIR = process.env.CACHE_DIR || '/opt/pvescripts-customiser/cache/icons'
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

async function ensureCacheDir(): Promise<void> {
  try {
    await access(CACHE_DIR, constants.W_OK)
  } catch {
    await mkdir(CACHE_DIR, { recursive: true })
  }
}

function hashUrl(url: string): string {
  return createHash('md5').update(url).digest('hex')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params

    // Reconstruct the URL from path segments
    // Path format: /api/icons/https/example.com/path/to/icon.png
    if (path.length < 2) {
      return NextResponse.json({ error: 'Invalid icon path' }, { status: 400 })
    }

    const protocol = path[0] // 'https' or 'http'
    const restOfPath = path.slice(1).join('/')
    const iconUrl = `${protocol}://${restOfPath}`

    // Validate URL
    try {
      new URL(iconUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    await ensureCacheDir()

    const urlHash = hashUrl(iconUrl)
    const metaPath = join(CACHE_DIR, `${urlHash}.meta`)
    const dataPath = join(CACHE_DIR, `${urlHash}.data`)

    // Check cache
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf-8'))
      const age = Date.now() - meta.cachedAt

      if (age < CACHE_MAX_AGE) {
        const data = await readFile(dataPath)
        return new NextResponse(data, {
          headers: {
            'Content-Type': meta.contentType || 'image/png',
            'Cache-Control': 'public, max-age=604800',
            'X-Cache': 'HIT',
          },
        })
      }
    } catch {
      // Cache miss, fetch from source
    }

    // Fetch from source
    const response = await fetch(iconUrl, {
      headers: {
        'User-Agent': 'PVEScriptsLocal-Customiser',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch icon' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const data = Buffer.from(await response.arrayBuffer())

    // Save to cache
    try {
      await writeFile(dataPath, data)
      await writeFile(
        metaPath,
        JSON.stringify({
          url: iconUrl,
          contentType,
          cachedAt: Date.now(),
          size: data.length,
        })
      )
    } catch (e) {
      console.error('Failed to cache icon:', e)
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Icon proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
