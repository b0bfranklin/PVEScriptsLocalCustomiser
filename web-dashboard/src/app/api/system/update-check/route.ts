/**
 * Update Check API
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/pvescripts-customiser'

export async function GET() {
  try {
    // Get current local commit
    const { stdout: localCommit } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-parse HEAD`,
      { timeout: 10000 }
    )

    // Get current branch
    const { stdout: branch } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD`,
      { timeout: 10000 }
    )

    // Fetch latest from remote
    await execAsync(
      `cd ${INSTALL_DIR} && git fetch origin ${branch.trim()}`,
      { timeout: 30000 }
    )

    // Get remote commit
    const { stdout: remoteCommit } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-parse origin/${branch.trim()}`,
      { timeout: 10000 }
    )

    // Get commit count difference
    const { stdout: behindCount } = await execAsync(
      `cd ${INSTALL_DIR} && git rev-list HEAD..origin/${branch.trim()} --count`,
      { timeout: 10000 }
    )

    // Get latest commit message from remote
    const { stdout: latestMessage } = await execAsync(
      `cd ${INSTALL_DIR} && git log origin/${branch.trim()} -1 --format="%s"`,
      { timeout: 10000 }
    )

    // Get current version from package.json
    const { stdout: packageJson } = await execAsync(
      `cd ${INSTALL_DIR}/web-dashboard && cat package.json`,
      { timeout: 5000 }
    )
    const pkg = JSON.parse(packageJson)

    const updateAvailable = localCommit.trim() !== remoteCommit.trim()
    const commitsBehind = parseInt(behindCount.trim(), 10)

    return NextResponse.json({
      success: true,
      data: {
        currentVersion: pkg.version || '1.0.0',
        currentCommit: localCommit.trim().substring(0, 8),
        latestCommit: remoteCommit.trim().substring(0, 8),
        branch: branch.trim(),
        updateAvailable,
        commitsBehind,
        latestMessage: latestMessage.trim(),
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Update check failed:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Update check failed',
      },
      { status: 500 }
    )
  }
}
