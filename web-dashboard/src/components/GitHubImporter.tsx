/**
 * GitHub Importer Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState } from 'react'
import { Github, Download, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface Props {
  onImportComplete: () => void
}

interface ImportResult {
  success: boolean
  message: string
  slug?: string
  name?: string
}

export default function GitHubImporter({ onImportComplete }: Props) {
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('14')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const categories = [
    { id: '1', name: 'Automation' },
    { id: '2', name: 'Database' },
    { id: '3', name: 'Development' },
    { id: '4', name: 'Docker' },
    { id: '5', name: 'File Sharing' },
    { id: '6', name: 'Home Automation' },
    { id: '7', name: 'Media' },
    { id: '8', name: 'Monitoring' },
    { id: '9', name: 'Networking' },
    { id: '10', name: 'Security' },
    { id: '11', name: 'Storage' },
    { id: '12', name: 'Utilities' },
    { id: '13', name: 'Virtualization' },
    { id: '14', name: 'Custom' },
    { id: '15', name: 'Proxmox' },
  ]

  const handleImport = async () => {
    if (!url.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/import/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, category }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        onImportComplete()
        setUrl('')
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Github className="h-6 w-6 text-purple-500" />
        <h2 className="text-xl font-semibold text-white">Import from GitHub</h2>
      </div>

      <p className="text-slate-400">
        Import any GitHub repository. The importer will auto-detect the project type
        (Node.js, Python, Docker, Go, etc.) and generate the appropriate installation script.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="github-url" className="block text-sm font-medium text-slate-300 mb-2">
            GitHub Repository URL
          </label>
          <input
            id="github-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo or https://github.com/owner/repo/tree/branch"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleImport}
          disabled={!url.trim() || loading}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Import Repository
            </>
          )}
        </button>
      </div>

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
          <div>
            <p className={result.success ? 'text-green-300' : 'text-red-300'}>
              {result.message}
            </p>
            {result.success && result.name && (
              <p className="text-slate-400 text-sm mt-1">
                Script "{result.name}" is now available in PVEScriptsLocal
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Supported Project Types</h3>
        <div className="flex flex-wrap gap-2">
          {['Node.js', 'Python', 'Docker', 'Go', 'Rust', 'PHP', 'Generic'].map((type) => (
            <span
              key={type}
              className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
