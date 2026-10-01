# Orbit — Expense Tracker (PWA)

A private, offline-first expense tracker. No account, no backend, no dependencies — data lives in the browser's localStorage on the device.

## Run

Any static server works (service workers need `http://localhost` or HTTPS):

```sh
cd expense-tracker
python3 -m http.server 8787
# open http://localhost:8787
```

Deploy by uploading the folder to any static host (Netlify, Vercel, GitHub Pages, S3…). It works from a sub-path.

## Features

- **Fast entry** — bottom-sheet form, category grid, Today/Yesterday chips, and an amount field that does math (`12.50+8`, `3*4.99`).
- **Recurring** — weekly/monthly/yearly rules auto-log on launch (backfills past dates, clamps the 31st to month-end, handles leap years). Pause/resume never backfills the paused gap.
- **Budgets** — monthly total with a daily allowance, per-category limits, and 80%/over alerts on the home screen.
- **Insights** — like-for-like comparison vs last month, month-end projection, savings rate, category donut + ranking, daily bars (tap for detail), 6-month trend, and largest expenses.
- **Activity** — multi-term search (notes, categories, amounts, dates), type/category filters, month or all-time view, grouped by day.
- **Currency switching with conversion** — changing currency fetches today's market rate (open.er-api.com, free/no key; only the two currency codes are sent), lets you adjust it, and converts every transaction, budget and recurring rule with rounding to the new currency's precision. Works offline using the last saved rate (cross-rates supported) or a manually entered one; "Label only" and Undo are available.
- **Landing page** — hero with budget progress plus Income / Net / per-day-left stats (auto-compacts on narrow phones), one-tap quick-add chips for your most-used categories, a condensed "Heads up" budget card, recent activity, 7-day trend and top categories. First launch shows a welcome screen with feature highlights.
- **Data** — CSV export (Excel-safe, formula-injection guarded), full JSON backup/restore with validation, demo data, erase all.
- **Custom categories** — name, icon, color; deleting one moves its transactions to "Other".
- **PWA** — installable, works fully offline (fonts included after first load), app shortcut "Add transaction", update prompt when a new version ships, keeps multiple tabs in sync.
- **Design** — dark/light/system themes, responsive (bottom bar on phones, sidebar on desktop), safe-area aware, reduced-motion support, keyboard shortcuts (`N` new, `/` search).

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell, icon sprite |
| `styles.css` | Design tokens + components |
| `app.js` | All app logic (store, views, recurring engine, import/export) |
| `sw.js` | Service worker — bump `VERSION` on each release to prompt an update |
| `manifest.webmanifest`, `icons/` | Install metadata and icons |

Amounts are stored as integer cents to avoid floating-point drift; dates are local `YYYY-MM-DD` strings (never UTC) so transactions don't shift days across time zones.
