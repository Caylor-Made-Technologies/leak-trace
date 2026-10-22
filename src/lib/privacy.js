// Privacy guard. Every piece of text that gets saved passes through here, so a
// full account, card, routing or Social Security number can never be stored.

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g

export const MASK = '••••'

export function maskSensitive(text) {
  if (text == null) return ''
  let s = String(text)

  // SSNs (123-45-6789 / 123 45 6789) are removed entirely, not even last 4.
  s = s.replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, '[removed]')

  // Already-masked numbers (XXXX1234, ****1234, ...1234) → ••••1234
  s = s.replace(/(?<![A-Za-z0-9])(?:[xX*•#]{2,}|\.{3,})[\s-]?(\d{4})\b/g, (_, last) => MASK + last)

  // Card, account and routing numbers: 8+ digits in a row, or card-style
  // groups (4111 1111 1111 1111, 3782-822463-10005) → keep the last 4 at most.
  s = s.replace(/\b\d{4}(?:[ -]\d{4}){2,3}\b|\b\d{4}[ -]\d{6}[ -]\d{4,5}\b|\d{8,}/g, (run) => {
    const digits = run.replace(/\D/g, '')
    return MASK + digits.slice(-4)
  })

  // Labeled numbers even when short: "acct 12345", "routing: 1234567"
  s = s.replace(/\b(acct|account|acc|routing|rtn|aba|card)(\s*(?:no\.?|number|num|#)?\s*[:#]?\s*)(\d{5,7})\b/gi,
    (_, label, sep, digits) => `${label}${sep}${MASK}${digits.slice(-4)}`)

  return s
}

export function cleanText(text, max = 80) {
  return maskSensitive(String(text ?? '').replace(CONTROL, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// True if the text still contains something that looks like a full number.
export function looksSensitive(text) {
  return maskSensitive(text) !== String(text ?? '')
}
