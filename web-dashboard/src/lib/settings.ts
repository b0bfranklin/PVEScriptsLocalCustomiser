/**
 * Settings and Credentials Management
 *
 * Copyright (c) 2024-2025 b0bfranklin
 * License: MIT
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const SETTINGS_DIR = process.env.SETTINGS_DIR || '/opt/pvescripts-customiser/config'
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json')
const CREDENTIALS_FILE = join(SETTINGS_DIR, '.credentials.enc')

// Simple encryption key derived from machine ID or fallback
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pvescripts-local-default-key-32b'

export interface GitCredential {
  id: string
  name: string
  provider: 'github' | 'gitea' | 'gitlab' | 'bitbucket' | 'custom'
  baseUrl?: string // For self-hosted instances
  authType: 'token' | 'basic' | 'ssh'
  username?: string
  token?: string // Personal access token or password
  createdAt: string
  updatedAt: string
}

export interface Settings {
  autoCheckUpdates: boolean
  updateCheckInterval: number // hours
  lastUpdateCheck?: string
  defaultCredentialId?: string
}

const defaultSettings: Settings = {
  autoCheckUpdates: true,
  updateCheckInterval: 24,
}

async function ensureSettingsDir(): Promise<void> {
  try {
    await access(SETTINGS_DIR, constants.W_OK)
  } catch {
    await mkdir(SETTINGS_DIR, { recursive: true })
  }
}

// Encryption helpers
function encrypt(text: string): string {
  const iv = randomBytes(16)
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Settings management
export async function loadSettings(): Promise<Settings> {
  try {
    await ensureSettingsDir()
    const data = await readFile(SETTINGS_FILE, 'utf-8')
    return { ...defaultSettings, ...JSON.parse(data) }
  } catch {
    return defaultSettings
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ensureSettingsDir()
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

// Credentials management
export async function loadCredentials(): Promise<GitCredential[]> {
  try {
    await ensureSettingsDir()
    const encryptedData = await readFile(CREDENTIALS_FILE, 'utf-8')
    const decrypted = decrypt(encryptedData)
    return JSON.parse(decrypted)
  } catch {
    return []
  }
}

export async function saveCredentials(credentials: GitCredential[]): Promise<void> {
  await ensureSettingsDir()
  const encrypted = encrypt(JSON.stringify(credentials))
  await writeFile(CREDENTIALS_FILE, encrypted, { mode: 0o600 })
}

export async function addCredential(credential: Omit<GitCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitCredential> {
  const credentials = await loadCredentials()

  const newCredential: GitCredential = {
    ...credential,
    id: randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  credentials.push(newCredential)
  await saveCredentials(credentials)

  return newCredential
}

export async function updateCredential(id: string, updates: Partial<GitCredential>): Promise<GitCredential | null> {
  const credentials = await loadCredentials()
  const index = credentials.findIndex(c => c.id === id)

  if (index === -1) return null

  credentials[index] = {
    ...credentials[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await saveCredentials(credentials)
  return credentials[index]
}

export async function deleteCredential(id: string): Promise<boolean> {
  const credentials = await loadCredentials()
  const filtered = credentials.filter(c => c.id !== id)

  if (filtered.length === credentials.length) return false

  await saveCredentials(filtered)
  return true
}

export async function getCredentialById(id: string): Promise<GitCredential | null> {
  const credentials = await loadCredentials()
  return credentials.find(c => c.id === id) || null
}

// Get credential for a specific URL
export async function getCredentialForUrl(url: string): Promise<GitCredential | null> {
  const credentials = await loadCredentials()

  // Match by provider
  if (url.includes('github.com')) {
    return credentials.find(c => c.provider === 'github') || null
  }
  if (url.includes('gitlab.com')) {
    return credentials.find(c => c.provider === 'gitlab') || null
  }
  if (url.includes('bitbucket.org')) {
    return credentials.find(c => c.provider === 'bitbucket') || null
  }

  // Check custom URLs
  for (const cred of credentials) {
    if (cred.baseUrl && url.includes(cred.baseUrl)) {
      return cred
    }
  }

  // Check for gitea instances
  const giteaCred = credentials.find(c => c.provider === 'gitea')
  if (giteaCred && giteaCred.baseUrl && url.includes(giteaCred.baseUrl)) {
    return giteaCred
  }

  return null
}

// Build authenticated URL for git operations
export function buildAuthenticatedUrl(url: string, credential: GitCredential): string {
  if (credential.authType === 'token' && credential.token) {
    // For GitHub/GitLab/Gitea, use token in URL
    const urlObj = new URL(url)
    if (credential.provider === 'github') {
      urlObj.username = credential.token
      urlObj.password = 'x-oauth-basic'
    } else if (credential.provider === 'gitlab') {
      urlObj.username = 'oauth2'
      urlObj.password = credential.token
    } else {
      // Gitea and others
      urlObj.username = credential.username || credential.token
      urlObj.password = credential.token
    }
    return urlObj.toString()
  }

  if (credential.authType === 'basic' && credential.username && credential.token) {
    const urlObj = new URL(url)
    urlObj.username = credential.username
    urlObj.password = credential.token
    return urlObj.toString()
  }

  return url
}

// Build authorization header for API requests
export function buildAuthHeader(credential: GitCredential): Record<string, string> {
  if (credential.authType === 'token' && credential.token) {
    if (credential.provider === 'github') {
      return { Authorization: `Bearer ${credential.token}` }
    }
    if (credential.provider === 'gitlab') {
      return { 'PRIVATE-TOKEN': credential.token }
    }
    // Gitea uses same as GitHub
    return { Authorization: `token ${credential.token}` }
  }

  if (credential.authType === 'basic' && credential.username && credential.token) {
    const encoded = Buffer.from(`${credential.username}:${credential.token}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }

  return {}
}
