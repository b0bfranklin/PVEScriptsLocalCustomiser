/**
 * Imported Scripts List Component
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

'use client'

import { useState, useEffect } from 'react'
import { Settings, Trash2, RefreshCw, Loader2, ExternalLink, Clock, Github, Package, AlertCircle, FolderOpen, Check } from 'lucide-react'

interface ImportedScript {
  slug: string
  name: string
  source: string
  sourceType: 'github' | 'community-scripts' | 'selfhst'
  importedAt: string
  category?: string
  categoryId?: number
}

interface Category {
  id: number
  name: string
  isCustom?: boolean
}

export default function ImportedScripts() {
  const [scripts, setScripts] = useState<ImportedScript[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [changingCategory, setChangingCategory] = useState<string | null>(null)
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchImports()
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const fetchImports = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/imports')
      const data = await response.json()
      setScripts(data.imports || [])
    } catch (error) {
      console.error('Failed to fetch imports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (slug: string) => {
    setUpdating(slug)
    try {
      await fetch(`/api/imports/${slug}/update`, { method: 'POST' })
      await fetchImports()
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!confirm(`Are you sure you want to remove "${slug}"?`)) return

    setDeleting(slug)
    try {
      await fetch(`/api/imports/${slug}`, { method: 'DELETE' })
      await fetchImports()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setDeleting(null)
    }
  }

  const handleCategoryChange = async (slug: string, categoryId: number) => {
    setChangingCategory(slug)
    try {
      const res = await fetch(`/api/imports/${slug}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      })
      const data = await res.json()
      if (data.success) {
        setCategorySuccess(slug)
        await fetchImports()
        setTimeout(() => setCategorySuccess(null), 2000)
      }
    } catch (error) {
      console.error('Failed to change category:', error)
    } finally {
      setChangingCategory(null)
    }
  }

  const getCategoryName = (categoryId?: number): string => {
    if (categoryId === undefined) return 'Custom'
    const cat = categories.find(c => c.id === categoryId)
    return cat?.name || 'Custom'
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'github':
        return <Github className="h-4 w-4 text-purple-500" />
      case 'community-scripts':
        return <Package className="h-4 w-4 text-orange-500" />
      case 'selfhst':
        return <Settings className="h-4 w-4 text-blue-500" />
      default:
        return <Package className="h-4 w-4 text-slate-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-green-500" />
          <h2 className="text-xl font-semibold text-white">My Imports</h2>
        </div>
        <button
          onClick={fetchImports}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="text-slate-400">
        Manage scripts you've imported into PVEScriptsLocal. Update them from source
        or remove them when no longer needed.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No imported scripts yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Import scripts from the other tabs to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => (
            <div
              key={script.slug}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-green-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(script.sourceType)}
                    <h3 className="font-medium text-white">{script.name || script.slug}</h3>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(script.importedAt)}
                    </span>
                    {script.source && (
                      <a
                        href={script.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-white truncate max-w-xs"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{script.source.replace('https://github.com/', '')}</span>
                      </a>
                    )}
                  </div>
                  {/* Category Selector */}
                  <div className="flex items-center gap-2 mt-3">
                    <FolderOpen className="h-3 w-3 text-slate-500" />
                    <select
                      value={script.categoryId ?? 14}
                      onChange={(e) => handleCategoryChange(script.slug, parseInt(e.target.value))}
                      disabled={changingCategory === script.slug}
                      className="text-xs px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <optgroup label="Built-in Categories">
                        {categories.filter(c => !c.isCustom).map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </optgroup>
                      {categories.some(c => c.isCustom) && (
                        <optgroup label="Custom Categories">
                          {categories.filter(c => c.isCustom).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {changingCategory === script.slug && (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                    {categorySuccess === script.slug && (
                      <Check className="h-3 w-3 text-green-400" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdate(script.slug)}
                    disabled={updating === script.slug}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
                  >
                    {updating === script.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Update
                  </button>
                  <button
                    onClick={() => handleDelete(script.slug)}
                    disabled={deleting === script.slug}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-900 disabled:opacity-50 text-red-300 text-sm rounded transition-colors"
                  >
                    {deleting === script.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
