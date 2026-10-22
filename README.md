# Money Leak Finder

Find where your money slips away. A private, phone-first budgeting app (installable PWA) by **Caylor Made Technologies**.

**Live app:** https://money-leak-finder.andycaylor.workers.dev

Add your pay and spending by typing it in, uploading a bank CSV, or snapping screenshots of pay stubs, bank app lists or receipts. The app sorts everything into categories, finds the leaks, and shows how fast you can hit your goals.

## Features

| | |
|---|---|
| **Three ways to add money** | Type it in (category guessed as you type), bank CSV upload (auto-detects columns, skips duplicates), or screenshot reading with a review screen to fix mistakes before saving |
| **Auto-categorize** | 24 categories. Fix one and it remembers that merchant, and updates past ones too |
| **Dashboard** | Left over this month (count-up number), money in vs. out, income vs. spending chart, needs/wants/saving donut, spending by category, recent activity |
| **Leak finder** | Recurring subscriptions, possible double charges, small purchases that add up (fast food, gas station snacks, coffee), categories that jumped vs. last month, and fees. Each one says "You spent $X this month, about $Y per year" |
| **Plug it** | Mark a leak as plugged; the savings flow into your goals |
| **Goals planner** | Save-per-week and per-month to hit a date, time at your current leftover, how much sooner with plugged leaks, and a "what if I saved extra?" slider |
| **Invest calculator** | Monthly investing over 5/10/20/30 years at 4%, 7%, 10% example rates, with a chart, table and a clear "educational, not advice" note |
| **Money story** | Plain-English tips like "Cutting eating out in half frees up $150/month, which gets your $5,000 goal done 4 months sooner" |
| **Coming up** | Predicts recurring bills and subscriptions due in the next 2 weeks |
| **Hours of work** | Optional: enter your hourly pay and leaks show as hours of work |
| **Privacy extras** | Hide-amounts eye button, auto-blur in the app switcher, encrypted backups |
| **Feel** | Spring animations, swipe-to-delete with undo, confetti on wins, light haptics, dark/light mode. Everything respects the phone's Reduce Motion setting |

## Privacy and security

- **Data stays on the phone** (IndexedDB). No accounts, cookies, analytics, ads or trackers.
- **Never asks for** bank logins, full account/card/routing numbers or SSNs. Anything that looks like one is masked to the last 4 digits (SSNs are removed) on every save path: typing, CSV, screenshots and backups. A database hook re-checks every write.
- **Screenshots are never stored.** They're shrunk and stripped of location/device data on the phone (re-drawn on a canvas), read once, then dropped from memory. Nothing is written to disk.
- **API key stays off the phone.** The Cloudflare Worker in `worker/` holds it as a secret and:
  - only answers the app's own address (origin allowlist; other sites get 403)
  - rate-limits each visitor (8 reads/minute, keyed by a hash of the IP)
  - accepts only 1–5 JPEG/PNG/WebP/GIF images, checks their real file type, caps size
  - uses a strict output schema, then masks numbers again before replying
  - never logs images or results
- **Backups** can be locked with a password (AES-256-GCM, PBKDF2-SHA256 600k rounds). Restored files are fully re-validated.
- **App hardening:** strict Content Security Policy (no inline scripts or styles; connects only to itself and the reader), `X-Frame-Options: DENY`, HSTS, no-referrer, Permissions-Policy, frame-buster, user text never inserted as HTML, CSV export protected against spreadsheet formula injection.
- Privacy policy and terms are in **Settings → Privacy & terms**. They're a template until an attorney reviews them.

## File structure

```
index.html                 app shell (CSP is injected at build time)
public/                    icons, theme.js (no-flash theme + frame-buster), _headers, font licenses
src/
  main.jsx, App.jsx        entry, header, animated tab screens, bottom nav with + button
  state.jsx                app state (live IndexedDB queries, month, theme, privacy, leaks)
  db.js                    Dexie database + write hooks that sanitize every transaction
  index.css                Tailwind theme (navy + brand blue), animations
  components/              UI kit (sheets, buttons, money count-up, confetti), charts, rows, forms
  screens/                 Home, Activity, Leaks, Plan (goals + invest), Settings, Add flows
  lib/                     pure logic (unit tested):
    privacy.js             masks card/account/routing numbers and SSNs
    categorize.js          merchant names + category rules
    leaks.js               leak finder + upcoming charges
    goals.js, invest.js    goal and growth math
    insights.js            plain-English tips
    csv.js, backup.js      CSV import/export, encrypted backups
    image.js, extract.js   screenshot prep + reader client
worker/                    Cloudflare Worker: the screenshot reader API
tests/                     unit tests (node --test)
e2e/smoke.mjs              browser test at iPhone size (Playwright + axe)
wrangler.toml              hosting config for the app (static files on Cloudflare)
```

## Run it locally

Needs Node 22.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run build        # production build in dist/
```

Screenshot reading works locally if you also run the Worker:

```bash
cd worker
npm install
echo 'AI_API_KEY=sk-ant-...' > .dev.vars   # never commit this file
npx wrangler dev --port 8799
# then in the project root:
echo 'VITE_API_URL=http://localhost:8799' > .env.local && npm run dev
```

Browser test (uses Playwright and Chromium):

```bash
npm run build && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173/ AXE_PATH=path/to/axe.min.js node e2e/smoke.mjs
```

## Deploy

Both parts run on Cloudflare (free plan is fine).

1. **Screenshot reader (Worker)**
   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put AI_API_KEY     # paste an API key from console.anthropic.com
   npx wrangler deploy
   ```
   Put your app's address in `ALLOWED_ORIGINS` in `worker/wrangler.toml`. Model and effort are set there too (`MODEL`, `EFFORT`).
2. **App**: set `VITE_API_URL` in `.env.production` to the Worker's URL, then:
   ```bash
   npm run build
   npx wrangler deploy        # uses ./wrangler.toml, serves dist/
   ```
3. **Auto-deploy from GitHub:** add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Every push to `main` then tests, builds and deploys both parts (`.github/workflows/ci.yml`). Without the secrets it still runs the tests.

Bump nothing by hand for updates: the service worker auto-updates on the next visit.

## Notes

- Category and leak rules live in `src/lib/categorize.js` and `src/lib/leaks.js`; add merchants there.
- Money is stored as whole cents to avoid rounding errors.
- Fonts: Inter and Montserrat, bundled (SIL Open Font License, see `public/licenses/`).

© 2026 Caylor Made Technologies, Hereford, TX
