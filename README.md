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
| CI | GitHub Actions → scrape → validate → commit `data/prices.json` |
| Host | **Cloudflare Pages** (builds `dist/` on push) |

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
GitHub Actions: python -m scraper  →  validate  →  commit data/prices.json
        │
        ▼
Cloudflare Pages (on push): npm run build  →  dist/  →  global CDN
```

Daily cron `45 2 * * *` (08:30 NPT). API keeps only ~1–2 months — keep the schedule alive.

History-page **By Month** is implemented in `scraper/history.py` (BS month → AD date → `monthwisehistory`). Older months return empty; `--backfill` uses Wayback for those gaps only.

## Host on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Pick this repo (branch `main`)
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output: `dist`
   - Node: 22 (or leave default if it is ≥18)
4. Deploy. After the first green build, attach a custom domain if you have one.

The daily Actions job only scrapes and commits `data/prices.json`. That push rebuilds Pages automatically (Cloudflare git integration).

Optional deploy hook (if you do **not** use git integration):  
Pages project → **Settings** → **Builds & deployments** → **Deploy hooks** → copy URL → GitHub secret `CLOUDFLARE_DEPLOY_HOOK`.

### Turn off GitHub Pages (if it was on)

Repo → **Settings** → **Pages** → Source: **None**.  
You can delete any old `gh-pages` branch. The Actions workflow no longer uploads a Pages artifact.

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

| Secret | Required | Purpose |
|--------|----------|---------|
| `MAIN_USERNAME` | yes (or bot default) | Git commit author |
| `MAIN_EMAIL` | yes (or bot default) | Git commit email |
| `CLOUDFLARE_DEPLOY_HOOK` | optional | Only if not using CF git integration |
| `N8N_WEBHOOK_URL` | optional | Success notify |

GitHub **Pages** is no longer used. Site is on Cloudflare Pages.

## Status

Idea 2022-05-20. Astro static site + validated scraper pipeline (2026).
