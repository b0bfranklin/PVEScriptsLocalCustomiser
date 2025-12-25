/**
 * Community Scripts Import API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkPVEScriptsExists,
  writeManifest,
  writeInstallScript,
  addImport,
  type ScriptManifest,
} from '@/lib/pvescripts'

interface ImportRequest {
  name: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { success: false, message: 'Script name is required' },
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

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Fetch the manifest from community-scripts
    const manifestUrl = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/json/${slug}.json`
    const manifestResponse = await fetch(manifestUrl)

    if (!manifestResponse.ok) {
      // Try alternate naming patterns
      const altSlug = body.name.toLowerCase().replace(/\s+/g, '-')
      const altManifestUrl = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/json/${altSlug}.json`
      const altResponse = await fetch(altManifestUrl)

      if (!altResponse.ok) {
        return NextResponse.json(
          { success: false, message: `Script manifest not found for: ${body.name}` },
          { status: 404 }
        )
      }

      const manifest = await altResponse.json()
      return await processManifest(manifest, altSlug, body.name)
    }

    const manifest = await manifestResponse.json()
    return await processManifest(manifest, slug, body.name)
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

async function processManifest(
  manifest: ScriptManifest,
  slug: string,
  originalName: string
): Promise<NextResponse> {
  try {
    // Write the manifest
    const manifestPath = await writeManifest(manifest)

    // Fetch and write install scripts if available
    if (manifest.install_methods && manifest.install_methods.length > 0) {
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

    // Record the import
    await addImport({
      slug: manifest.slug || slug,
      name: manifest.name || originalName,
      source: `https://github.com/community-scripts/ProxmoxVE`,
      sourceType: 'community-scripts',
      importedAt: new Date().toISOString(),
      manifestPath,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${manifest.name || originalName} from community-scripts`,
      data: {
        slug: manifest.slug || slug,
        name: manifest.name || originalName,
        port: manifest.interface_port,
      },
    })
  } catch (error) {
    throw error
  }
}
