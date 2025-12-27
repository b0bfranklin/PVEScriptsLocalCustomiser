/**
 * Import Management API (Delete)
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  removeImport,
  deleteManifest,
  deleteInstallScript,
  getImportBySlug,
  isValidSlug,
} from '@/lib/pvescripts'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug || !isValidSlug(slug)) {
      return NextResponse.json(
        { success: false, message: 'Invalid slug format' },
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

    // Delete manifest and install script
    await deleteManifest(slug)
    await deleteInstallScript(slug)

    // Remove from imports list
    await removeImport(slug)

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${importRecord.name}`,
    })
  } catch (error) {
    console.error('Delete failed:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Delete failed',
      },
      { status: 500 }
    )
  }
}
