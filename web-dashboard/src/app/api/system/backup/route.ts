/**
 * Backup API - Export imports and settings
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

const CUSTOMISER_PATH = process.env.CUSTOMISER_PATH || '/opt/pvescripts-customiser'
const BACKUP_DIR = join(CUSTOMISER_PATH, 'backups')

async function ensureBackupDir() {
  try {
    await access(BACKUP_DIR, constants.W_OK)
  } catch {
    await mkdir(BACKUP_DIR, { recursive: true })
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  try {
    const data = await readFile(path, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

// GET - Create and download a backup
export async function GET() {
  try {
    await ensureBackupDir()

    // Collect all data
    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      data: {
        imports: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'imports.json')),
        categories: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'categories.json')),
        settings: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'settings.json')),
      },
    }

    // Also save locally as latest backup
    const backupPath = join(BACKUP_DIR, `backup-${Date.now()}.json`)
    await writeFile(backupPath, JSON.stringify(backup, null, 2))

    // Return as downloadable file
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="pvescripts-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    console.error('Backup failed:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 }
    )
  }
}

// POST - Restore from a backup
export async function POST(request: Request) {
  try {
    const backup = await request.json()

    if (!backup.version || !backup.data) {
      return NextResponse.json(
        { success: false, message: 'Invalid backup file format' },
        { status: 400 }
      )
    }

    const dataPath = join(CUSTOMISER_PATH, 'data')
    try {
      await access(dataPath, constants.W_OK)
    } catch {
      await mkdir(dataPath, { recursive: true })
    }

    // Restore each data file
    let restored = 0

    if (backup.data.imports) {
      await writeFile(
        join(dataPath, 'imports.json'),
        JSON.stringify(backup.data.imports, null, 2)
      )
      restored++
    }

    if (backup.data.categories) {
      await writeFile(
        join(dataPath, 'categories.json'),
        JSON.stringify(backup.data.categories, null, 2)
      )
      restored++
    }

    if (backup.data.settings) {
      await writeFile(
        join(dataPath, 'settings.json'),
        JSON.stringify(backup.data.settings, null, 2)
      )
      restored++
    }

    return NextResponse.json({
      success: true,
      message: `Restored ${restored} data files from backup`,
      restoredAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Restore failed:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Restore failed' },
      { status: 500 }
    )
  }
}
