/**
 * Apply Update API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'
import { loadSettings } from '@/lib/settings'

const execAsync = promisify(exec)

const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/pvescripts-customiser'
const CUSTOMISER_PATH = process.env.CUSTOMISER_PATH || '/opt/pvescripts-customiser'
const SERVICE_NAME = process.env.SERVICE_NAME || 'pvescripts-customiser'
const BACKUP_DIR = join(CUSTOMISER_PATH, 'backups')

async function createPreUpdateBackup(): Promise<string | null> {
  try {
    try {
      await access(BACKUP_DIR, constants.W_OK)
    } catch {
      await mkdir(BACKUP_DIR, { recursive: true })
    }

    const readJsonFile = async (path: string): Promise<unknown> => {
      try {
        const data = await readFile(path, 'utf-8')
        return JSON.parse(data)
      } catch {
        return null
      }
    }

    const backup = {
      version: '1.0',
      type: 'pre-update',
      createdAt: new Date().toISOString(),
      data: {
        imports: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'imports.json')),
        categories: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'categories.json')),
        settings: await readJsonFile(join(CUSTOMISER_PATH, 'data', 'settings.json')),
      },
    }

    const backupPath = join(BACKUP_DIR, `pre-update-${Date.now()}.json`)
    await writeFile(backupPath, JSON.stringify(backup, null, 2))
    return backupPath
  } catch (e) {
    console.error('Pre-update backup failed:', e)
    return null
  }
}

export async function POST() {
  try {
    // Check if backup before update is enabled
    const settings = await loadSettings()
    let backupPath: string | null = null

    if (settings.backupBeforeUpdate) {
      backupPath = await createPreUpdateBackup()
    }

    // Get current branch
    const { stdout: branch } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD`,
      { timeout: 10000 }
    )

    // Clean up any conflicts and pull latest changes
    await execAsync(
      `cd ${INSTALL_DIR} && git checkout -- . && git clean -fd web-dashboard/package-lock.json`,
      { timeout: 30000 }
    ).catch(() => {})

    // Pull latest changes
    const { stdout: pullOutput } = await execAsync(
      `cd ${INSTALL_DIR} && git pull origin ${branch.trim()}`,
      { timeout: 60000 }
    )

    // Install dependencies if package.json changed
    await execAsync(
      `cd ${INSTALL_DIR}/web-dashboard && npm install`,
      { timeout: 120000 }
    )

    // Rebuild the dashboard
    const { stdout: buildOutput } = await execAsync(
      `cd ${INSTALL_DIR}/web-dashboard && npm run build`,
      { timeout: 180000 }
    )

    // Schedule service restart (delayed to allow response to be sent)
    setTimeout(async () => {
      try {
        await execAsync(`systemctl restart ${SERVICE_NAME}`, { timeout: 30000 })
      } catch (e) {
        console.error('Service restart failed:', e)
      }
    }, 2000)

    return NextResponse.json({
      success: true,
      message: 'Update applied successfully. Service will restart shortly.',
      data: {
        pullOutput: pullOutput.trim(),
        updatedAt: new Date().toISOString(),
        backupCreated: !!backupPath,
        backupPath,
      },
    })
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
