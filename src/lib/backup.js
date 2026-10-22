import { sanitizeGoal, sanitizeTxn } from './sanitize.js'
import { isValidCategory } from './categories.js'

// Backups are plain JSON, optionally locked with a password
// (PBKDF2-SHA256 600k rounds → AES-256-GCM, all in the browser's WebCrypto).

export const APP_ID = 'money-leak-finder'
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
const MAX_TXNS = 50_000
const ITERATIONS = 600_000

export function buildBackup({ transactions, goals, merchantRules, settings }) {
  return {
    app: APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: transactions.map(({ id, ...t }) => t),
    goals: goals.map(({ id, ...g }) => g),
    merchantRules,
    settings,
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64(bytes) {
  let s = ''
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000))
  return btoa(s)
}
function unb64(str) {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ITERATIONS)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return { app: APP_ID, encrypted: true, version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) }
}

export async function decryptBackup(file, password) {
  const iterations = file.iterations
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 5_000_000) throw new Error('This backup file is damaged.')
  const key = await deriveKey(password, unb64(file.salt), iterations)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, key, unb64(file.data))
    return JSON.parse(dec.decode(plain))
  } catch {
    throw new Error('Wrong password, or the file was changed.')
  }
}

// Reads backup text. Returns { needsPassword } for locked files, otherwise the
// cleaned data. Everything is re-checked as if it came from a stranger.
export function readBackupText(text) {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('That file is too big.')
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error("That isn't a Money Leak Finder backup file.")
  }
  if (!obj || obj.app !== APP_ID) throw new Error("That isn't a Money Leak Finder backup file.")
  if (obj.encrypted) return { needsPassword: true, file: obj }
  return { data: cleanBackup(obj) }
}

export function cleanBackup(obj) {
  if (!obj || obj.app !== APP_ID || !Array.isArray(obj.transactions)) throw new Error("That isn't a Money Leak Finder backup file.")
  const rules = {}
  if (obj.merchantRules && typeof obj.merchantRules === 'object') {
    for (const [k, v] of Object.entries(obj.merchantRules).slice(0, 5000)) {
      if (typeof k === 'string' && k.length <= 60 && /^[a-z&'+ ]+$/.test(k) && isValidCategory(v, 'expense')) rules[k] = v
      else if (typeof k === 'string' && k.length <= 60 && /^[a-z&'+ ]+$/.test(k) && isValidCategory(v, 'income')) rules[k] = v
    }
  }
  const transactions = obj.transactions.slice(0, MAX_TXNS).map((t) => sanitizeTxn({ ...t, source: t?.source }, rules)).filter(Boolean)
  const goals = Array.isArray(obj.goals) ? obj.goals.slice(0, 50).map(sanitizeGoal).filter(Boolean) : []
  const settings = {}
  const s = obj.settings || {}
  if (Number.isInteger(s.hourlyWage) && s.hourlyWage > 0 && s.hourlyWage < 1_000_000) settings.hourlyWage = s.hourlyWage
  if (Array.isArray(s.plugged)) settings.plugged = s.plugged.filter((x) => typeof x === 'string' && x.length < 80).slice(0, 100)
  return { transactions, goals, merchantRules: rules, settings, skipped: obj.transactions.length - transactions.length }
}
