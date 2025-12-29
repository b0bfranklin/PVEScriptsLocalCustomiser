/**
 * Categories API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCategories,
  addCustomCategory,
  deleteCustomCategory,
} from '@/lib/pvescripts'

export async function GET() {
  try {
    const categories = await getAllCategories()
    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Failed to load categories:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to load categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Category name is required' },
        { status: 400 }
      )
    }

    const newCategory = await addCustomCategory(name.trim())

    return NextResponse.json({
      success: true,
      message: `Category "${name}" created`,
      data: newCategory,
    })
  } catch (error) {
    console.error('Failed to add category:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to add category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '', 10)

    if (isNaN(id) || id < 100) {
      return NextResponse.json(
        { success: false, message: 'Can only delete custom categories (id >= 100)' },
        { status: 400 }
      )
    }

    const deleted = await deleteCustomCategory(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Category deleted',
    })
  } catch (error) {
    console.error('Failed to delete category:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
