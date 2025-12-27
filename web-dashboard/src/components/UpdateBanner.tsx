/**
 * Update Banner Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState, useEffect } from 'react'
import { Download, RefreshCw, X, Check, AlertCircle } from 'lucide-react'

interface UpdateInfo {
  currentVersion: string
  currentCommit: string
  latestCommit: string
  branch: string
  updateAvailable: boolean
  commitsBehind: number
  latestMessage: string
  checkedAt: string
}

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/system/update-check')
      const data = await res.json()
      if (data.success) {
        setUpdateInfo(data.data)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }

  const applyUpdate = async () => {
    if (!confirm('This will update the dashboard and restart the service. Continue?')) {
      return
    }

    setUpdating(true)
    setError(null)
    try {
      const res = await fetch('/api/system/update-apply', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSuccess('Update applied! The page will reload when ready...')
        // Wait for service restart then reload
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to apply update')
    } finally {
      setUpdating(false)
    }
  }

  // Don't show if dismissed or no update available
  if (dismissed || !updateInfo?.updateAvailable) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-green-500/30">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Download className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="text-white font-medium">
                Update Available
                <span className="ml-2 text-sm text-green-400">
                  ({updateInfo.commitsBehind} commit{updateInfo.commitsBehind > 1 ? 's' : ''} behind)
                </span>
              </div>
              <div className="text-sm text-slate-300">
                {updateInfo.currentCommit} → {updateInfo.latestCommit}: {updateInfo.latestMessage}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
            )}
            {success && (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <Check className="h-4 w-4" />
                {success}
              </span>
            )}

            <button
              onClick={checkForUpdates}
              disabled={checking || updating}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={applyUpdate}
              disabled={updating || checking}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Update Now
                </>
              )}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
