/**
 * Individual Credential API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCredentialById,
  updateCredential,
  deleteCredential,
} from '@/lib/settings'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const credential = await getCredentialById(id)
    if (!credential) {
      return NextResponse.json(
        { success: false, message: 'Credential not found' },
        { status: 404 }
      )
    }

    // Return without sensitive token
    return NextResponse.json({
      success: true,
      data: {
        id: credential.id,
        name: credential.name,
        provider: credential.provider,
        baseUrl: credential.baseUrl,
        authType: credential.authType,
        username: credential.username,
        hasToken: !!credential.token,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    })
  } catch (error) {
    console.error('Failed to get credential:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to get credential' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updated = await updateCredential(id, {
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      authType: body.authType,
      username: body.username,
      token: body.token, // Only update if provided
    })

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Credential not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Credential updated',
      data: {
        id: updated.id,
        name: updated.name,
        provider: updated.provider,
        hasToken: !!updated.token,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('Failed to update credential:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update credential' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deleted = await deleteCredential(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Credential not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Credential deleted',
    })
  } catch (error) {
    console.error('Failed to delete credential:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete credential' },
      { status: 500 }
    )
  }
}
