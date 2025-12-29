/**
 * Settings Dialog Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  X,
  Plus,
  Trash2,
  Key,
  Github,
  Globe,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Download,
  RefreshCw,
  Upload,
  Archive,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface Credential {
  id: string
  name: string
  provider: 'github' | 'gitea' | 'gitlab' | 'bitbucket' | 'custom'
  baseUrl?: string
  authType: 'token' | 'basic'
  username?: string
  hasToken: boolean
  createdAt: string
}

type Provider = 'github' | 'gitea' | 'gitlab' | 'bitbucket' | 'custom'
type AuthType = 'token' | 'basic'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

const providerOptions = [
  { value: 'github' as Provider, label: 'GitHub', icon: Github },
  { value: 'gitlab' as Provider, label: 'GitLab', icon: Globe },
  { value: 'gitea' as Provider, label: 'Gitea', icon: Globe },
  { value: 'bitbucket' as Provider, label: 'Bitbucket', icon: Globe },
  { value: 'custom' as Provider, label: 'Custom/Self-hosted', icon: Globe },
]

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

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'credentials' | 'general'>('credentials')
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Update state
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)

  // Settings state
  const [autoApplyUpdates, setAutoApplyUpdates] = useState(false)
  const [backupBeforeUpdate, setBackupBeforeUpdate] = useState(true)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // New credential form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newCred, setNewCred] = useState<{
    name: string
    provider: Provider
    baseUrl: string
    authType: AuthType
    username: string
    token: string
  }>({
    name: '',
    provider: 'github',
    baseUrl: '',
    authType: 'token',
    username: '',
    token: '',
  })
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadCredentials()
      loadSettingsData()
    }
  }, [isOpen])

  const loadSettingsData = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success) {
        setAutoApplyUpdates(data.data.autoApplyUpdates || false)
        setBackupBeforeUpdate(data.data.backupBeforeUpdate ?? true)
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  const saveSettingsData = async (updates: Record<string, boolean>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Settings saved')
        setTimeout(() => setSuccess(null), 2000)
      }
    } catch (e) {
      setError('Failed to save settings')
    }
  }

  const handleBackup = async () => {
    setBackupLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/system/backup')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pvescripts-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setSuccess('Backup downloaded')
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError('Backup failed')
      }
    } catch (e) {
      setError('Backup failed')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('This will overwrite your current imports and settings. Continue?')) {
      event.target.value = ''
      return
    }

    setRestoreLoading(true)
    setError(null)
    try {
      const content = await file.text()
      const backup = JSON.parse(content)

      const res = await fetch('/api/system/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(data.message)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Invalid backup file')
    } finally {
      setRestoreLoading(false)
      event.target.value = ''
    }
  }

  const loadCredentials = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/credentials')
      const data = await res.json()
      if (data.success) {
        setCredentials(data.data)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setError(null)
    try {
      const res = await fetch('/api/system/update-check')
      const data = await res.json()
      if (data.success) {
        setUpdateInfo(data.data)
        if (!data.data.updateAvailable) {
          setSuccess('You are running the latest version!')
          setTimeout(() => setSuccess(null), 3000)
        }
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to check for updates')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const applyUpdate = async () => {
    if (!confirm('This will update the dashboard and restart the service. Continue?')) {
      return
    }

    setApplyingUpdate(true)
    setError(null)
    try {
      const res = await fetch('/api/system/update-apply', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSuccess('Update applied! The page will reload when ready...')
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to apply update')
    } finally {
      setApplyingUpdate(false)
    }
  }

  const handleAddCredential = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCred),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Credential added successfully')
        setShowNewForm(false)
        setNewCred({
          name: '',
          provider: 'github',
          baseUrl: '',
          authType: 'token',
          username: '',
          token: '',
        })
        loadCredentials()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to add credential')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCredential = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/settings/credentials/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Credential deleted')
        loadCredentials()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message)
      }
    } catch (e) {
      setError('Failed to delete credential')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'credentials'
                ? 'text-white border-b-2 border-green-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="h-4 w-4 inline-block mr-2" />
            Git Credentials
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-white border-b-2 border-green-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4 inline-block mr-2" />
            General
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
              <Check className="h-4 w-4" />
              {success}
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">
                  Add credentials to import from private repositories
                </p>
                {!showNewForm && (
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Credential
                  </button>
                )}
              </div>

              {/* New Credential Form */}
              {showNewForm && (
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 space-y-4">
                  <h3 className="text-white font-medium">New Credential</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={newCred.name}
                        onChange={(e) => setNewCred({ ...newCred, name: e.target.value })}
                        placeholder="My GitHub Token"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Provider</label>
                      <select
                        value={newCred.provider}
                        onChange={(e) =>
                          setNewCred({ ...newCred, provider: e.target.value as Provider })
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                      >
                        {providerOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(newCred.provider === 'gitea' || newCred.provider === 'custom') && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Base URL (e.g., https://git.example.com)
                      </label>
                      <input
                        type="url"
                        value={newCred.baseUrl}
                        onChange={(e) => setNewCred({ ...newCred, baseUrl: e.target.value })}
                        placeholder="https://git.example.com"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Auth Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="radio"
                          name="authType"
                          value="token"
                          checked={newCred.authType === 'token'}
                          onChange={() => setNewCred({ ...newCred, authType: 'token' })}
                          className="text-green-500"
                        />
                        Personal Access Token
                      </label>
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="radio"
                          name="authType"
                          value="basic"
                          checked={newCred.authType === 'basic'}
                          onChange={() => setNewCred({ ...newCred, authType: 'basic' })}
                          className="text-green-500"
                        />
                        Username & Password
                      </label>
                    </div>
                  </div>

                  {newCred.authType === 'basic' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={newCred.username}
                        onChange={(e) => setNewCred({ ...newCred, username: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {newCred.authType === 'token' ? 'Personal Access Token' : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={newCred.token}
                        onChange={(e) => setNewCred({ ...newCred, token: e.target.value })}
                        placeholder={
                          newCred.authType === 'token' ? 'ghp_xxxxxxxxxxxx' : '••••••••'
                        }
                        className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newCred.provider === 'github' && newCred.authType === 'token' && (
                      <p className="mt-1 text-xs text-slate-500">
                        Create a token at GitHub → Settings → Developer settings → Personal access tokens
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCredential}
                      disabled={loading || !newCred.name || !newCred.token}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {loading ? 'Adding...' : 'Add Credential'}
                    </button>
                  </div>
                </div>
              )}

              {/* Credentials List */}
              <div className="space-y-2">
                {credentials.length === 0 && !showNewForm ? (
                  <div className="text-center py-8 text-slate-400">
                    <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No credentials configured</p>
                    <p className="text-sm mt-1">Add credentials to import from private repositories</p>
                  </div>
                ) : (
                  credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700 rounded-lg">
                          {cred.provider === 'github' ? (
                            <Github className="h-5 w-5 text-white" />
                          ) : (
                            <Globe className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">{cred.name}</div>
                          <div className="text-sm text-slate-400">
                            {cred.provider.charAt(0).toUpperCase() + cred.provider.slice(1)}
                            {cred.baseUrl && ` • ${cred.baseUrl}`}
                            {' • '}
                            {cred.authType === 'token' ? 'Token' : `${cred.username}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCredential(cred.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Updates Section */}
              <div className="space-y-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Software Updates
                </h3>

                <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                  {updateInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white">
                            Version: <span className="text-slate-400">{updateInfo.currentVersion}</span>
                          </p>
                          <p className="text-sm text-slate-400">
                            Commit: {updateInfo.currentCommit} on {updateInfo.branch}
                          </p>
                        </div>
                        {updateInfo.updateAvailable ? (
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                            Update available
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-600/50 text-slate-400 text-xs rounded-full">
                            Up to date
                          </span>
                        )}
                      </div>

                      {updateInfo.updateAvailable && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm">
                            {updateInfo.commitsBehind} commit{updateInfo.commitsBehind > 1 ? 's' : ''} behind
                          </p>
                          <p className="text-slate-300 text-sm mt-1">
                            Latest: {updateInfo.latestMessage}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={checkForUpdates}
                          disabled={checkingUpdate || applyingUpdate}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                        >
                          <RefreshCw className={`h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
                          Check Again
                        </button>
                        {updateInfo.updateAvailable && (
                          <button
                            onClick={applyUpdate}
                            disabled={applyingUpdate || checkingUpdate}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                          >
                            {applyingUpdate ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                Apply Update
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">
                        Last checked: {new Date(updateInfo.checkedAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <button
                        onClick={checkForUpdates}
                        disabled={checkingUpdate}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors mx-auto"
                      >
                        {checkingUpdate ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Check for Updates
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Update Settings */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Update Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600 cursor-pointer hover:border-slate-500 transition-colors">
                    <div>
                      <p className="text-white text-sm">Auto-apply updates</p>
                      <p className="text-slate-400 text-xs">Automatically install updates when available</p>
                    </div>
                    <button
                      onClick={() => {
                        const newValue = !autoApplyUpdates
                        setAutoApplyUpdates(newValue)
                        saveSettingsData({ autoApplyUpdates: newValue })
                      }}
                      className="text-green-500"
                    >
                      {autoApplyUpdates ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-slate-500" />
                      )}
                    </button>
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600 cursor-pointer hover:border-slate-500 transition-colors">
                    <div>
                      <p className="text-white text-sm">Backup before update</p>
                      <p className="text-slate-400 text-xs">Create automatic backup before applying updates</p>
                    </div>
                    <button
                      onClick={() => {
                        const newValue = !backupBeforeUpdate
                        setBackupBeforeUpdate(newValue)
                        saveSettingsData({ backupBeforeUpdate: newValue })
                      }}
                      className="text-green-500"
                    >
                      {backupBeforeUpdate ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-slate-500" />
                      )}
                    </button>
                  </label>
                </div>
              </div>

              {/* Backup & Restore */}
              <div className="space-y-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Backup & Restore
                </h3>
                <p className="text-slate-400 text-sm">
                  Export your imports and settings, or restore from a previous backup.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleBackup}
                    disabled={backupLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                  >
                    {backupLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export Backup
                  </button>

                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors cursor-pointer">
                    {restoreLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import Backup
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestore}
                      disabled={restoreLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* About Section */}
              <div className="space-y-2">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  About
                </h3>
                <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600 text-sm text-slate-400">
                  <p>PVEScripts Importer Dashboard</p>
                  <p className="mt-1">Import custom scripts into your PVEScriptsLocal installation.</p>
                  <p className="mt-2 text-slate-500">MIT License - © 2024-2025 b0bfranklin</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
