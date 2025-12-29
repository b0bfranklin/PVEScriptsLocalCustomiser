/**
 * PVEScripts Importer - Main Dashboard Page
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT (see LICENSE file)
 */

'use client'

import { useState, useEffect } from 'react'
import { Github, Globe, Package, FolderOpen, ExternalLink, Cog, Download } from 'lucide-react'
import GitHubImporter from '@/components/GitHubImporter'
import SelfhstBrowser from '@/components/SelfhstBrowser'
import ImportedScripts from '@/components/ImportedScripts'
import UpdateBanner from '@/components/UpdateBanner'
import SettingsDialog from '@/components/SettingsDialog'

type Tab = 'github' | 'selfhst' | 'imported'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('selfhst')
  const [refreshKey, setRefreshKey] = useState(0)
  const [pveScriptsUrl, setPveScriptsUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    // Build PVEScriptsLocal URL using current hostname
    const host = window.location.hostname
    setPveScriptsUrl(`http://${host}:3000`)
  }, [])

  const tabs = [
    { id: 'selfhst' as Tab, label: 'selfh.st Apps', icon: Globe, color: 'text-blue-500' },
    { id: 'github' as Tab, label: 'GitHub Import', icon: Github, color: 'text-purple-500' },
    { id: 'imported' as Tab, label: 'My Imports', icon: FolderOpen, color: 'text-green-500' },
  ]

  const handleImportComplete = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <>
      {/* Update Banner */}
      <UpdateBanner />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Package className="h-8 w-8 text-orange-500" />
              PVEScripts Importer
            </h1>
            <p className="text-slate-400 mt-1">
              Import scripts into your PVEScriptsLocal installation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              title="Settings"
            >
              <Cog className="h-4 w-4" />
              Settings
            </button>
            {pveScriptsUrl && (
              <a
                href={pveScriptsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open PVEScriptsLocal
              </a>
            )}
          </div>
        </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? tab.color : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        {activeTab === 'github' && (
          <GitHubImporter onImportComplete={handleImportComplete} />
        )}
        {activeTab === 'selfhst' && (
          <SelfhstBrowser onImportComplete={handleImportComplete} />
        )}
        {activeTab === 'imported' && (
          <ImportedScripts key={refreshKey} />
        )}
      </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>
            Compatible with{' '}
            <a href="https://community-scripts.github.io/ProxmoxVE/" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">
              ProxmoxVE Community Scripts
            </a>
            {' '}and{' '}
            <a href="https://selfh.st/apps/" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
              selfh.st
            </a>
          </p>
          <p className="mt-1">MIT License - Imported content retains its original license</p>
        </div>
      </main>

      {/* Settings Dialog */}
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
