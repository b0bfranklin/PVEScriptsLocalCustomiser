/**
 * Import Category Update API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  updateImportCategory,
  getImportBySlug,
  isValidSlug,
} from '@/lib/pvescripts'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { categoryId } = body

    if (!slug || !isValidSlug(slug)) {
      return NextResponse.json(
        { success: false, message: 'Invalid slug format' },
        { status: 400 }
      )
    }

    if (categoryId === undefined || typeof categoryId !== 'number') {
      return NextResponse.json(
        { success: false, message: 'categoryId is required and must be a number' },
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

    // Update the category
    const updatedRecord = await updateImportCategory(slug, categoryId)

    return NextResponse.json({
      success: true,
      message: `Category updated for ${importRecord.name}`,
      data: updatedRecord,
    })
  } catch (error) {
    console.error('Category update failed:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Category update failed',
      },
      { status: 500 }
    )
  }
}
