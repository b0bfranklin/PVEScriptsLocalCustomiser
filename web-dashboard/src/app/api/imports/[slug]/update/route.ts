/**
 * Import Update API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getImportBySlug,
  addImport,
  writeManifest,
  writeInstallScript,
  detectProjectType,
  generateInstallScript,
  type ScriptManifest,
} from '@/lib/pvescripts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug) {
      return NextResponse.json(
        { success: false, message: 'Slug is required' },
        { status: 400 }
      )
    }

    // Get the import record
    const importRecord = await getImportBySlug(slug)
    if (!importRecord) {
      return NextResponse.json(
        { success: false, message: `Import not found: ${slug}` },
        { status: 404 }
      )
    }

    // Re-import based on source type
    if (importRecord.sourceType === 'community-scripts') {
      // Re-fetch from community-scripts
      const manifestUrl = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/json/${slug}.json`
      const manifestResponse = await fetch(manifestUrl)

      if (!manifestResponse.ok) {
        return NextResponse.json(
          { success: false, message: 'Failed to fetch updated manifest' },
          { status: 404 }
        )
      }

      const manifest: ScriptManifest = await manifestResponse.json()
      await writeManifest(manifest)

      // Update install scripts
      if (manifest.install_methods) {
        for (const method of manifest.install_methods) {
          if (method.script) {
            const scriptUrl = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/install/${method.script}`
            const scriptResponse = await fetch(scriptUrl)

            if (scriptResponse.ok) {
              const scriptContent = await scriptResponse.text()
              await writeInstallScript(
                method.script.replace('-install.sh', '').replace('.sh', ''),
                scriptContent
              )
            }
          }
        }
      }

      // Update import record
      await addImport({
        ...importRecord,
        importedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${importRecord.name}`,
      })
    } else if (
      importRecord.sourceType === 'github' ||
      importRecord.sourceType === 'selfhst'
    ) {
      // Parse GitHub URL to get repo info
      const match = importRecord.source.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (!match) {
        return NextResponse.json(
          { success: false, message: 'Cannot parse source URL' },
          { status: 400 }
        )
      }

      const [, owner, repo] = match

      // Fetch latest repo info
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'PVEScriptsLocal-Customiser',
          },
        }
      )

      if (!repoResponse.ok) {
        return NextResponse.json(
          { success: false, message: 'Failed to fetch repository info' },
          { status: 404 }
        )
      }

      const repoInfo = await repoResponse.json()

      // Get file list to detect project type
      const contentsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'PVEScriptsLocal-Customiser',
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

      // Update manifest
      const manifest: ScriptManifest = {
        name: importRecord.name,
        slug,
        categories: [14],
        date_created: new Date().toISOString().split('T')[0],
        type: 'ct',
        updateable: true,
        privileged: false,
        interface_port: projectType.port,
        documentation: repoInfo.html_url,
        website: repoInfo.homepage || repoInfo.html_url,
        logo: repoInfo.owner?.avatar_url || null,
        description: repoInfo.description || `${importRecord.name} from GitHub`,
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
            text: `Updated from GitHub: ${repoInfo.html_url}`,
            type: 'info',
          },
        ],
      }

      await writeManifest(manifest)

      // Regenerate install script
      const installScript = generateInstallScript(
        importRecord.name,
        slug,
        projectType.type,
        repoInfo.clone_url,
        projectType.port
      )
      await writeInstallScript(slug, installScript)

      // Update import record
      await addImport({
        ...importRecord,
        importedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${importRecord.name}`,
      })
    }

    return NextResponse.json(
      { success: false, message: 'Unknown source type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update failed:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Update failed',
      },
      { status: 500 }
    )
  }
}
