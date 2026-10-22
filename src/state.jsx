import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from './db.js'
import { currentMonth } from './lib/dates.js'
import { findLeaks } from './lib/leaks.js'
import { typicalLeftover } from './lib/stats.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

function readLocal(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLocal(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch {}
}

export function AppProvider({ children }) {
  const txns = useLiveQuery(() => db.transactions.toArray(), [], null)
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray(), [], [])
  const settingsRows = useLiveQuery(() => db.settings.toArray(), [], [])
  const settings = useMemo(() => Object.fromEntries((settingsRows || []).map((r) => [r.key, r.value])), [settingsRows])

  const [month, setMonth] = useState(currentMonth())
  const [privacy, setPrivacy] = useState(() => readLocal('mlf.privacy', '0') === '1')
  const [theme, setThemeState] = useState(() => readLocal('mlf.theme', 'system'))
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const setTheme = useCallback((t) => {
    setThemeState(t)
    writeLocal('mlf.theme', t === 'system' ? null : t)
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }, [])
  const dark = theme === 'dark' || (theme === 'system' && systemDark)

  const togglePrivacy = useCallback(() => {
    setPrivacy((p) => { writeLocal('mlf.privacy', p ? '0' : '1'); return !p })
  }, [])

  // Auto-hide amounts when the app goes to the background (app switcher previews).
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden' && settings.autoHide !== false) document.documentElement.classList.add('privacy')
      else if (!privacy) document.documentElement.classList.remove('privacy')
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [privacy, settings.autoHide])
  useEffect(() => { document.documentElement.classList.toggle('privacy', privacy) }, [privacy])

  // Jump to the newest month with data on first load if this month is empty.
  const [jumped, setJumped] = useState(false)
  useEffect(() => {
    if (jumped || !txns) return
    setJumped(true)
    if (!txns.length) return
    const cm = currentMonth()
    if (!txns.some((t) => t.date.startsWith(cm))) {
      const latest = txns.reduce((a, t) => (t.date > a ? t.date : a), '0000')
      setMonth(latest.slice(0, 7))
    }
  }, [txns, jumped])

  const leaks = useMemo(() => (txns ? findLeaks(txns, month) : []), [txns, month])
  const plugged = useMemo(() => new Set(settings.plugged || []), [settings.plugged])
  const pluggedSavings = useMemo(() => leaks.filter((l) => plugged.has(l.id)).reduce((s, l) => s + l.savable, 0), [leaks, plugged])
  const leftover = useMemo(() => (txns ? typicalLeftover(txns, month) : 0), [txns, month])

  const togglePlug = useCallback(async (id) => {
    const next = new Set(plugged)
    next.has(id) ? next.delete(id) : next.add(id)
    await setSetting('plugged', [...next])
    return next.has(id)
  }, [plugged])

  const showToast = useCallback((message, action) => {
    setToast({ id: Date.now(), message, action })
  }, [])

  const value = {
    txns: txns || [], loading: txns === null, goals: goals || [], settings,
    month, setMonth, privacy, togglePrivacy, theme, setTheme, dark,
    leaks, plugged, togglePlug, pluggedSavings, leftover,
    toast, setToast, showToast,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// Chart colors (validated categorical slots, stepped per theme).
export function useChartColors() {
  const { dark } = useApp()
  return dark
    ? { s1: '#3987e5', s2: '#d95926', s3: '#199e70', grid: 'rgba(255,255,255,0.07)', axis: '#a3b1c4', surface: '#121a26', muted: '#7c8ba0' }
    : { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', grid: 'rgba(13,23,38,0.08)', axis: '#46566c', surface: '#ffffff', muted: '#5e6e84' }
}
