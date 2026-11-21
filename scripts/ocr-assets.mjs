// Copies the on-device text reader (Tesseract, Apache-2.0) into public/ocr/ so the app serves it
// itself: no CDN, works offline once cached. Runs before dev and build; public/ocr/ is not committed.
//   worker.min.js                      tesseract.js worker (runs off the main thread)
//   tesseract-core-*-lstm.wasm.js      the engine; the phone loads only the one its CPU supports
//   eng.traineddata.gz                 English model (4.0.0_best_int)
import { copyFileSync, mkdirSync, statSync } from 'node:fs'

const out = 'public/ocr'
mkdirSync(out, { recursive: true })
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]
for (const [from, to] of files) {
  copyFileSync(from, `${out}/${to}`)
  console.log(`ocr: ${to} (${Math.round(statSync(from).size / 1024)} KB)`)
}
