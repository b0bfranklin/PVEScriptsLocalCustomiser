/**
 * selfh.st Apps Browser Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState, useEffect } from 'react'
import { Globe, Search, Download, Loader2, ExternalLink, RefreshCw, Star, CheckCircle, AlertCircle, Github } from 'lucide-react'

interface Props {
  onImportComplete: () => void
}

interface App {
  name: string
  description?: string
  repo?: string
  stars?: number
  icon?: string
  tags?: string[]
  lastCommit?: string
}

interface ImportResult {
  success: boolean
  message: string
}

// Proxy icon URL through our cache
const getProxiedIconUrl = (url: string): string => {
  if (!url || url.startsWith('/api/icons/')) return url
  try {
    const parsed = new URL(url)
    return `/api/icons/${parsed.protocol.replace(':', '')}/${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}

// Get GitHub avatar from repo URL
const getGithubAvatarUrl = (repoUrl: string): string => {
  const match = repoUrl.match(/github\.com\/([^/]+)/)
  if (match) {
    return `/api/icons/https/github.com/${match[1]}.png?size=80`
  }
  return ''
}

export default function SelfhstBrowser({ onImportComplete }: Props) {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [sortBy, setSortBy] = useState<'stars' | 'name'>('stars')

  // Debounce search for API queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchApps()
  }, [debouncedSearch])

  const fetchApps = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('q', debouncedSearch)
      const response = await fetch(`/api/sources/selfhst?${params}`)
      const data = await response.json()
      setApps(data.apps || [])
    } catch (error) {
      console.error('Failed to fetch apps:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (app: App) => {
    if (!app.repo) {
      setResult({
        success: false,
        message: `No GitHub repository found for ${app.name}`,
      })
      return
    }

    setImporting(app.name)
    setResult(null)

    try {
      const response = await fetch('/api/import/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: app.repo, category: '14' }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        onImportComplete()
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      })
    } finally {
      setImporting(null)
    }
  }

  // Sort apps (filtering is now done server-side)
  const sortedApps = [...apps].sort((a, b) => {
    if (sortBy === 'stars') {
      return (b.stars || 0) - (a.stars || 0)
    }
    return a.name.localeCompare(b.name)
  })

  const formatStars = (stars?: number) => {
    if (!stars) return '0'
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`
    return stars.toString()
  }

  // App icon component with fallback
  const AppIcon = ({ app }: { app: App }) => {
    const [imgError, setImgError] = useState(false)
    const iconUrl = app.icon ? getProxiedIconUrl(app.icon) : app.repo ? getGithubAvatarUrl(app.repo) : null

    if (!iconUrl || imgError) {
      return (
        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Globe className="h-5 w-5 text-slate-500" />
        </div>
      )
    }

    return (
      <img
        src={iconUrl}
        alt=""
        className="w-10 h-10 rounded object-contain bg-slate-800 p-1 flex-shrink-0"
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">selfh.st Apps</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://selfh.st/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400"
          >
            <ExternalLink className="h-4 w-4" />
            Visit Site
          </a>
          <button
            onClick={fetchApps}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <p className="text-slate-400">
        Browse the selfh.st directory of self-hosted software. Apps with GitHub repositories
        can be imported directly into PVEScriptsLocal.
      </p>

      {result && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg ${
            result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
          }`}
        >
          {result.success ? (
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <p className={result.success ? 'text-green-300' : 'text-red-300'}>
            {result.message}
          </p>
        </div>
      )}

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search apps..."
            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'stars' | 'name')}
          className="px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="stars">Sort by Stars</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {sortedApps.slice(0, 100).map((app) => (
            <div
              key={app.name}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <AppIcon app={app} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate">{app.name}</h3>
                    {app.stars && (
                      <span className="flex items-center gap-1 text-xs text-yellow-500">
                        <Star className="h-3 w-3 fill-current" />
                        {formatStars(app.stars)}
                      </span>
                    )}
                  </div>
                  {app.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                      {app.description}
                    </p>
                  )}
                </div>
              </div>

              {app.tags && app.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {app.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                {app.repo ? (
                  <a
                    href={app.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                  >
                    <Github className="h-3 w-3" />
                    GitHub
                  </a>
                ) : (
                  <span className="text-xs text-slate-600">No repo</span>
                )}
                <button
                  onClick={() => handleImport(app)}
                  disabled={!app.repo || importing === app.name}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                >
                  {importing === app.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Import
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sortedApps.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          {searchTerm ? 'No apps match your search' : 'No apps available'}
        </div>
      )}

      {!loading && sortedApps.length > 100 && (
        <p className="text-center text-slate-500 text-sm">
          Showing first 100 results. Refine your search to see more.
        </p>
      )}
    </div>
  )
}
