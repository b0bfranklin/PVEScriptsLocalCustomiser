/**
 * Credentials API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  loadCredentials,
  addCredential,
  type GitCredential,
} from '@/lib/settings'

export async function GET() {
  try {
    const credentials = await loadCredentials()

    // Return credentials without sensitive data
    const safeCredentials = credentials.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      baseUrl: c.baseUrl,
      authType: c.authType,
      username: c.username,
      hasToken: !!c.token,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))

    return NextResponse.json({ success: true, data: safeCredentials })
  } catch (error) {
    console.error('Failed to load credentials:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to load credentials' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.provider || !body.authType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: name, provider, authType' },
        { status: 400 }
      )
    }

    // Validate auth requirements
    if (body.authType === 'token' && !body.token) {
      return NextResponse.json(
        { success: false, message: 'Token is required for token authentication' },
        { status: 400 }
      )
    }

    if (body.authType === 'basic' && (!body.username || !body.token)) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required for basic authentication' },
        { status: 400 }
      )
    }

    const newCredential = await addCredential({
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      authType: body.authType,
      username: body.username,
      token: body.token,
    })

    // Return without sensitive data
    return NextResponse.json({
      success: true,
      message: 'Credential added',
      data: {
        id: newCredential.id,
        name: newCredential.name,
        provider: newCredential.provider,
        baseUrl: newCredential.baseUrl,
        authType: newCredential.authType,
        username: newCredential.username,
        hasToken: !!newCredential.token,
        createdAt: newCredential.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to add credential:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to add credential' },
      { status: 500 }
    )
  }
}
