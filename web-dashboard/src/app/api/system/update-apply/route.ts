/**
 * Apply Update API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/pvescripts-customiser'
const SERVICE_NAME = process.env.SERVICE_NAME || 'pvescripts-customiser'

export async function POST() {
  try {
    // Get current branch
    const { stdout: branch } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD`,
      { timeout: 10000 }
    )

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
