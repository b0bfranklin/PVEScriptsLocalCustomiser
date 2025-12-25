/**
 * PVEScripts Importer - Main Dashboard Page
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT (see LICENSE file)
 */

'use client'

import { useState } from 'react'
import { Github, Globe, Package, Settings, ExternalLink, RefreshCw } from 'lucide-react'
import GitHubImporter from '@/components/GitHubImporter'
import CommunityScriptsBrowser from '@/components/CommunityScriptsBrowser'
import SelfhstBrowser from '@/components/SelfhstBrowser'
import ImportedScripts from '@/components/ImportedScripts'

type Tab = 'github' | 'community' | 'selfhst' | 'imported'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('community')
  const [refreshKey, setRefreshKey] = useState(0)

  const tabs = [
    { id: 'community' as Tab, label: 'Community Scripts', icon: Package, color: 'text-orange-500' },
    { id: 'selfhst' as Tab, label: 'selfh.st Apps', icon: Globe, color: 'text-blue-500' },
    { id: 'github' as Tab, label: 'GitHub Import', icon: Github, color: 'text-purple-500' },
    { id: 'imported' as Tab, label: 'My Imports', icon: Settings, color: 'text-green-500' },
  ]

  const handleImportComplete = () => {
    setRefreshKey(k => k + 1)
  }

  return (
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
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Open PVEScriptsLocal
        </a>
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
        {activeTab === 'community' && (
          <CommunityScriptsBrowser onImportComplete={handleImportComplete} />
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
  )
}
