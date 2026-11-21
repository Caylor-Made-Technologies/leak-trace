// Reads screenshots ON THE PHONE. The text reader is Tesseract (open source, Apache-2.0), served by
// this app from /ocr/ and run in a background worker; it downloads once (~1.4 MB engine + ~2.9 MB English
// model, compressed; then cached for offline use). Nothing is sent anywhere: no server, no key, no cost.
// The text then goes through ocrParse.js and the usual checks (normalizeExtraction).
import { parseScreenshot } from './ocrParse.js'
import { normalizeExtraction } from './extract.js'
import { todayISO } from './dates.js'

const BASE = new URL('ocr/', document.baseURI).href
// Phone screenshots (~1170 px wide) are read at their own size: resizing by odd amounts blurs the small
// decimal points the reader needs. Only tiny or huge images are scaled (by a whole or simple factor).
function scaleFor(width) {
  if (width < 700) return 2
  if (width > 2000) return 0.5
  return 1
}

/** Grayscale, dark mode flipped to dark-on-light (the reader is trained on that), gently sharpened contrast. */
export async function prepareForReading(file) {
  const bmp = await createImageBitmap(file)
  const scale = scaleFor(bmp.width)
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = y
    sum += y
  }
  const dark = sum / (d.length / 4) < 110
  for (let i = 0; i < d.length; i += 4) {
    let y = dark ? 255 - d[i] : d[i]
    y = Math.max(0, Math.min(255, (y - 128) * 1.25 + 128))
    d[i] = d[i + 1] = d[i + 2] = y
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

let workerPromise = null
async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: BASE + 'worker.min.js',
        corePath: BASE, // the worker picks the engine build this phone's CPU supports
        langPath: BASE.replace(/\/$/, ''),
        gzip: true,
        workerBlobURL: false, // load the worker from our own origin (strict CSP)
        cacheMethod: 'none', // the service worker caches /ocr/ instead
        logger: (m) => onProgress?.(m),
      })
      // One block of text, rows kept together: a merchant and its amount stay on the same line.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
      return worker
    })().catch((e) => { workerPromise = null; throw e })
  }
  return workerPromise
}

/** Lines of text with the reader's confidence (0-100), top to bottom. */
function linesOf(page) {
  const out = []
  for (const b of page?.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const text = String(l.text || '').trim()
    if (text) out.push({ text, conf: Number(l.confidence) || 0 })
  }
  if (!out.length && page?.text) for (const t of page.text.split('\n')) if (t.trim()) out.push({ text: t.trim(), conf: Number(page.confidence) || 60 })
  return out
}

/**
 * Read up to 5 screenshots. onStep({ image, of, stage, progress }) reports progress for the UI.
 * @returns rows for the review screen, as normalizeExtraction gives them
 */
export async function readScreenshots(files, { onStep, signal } = {}) {
  const all = { document_type: 'other', masked_numbers: false, transactions: [] }
  const today = todayISO()
  let current = 0
  const worker = await getWorker((m) => onStep?.({ image: current + 1, of: files.length, stage: m.status, progress: m.progress }))
  for (const file of files) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    onStep?.({ image: current + 1, of: files.length, stage: 'preparing', progress: 0 })
    const canvas = await prepareForReading(file)
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
    canvas.width = canvas.height = 0 // free the pixels now
    const lines = linesOf(data)
    if (location.search.includes('debugocr')) (window.__ocrLines ||= []).push(lines) // QA only: what the reader saw
    const r = parseScreenshot(lines, { today })
    all.transactions.push(...r.transactions)
    all.masked_numbers ||= r.masked_numbers
    if (all.document_type === 'other') all.document_type = r.document_type
    current++
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  return normalizeExtraction(all)
}

/** Free the reader (about 30 MB of memory) when leaving the screen. */
export async function releaseReader() {
  const p = workerPromise
  workerPromise = null
  try { (await p)?.terminate() } catch { /* already gone */ }
}
