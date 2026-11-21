// Screenshot limits and checks. Reading (and re-drawing, which drops location and device data) is in ocr.js.

export const MAX_IMAGES = 5
export const MAX_INPUT_BYTES = 20 * 1024 * 1024

/** A plain-words reason a file can't be read, or '' if it's fine. */
export function imageProblem(file) {
  if (!/^image\/(png|jpe?g|webp|heic|heif|gif)$/i.test(file.type) && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) return `${file.name} isn't a picture.`
  if (file.size > MAX_INPUT_BYTES) return `${file.name} is too big (20 MB max).`
  return ''
}
