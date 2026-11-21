import { useEffect, useState } from 'react'
import { API_URL } from './extract.js'

// Is screenshot reading switched on? Asked once per visit from the reader's /health
// (which only says yes or no). 'off' = not set up, so the app doesn't offer it;
// 'unknown' = couldn't ask (offline), so it's offered and any error is explained then.
let cached = API_URL ? null : 'off'
let pending = null

export function readerStatus() {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 4000)
    pending = fetch(`${API_URL}/health`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { cached = b && b.reader === true ? 'ready' : b && b.reader === false ? 'off' : 'unknown'; return cached })
      .catch(() => 'unknown')
      .finally(() => { clearTimeout(t); pending = null })
  }
  return pending
}

export function useReaderStatus() {
  const [s, setS] = useState(cached || 'unknown')
  useEffect(() => { let alive = true; readerStatus().then((v) => alive && setS(v)); return () => { alive = false } }, [])
  return s
}
