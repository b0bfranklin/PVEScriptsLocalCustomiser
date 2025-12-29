/**
 * GitHub Import API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkPVEScriptsExists,
  slugify,
  detectProjectType,
  writeManifest,
  writeInstallScript,
  generateInstallScript,
  addImport,
  CATEGORIES,
  type ScriptManifest,
} from '@/lib/pvescripts'
import {
  getCredentialForUrl,
  buildAuthHeader,
  buildAuthenticatedUrl,
} from '@/lib/settings'

interface ImportRequest {
  url: string
  category?: string
  name?: string
  credentialId?: string // Optional: specific credential to use
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/)?$/,
    /github\.com\/([^/]+)\/([^/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
        branch: match[3] || 'main',
      }
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json()

    if (!body.url) {
      return NextResponse.json(
        { success: false, message: 'URL is required' },
        { status: 400 }
      )
    }

    // Check if PVEScriptsLocal exists
    const pveExists = await checkPVEScriptsExists()
    if (!pveExists) {
      return NextResponse.json(
        {
          success: false,
          message:
            'PVEScriptsLocal not found. Please install it first at /opt/ProxmoxVE-Local',
        },
        { status: 400 }
      )
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(body.url)
    if (!parsed) {
      return NextResponse.json(
        { success: false, message: 'Invalid GitHub URL format' },
        { status: 400 }
      )
    }

    const { owner, repo, branch } = parsed

    // Check for stored credentials for this URL
    const credential = await getCredentialForUrl(body.url)
    const authHeaders = credential ? buildAuthHeader(credential) : {}

    // Fetch repository info
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PVEScriptsLocal-Customiser',
          ...authHeaders,
        },
      }
    )

    if (!repoResponse.ok) {
      if (repoResponse.status === 401 || repoResponse.status === 403) {
        return NextResponse.json(
          {
            success: false,
            message: 'Authentication required. Please add credentials in Settings.',
            requiresAuth: true,
          },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { success: false, message: `Repository not found: ${owner}/${repo}` },
        { status: 404 }
      )
    }

    const repoInfo = await repoResponse.json()

    // Get file list to detect project type
    const contentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PVEScriptsLocal-Customiser',
          ...authHeaders,
        },
      }
    )

    let projectType = { type: 'generic', port: null as number | null }
    if (contentsResponse.ok) {
      const contents = await contentsResponse.json()
      const files = Array.isArray(contents)
        ? contents.map((f: { name: string }) => f.name)
        : []
      projectType = await detectProjectType(files)
    }

    // Create slug and manifest
    const name = body.name || repoInfo.name || repo
    const slug = slugify(name)
    const categoryId = parseInt(body.category || '14', 10)
    const category = CATEGORIES.find((c) => c.id === categoryId)

    const manifest: ScriptManifest = {
      name,
      slug,
      categories: [categoryId],
      date_created: new Date().toISOString().split('T')[0],
      type: projectType.type === 'docker' ? 'ct' : 'ct',
      updateable: true,
      privileged: false,
      interface_port: projectType.port,
      documentation: repoInfo.html_url,
      website: repoInfo.homepage || repoInfo.html_url,
      logo: repoInfo.owner?.avatar_url || null,
      description: repoInfo.description || `${name} from GitHub`,
      install_methods: [
        {
          type: 'default',
          script: `${slug}-install.sh`,
          resources: {
            cpu: 1,
            ram: 1024,
            hdd: 4,
            os: 'debian',
            version: 12,
          },
        },
      ],
      default_credentials: {
        username: null,
        password: null,
      },
      notes: [
        {
          text: `Imported from GitHub: ${repoInfo.html_url}`,
          type: 'info',
        },
      ],
    }

    // Generate install script with authenticated URL if needed
    const cloneUrl = credential
      ? buildAuthenticatedUrl(repoInfo.clone_url, credential)
      : repoInfo.clone_url

    const installScript = generateInstallScript(
      name,
      slug,
      projectType.type,
      cloneUrl,
      projectType.port
    )

    // Write files
    const manifestPath = await writeManifest(manifest)
    await writeInstallScript(slug, installScript)

    // Record the import
    await addImport({
      slug,
      name,
      source: repoInfo.html_url,
      sourceType: 'github',
      importedAt: new Date().toISOString(),
      category: category?.name,
      categoryId,
      manifestPath,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${name}`,
      data: {
        slug,
        name,
        type: projectType.type,
        port: projectType.port,
        category: category?.name,
      },
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      },
      { status: 500 }
    )
  }
}
