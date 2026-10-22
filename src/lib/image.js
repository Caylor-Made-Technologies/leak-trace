// Prepares a screenshot for reading: re-draws it on a canvas, which shrinks it
// and strips hidden photo data (location, device info). Nothing is saved.

export const MAX_IMAGES = 5
export const MAX_INPUT_BYTES = 20 * 1024 * 1024
const MAX_SIDE = 1800

export async function prepareImage(file) {
  if (!/^image\/(png|jpe?g|webp|heic|heif|gif)$/i.test(file.type) && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) {
    throw new Error(`${file.name} isn't a picture.`)
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name} is too big (20 MB max).`)
  const img = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  img.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error(`Couldn't read ${file.name}.`)
  const data = await blobToBase64(blob)
  return { media_type: 'image/jpeg', data, bytes: blob.size }
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file) } catch {}
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } catch {
    throw new Error(`Couldn't open ${file.name}. Try a PNG or JPG screenshot.`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(new Error('Could not read image'))
    r.readAsDataURL(blob)
  })
}
