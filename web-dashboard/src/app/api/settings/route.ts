/**
 * Settings API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import { loadSettings, saveSettings, type Settings } from '@/lib/settings'

export async function GET() {
  try {
    const settings = await loadSettings()
    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Failed to load settings:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updates: Partial<Settings> = await request.json()
    const current = await loadSettings()
    const updated = { ...current, ...updates }
    await saveSettings(updated)

    return NextResponse.json({
      success: true,
      message: 'Settings saved',
      data: updated,
    })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
