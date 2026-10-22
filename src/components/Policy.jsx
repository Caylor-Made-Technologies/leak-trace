import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ShieldIcon } from './icons.jsx'

// Privacy policy + terms. Shown in Settings and next to the screenshot consent box.
export default function Policy({ startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="flex gap-3">
        <ShieldIcon size={24} className="mt-0.5 shrink-0 text-good" />
        <ul className="space-y-1 text-sm text-muted">
          <li>• Your transactions, goals and settings are stored only on this device.</li>
          <li>• No accounts, ads, cookies, analytics or trackers.</li>
          <li>• We never ask for bank logins, full account or card numbers, routing numbers or SSNs.</li>
        </ul>
      </div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
        Read the full privacy policy & terms <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-2 text-sm text-muted">
              <p className="rounded-xl bg-warn/10 p-2 text-xs text-warn">Template. Last updated October 22, 2026. Not yet reviewed by an attorney.</p>
              <h4 className="font-bold text-ink">Privacy policy</h4>
              <p><strong>What’s collected:</strong> only what you enter: dates, descriptions, amounts, categories, goals and optional hourly pay. It is saved in your browser’s storage (IndexedDB) on this device. Caylor Made Technologies does not receive or store it.</p>
              <p><strong>Screenshots:</strong> if you use “Read screenshots,” the pictures are shrunk and stripped of location data on your phone, then sent over an encrypted connection to our reader service (a Cloudflare Worker) and on to an AI service (Anthropic) to pull out the transactions. Our reader does not save the images or the results, and images are deleted from the app once you save. Anthropic processes the request under its commercial terms and may keep it for a limited time for abuse monitoring. Don’t upload pictures of IDs or full statements you don’t want processed.</p>
              <p><strong>Sensitive numbers:</strong> full card, account, routing and Social Security numbers are automatically hidden (last 4 digits at most) before anything is saved.</p>
              <p><strong>Cookies & tracking:</strong> none. We use your browser’s local storage only to remember your data and settings on this device.</p>
              <p><strong>Third parties:</strong> Cloudflare (hosts the reader) and Anthropic (reads screenshots) only when you use screenshot reading. Fonts are bundled with the app.</p>
              <p><strong>Your control:</strong> export, back up, or delete everything at any time in Settings. Deleting the app’s website data also erases it. Because we never receive your data, we have nothing stored to delete; for any question or request, we respond within 45 days.</p>
              <p><strong>Children:</strong> this app is for adults 18+ and is not directed at children under 13.</p>
              <h4 className="pt-1 font-bold text-ink">Terms of use</h4>
              <p>Money Leak Finder is a free educational budgeting tool provided “as is.” It is not financial, tax, legal or investment advice. Category guesses, screenshot reading and calculations can be wrong; always check against your bank. Investment examples use made-up rates and are not predictions or guarantees. You’re responsible for decisions you make with it. To the extent allowed by law, Caylor Made Technologies isn’t liable for losses from using the app. These terms are governed by the laws of the State of Texas, with venue in Deaf Smith County.</p>
              <p><strong>Price and refunds:</strong> the app is free. There are no ads, in-app purchases, subscriptions or hidden fees, so there is nothing to refund. If that ever changes, prices and a refund policy will be shown here before you pay anything.</p>
              <p><strong>Contact:</strong> Caylor Made Technologies, Hereford, TX 79045 · (806) 705-1950 · jonathoncaylor2@gmail.com</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
