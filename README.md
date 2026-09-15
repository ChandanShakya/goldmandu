# GoldMandu

Nepal **gold & silver price board** — Astro static site + Python scraper on GitHub Actions.

Rates from the Federation of Nepal Gold and Silver Dealers' Association ([Fenegosida](https://fenegosida.org)) in NPR per **tola** and per **10 grams**, on the **Bikram Sambat (BS)** calendar.

## Stack

| Layer | Choice |
|-------|--------|
| Site | Astro 5 (static) + Chart.js |
| UI | Water.css (light) + sharp-corner, mobile-first overrides |
| PWA | Manifest + service worker (offline shell, network-first prices) |
| Data | `data/prices.json` (canonical); `public/data/` is a build copy |
| Scraper | `scraper/` Python package (`nepali-datetime` only) |
| CI | GitHub Actions → scrape → validate → build → deploy Pages |

## Quick start

```bash
# Site
npm install
npm run dev          # sync data + astro dev
npm run build        # sync data + astro build → dist/
npm run preview

# Scraper
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m scraper              # live + history API → data/ + public/data/
python -m scraper.validate
python -m scraper --backfill   # optional Wayback fill
```

## Pages

| Route | Contents |
|-------|----------|
| `/` | Latest rates table, insights, history charts |
| `/calculator` | Unit converter (gram / tola / aana / masha / ratti), price, jewelry, karat, SIP |

Latest prices are rendered at build time. Charts load `/data/prices.json` on the client (X axis is an index so BS labels never collide).

## PWA

Installable as a standalone app (`manifest.webmanifest` + `sw.js`).

- Cache: pages, CSS/JS, icons (cache-first)
- `/data/prices.json`: network-first so daily CI updates show; falls back offline
- Icons: 192 / 512 / maskable PNG in `public/icons/`

## Layout

```
data/prices.json              # source of truth (committed)
public/data/prices.json       # generated at build (gitignored)
src/
  pages/           index.astro, calculator.astro
  layouts/         Base.astro
  components/      ChartPanel.astro, Insights.astro
  lib/             prices.ts          # types, formatNPR, insights, fetch
  scripts/         charts.ts, calculator.ts
  styles/          global.css         # overrides on Water.css
scraper/
  api.py           Fenegosida JSON client
  history.py       /history By Month walker
  update.py        CLI: sync + validate + write
  validate.py      schema / sanity checks
  backfill.py      Wayback (pre-retention only)
  schema.py        months, ratios, helpers
scripts/sync-data.mjs
.github/workflows/update-gold-price.yml
```

## Pipeline

```
Fenegosida API  (monthwisehistory / datewisehistory / today)
        │
        ▼
python -m scraper  →  data/prices.json  (+ public/data copy)
        │
        ▼
npm run build  →  dist/
        │
        ▼
GitHub Pages (actions/deploy-pages)
```

Daily cron `45 2 * * *` (08:30 NPT). API keeps only ~1–2 months — keep the schedule alive.

History-page **By Month** is implemented in `scraper/history.py` (BS month → AD date → `monthwisehistory`). Older months return empty; `--backfill` uses Wayback for those gaps only.

## Data record

```json
{
  "day": "28",
  "month": "Bhadra",
  "year": "2083",
  "fine_gold_tola": "302200",
  "fine_gold_gram": "259090",
  "tejabi_gold_tola": "287090",
  "tejabi_gold_gram": "246136",
  "silver_tola": "4660",
  "silver_gram": "3996"
}
```

`*_gram` is the association’s **per 10 gram** rate. Tejabi ≈ 95% of fine when only one gold rate is published.

## CI secrets

`MAIN_USERNAME`, `MAIN_EMAIL`, optional `N8N_WEBHOOK_URL`.  
Settings → Pages → Source: **GitHub Actions**.

## Status

Idea 2022-05-20. Astro static site + validated scraper pipeline (2026).

