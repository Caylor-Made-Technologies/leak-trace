// Input checks for the extraction API. Kept separate so they can be unit tested.

export const MAX_BODY_BYTES = 8 * 1024 * 1024
export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 3_750_000 // decoded; the API's per-image limit is 5 MB base64

const TYPES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
}

export class InputError extends Error {}

export function parseOrigins(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean)
}

export function validateImages(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.images)) throw new InputError('Send { images: [...] }.')
  const keys = Object.keys(body)
  if (keys.some((k) => k !== 'images')) throw new InputError('Unexpected fields.')
  if (body.images.length < 1 || body.images.length > MAX_IMAGES) throw new InputError(`Send 1 to ${MAX_IMAGES} images.`)
  return body.images.map((img, i) => {
    if (!img || typeof img !== 'object') throw new InputError(`Image ${i + 1} is invalid.`)
    const { media_type, data } = img
    if (!TYPES[media_type]) throw new InputError(`Image ${i + 1} must be JPEG, PNG, WebP or GIF.`)
    if (typeof data !== 'string' || !data.length || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new InputError(`Image ${i + 1} is not valid base64.`)
    }
    const bytes = (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
    if (bytes > MAX_IMAGE_BYTES) throw new InputError(`Image ${i + 1} is too large.`)
    const head = atob(data.slice(0, 16))
    const ok = TYPES[media_type].some((sig) => sig.every((b, j) => head.charCodeAt(j) === b))
    if (!ok) throw new InputError(`Image ${i + 1} doesn't match its file type.`)
    return { media_type, data }
  })
}
