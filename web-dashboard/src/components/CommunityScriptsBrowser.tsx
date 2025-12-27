/**
 * Community Scripts Browser Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState, useEffect } from 'react'
import { Package, Search, Download, Loader2, ExternalLink, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  onImportComplete: () => void
}

interface Script {
  name: string
  slug: string
  description?: string
  categories?: number[]
  interface_port?: number | null
  logo?: string
}

interface ImportResult {
  success: boolean
  message: string
}

export default function CommunityScriptsBrowser({ onImportComplete }: Props) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    fetchScripts()
  }, [])

  const fetchScripts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sources/community-scripts')
      const data = await response.json()
      setScripts(data.scripts || [])
    } catch (error) {
      console.error('Failed to fetch scripts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (scriptName: string) => {
    setImporting(scriptName)
    setResult(null)

    try {
      const response = await fetch('/api/import/community-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scriptName }),
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

  const filteredScripts = scripts.filter((script) =>
    script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    script.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    script.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-orange-500" />
          <h2 className="text-xl font-semibold text-white">Community Scripts</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://community-scripts.github.io/ProxmoxVE/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-400"
          >
            <ExternalLink className="h-4 w-4" />
            Visit Site
          </a>
          <button
            onClick={fetchScripts}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <p className="text-slate-400">
        Browse and import from the official Proxmox VE Helper-Scripts collection.
        Over 400+ scripts for managing your Proxmox environment.
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search scripts..."
          className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {filteredScripts.map((script) => (
            <div
              key={script.slug || script.name}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {script.logo ? (
                  <img
                    src={script.logo}
                    alt=""
                    className="w-10 h-10 rounded object-contain bg-slate-800 p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center">
                    <Package className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{script.name}</h3>
                  {script.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                      {script.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {script.interface_port && (
                  <span className="text-xs text-slate-500">
                    Port: {script.interface_port}
                  </span>
                )}
                <button
                  onClick={() => handleImport(script.slug || script.name)}
                  disabled={importing === (script.slug || script.name)}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
                >
                  {importing === (script.slug || script.name) ? (
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

      {!loading && filteredScripts.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          {searchTerm ? 'No scripts match your search' : 'No scripts available'}
        </div>
      )}
    </div>
  )
}
