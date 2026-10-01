# Yaje — Expense Tracker (PWA) · Suivi des dépenses

A private, offline-first, **bilingual (English / Français)** expense tracker. No account, no backend, no dependencies — data lives on the device.

**Live:** https://dirane.github.io/yaje-expense-tracker/

## Highlights
- **Bilingual EN/FR** — auto-detects the device language, switchable anytime (welcome screen or Settings). Dates, numbers and currencies follow local conventions (e.g. `1 750,00 €`, `2 500 FCFA`); French plural rules are respected. Built-in category names translate; categories you rename keep your name.
- **Add to home screen** — on first visit Yaje invites you to install it (*OK, add it* / *Continue in browser*). Android/Chrome/Edge open the native install prompt; iPhone/iPad show the Share → *Add to Home Screen* steps (iOS has no install API). Once installed, a **"Yaje has been added to your home screen"** confirmation appears (*OK* / *Continue*). Browsers never allow a site to install itself without the user's confirmation.
- **Fast entry** — quick-add chips for your most-used categories, amount field that does math (`1500+250`), Today/Yesterday chips, note suggestions from history, a save button that shows the total, and a plain-language repeat preview ("Repeats on day 15 of every month · next on …").
- **Budgets & recurring** — monthly budget with per-day allowance, category limits, alerts at 80%/over, weekly/monthly/yearly repeats (month-end and leap-year safe).
- **Insights** — vs last month, month-end projection, savings rate, category donut, daily bars, 6-month trend.
- **Currency switching with conversion** — fetches today's rate (open.er-api.com; only currency codes are sent), editable, works offline from the last saved rate; *Label only* and *Undo* available. Cameroon and other CFA-zone devices default to XAF/XOF.
- **Data** — CSV export (Excel-safe), JSON backup/restore, demo data, erase all. Data from the earlier "Orbit" version migrates automatically.

## Run locally
```sh
python3 -m http.server 8787   # then open http://localhost:8787
```
Service workers need `localhost` or HTTPS. Bump `VERSION` in `sw.js` on each release so installed copies show the update prompt.

## Files
| File | Purpose |
|---|---|
| `index.html` | App shell & icon sprite |
| `i18n.js` | All UI text, English + French |
| `app.js` | App logic (store, views, recurring engine, install flow, conversion) |
| `styles.css` | Design tokens & components |
| `sw.js` | Offline cache |
| `manifest.webmanifest`, `icons/` | Install metadata & icons |

Amounts are stored as integer cents; dates are local `YYYY-MM-DD` strings so nothing shifts across time zones.
