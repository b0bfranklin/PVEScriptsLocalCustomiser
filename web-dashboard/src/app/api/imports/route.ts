/**
 * Imports List API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { loadImports, checkPVEScriptsExists } from '@/lib/pvescripts'

export async function GET() {
  try {
    const pveExists = await checkPVEScriptsExists()
    if (!pveExists) {
      return NextResponse.json({
        imports: [],
        error: 'PVEScriptsLocal not found at /opt/ProxmoxVE-Local',
      })
    }

    const imports = await loadImports()

    return NextResponse.json({ imports })
  } catch (error) {
    console.error('Failed to load imports:', error)
    return NextResponse.json(
      {
        imports: [],
        error: error instanceof Error ? error.message : 'Failed to load imports',
      },
      { status: 500 }
    )
  }
}
