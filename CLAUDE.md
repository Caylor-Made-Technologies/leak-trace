# Money Leak Finder

Mobile-first budgeting PWA by Caylor Made Technologies. React + Vite + Tailwind, data in IndexedDB (Dexie), screenshot reading through a Cloudflare Worker in `worker/`.

## Project memory
This repo's history, decisions and next steps live in the Obsidian vault:
`Caylor-Made-Technologies/obsidian-vault` → `Projects/Money Leak Finder.md`.
Read it before working here.

**Before the session ends** (last step of any task that changed something, even if not asked):
1. Update `Projects/Money Leak Finder.md` in the vault: dated line under **Log**, new **Decisions** with reasons, current **Status**, **Next steps**.
2. Commit and push the vault to `main`, then say in one line what was saved.

## Rules for this repo
- No AI-tool branding in commits, PRs, comments, branch names or site text. Commit as `Caylor Made Technologies <andycaylor@icloud.com>`.
- Test before it goes live: `npm test`, `npm run build`, `cd worker && npm test`, then the browser check in `e2e/smoke.mjs` (local and live).
- Money is stored as integer cents. Every saved transaction passes through `src/lib/sanitize.js` (masking in `src/lib/privacy.js`).
- Never store screenshots. Never store full account/card/routing numbers or SSNs.
- This file is not published: only `dist/` is deployed.
