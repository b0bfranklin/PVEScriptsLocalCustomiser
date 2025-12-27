/**
 * PVEScripts Importer - Web Dashboard
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT (see LICENSE file)
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PVEScripts Importer',
  description: 'Import scripts into PVEScriptsLocal from GitHub, community-scripts, and selfh.st',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
          {children}
        </div>
      </body>
    </html>
  )
}
