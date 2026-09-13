"""Thin client for the live Fenegosida JSON API.

Endpoints used by https://www.fenegosida.org/history (React SPA):
  today
  datewisehistory?date=YYYY-MM-DD
  monthwisehistory?date=YYYY-MM-DD      # whole AD month
  ratehistory?weekMonthYear=week:YYYY-MM-DD    # week min/max
  ratehistory?weekMonthYear=month:YYYY-MM-DD   # month min/max (full ISO date)
  ratehistory?weekMonthYear=year:YYYY-MM-DD    # year min/max (full ISO date)
  WeeklyChartRate?weekmonthyear=...

IMPORTANT: the official history page does NOT hold a long archive.
Live API retention is only ~1–2 months (currently from ~2026-07-23).
Older AD months return HTTP 204 empty. ratehistory month:/year: need a
full ISO date (month:2026-09-01 works; month:2026-09 → 500). For
pre-retention history, use scraper.backfill (Wayback) — there is no
bulk full-history dump on the new site.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

API_BASE = "https://api.fenegosida.org"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (GoldMandu-updater/1.0)",
    "Accept": "application/json",
}
TIMEOUT = 30


def api_get(path: str):
    """GET JSON from the API.

    Returns:
        list/dict on success,
        [] for empty body (out-of-retention / no data),
        None on transport or HTTP error.
    """
    req = urllib.request.Request(API_BASE + path, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read()
            if not body.strip():
                return []
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", "replace")[:200]
        except Exception:
            pass
        print(f"  ! API {path} HTTP {exc.code}: {detail}", flush=True)
        return None
    except Exception as exc:
        print(f"  ! API {path} failed: {exc}", flush=True)
        return None


def fetch_today():
    """Today's published rates (list of rate rows)."""
    return api_get("/api/website/v1/Dashboard/today")


def fetch_month(ad_date_iso: str):
    """Whole AD month containing YYYY-MM-DD (one call per month)."""
    return api_get(
        f"/api/website/v1/Dashboard/monthwisehistory?date={ad_date_iso}"
    )


def fetch_day(ad_date_iso: str):
    """Single AD day rates."""
    return api_get(
        f"/api/website/v1/Dashboard/datewisehistory?date={ad_date_iso}"
    )


def fetch_week_minmax(ad_date_iso: str):
    """Week min/max rates (history page 'Week Min/Max' tab).

    Returns rows with maxBaseRatePerGram / minBaseRatePerGram, not a
    daily series. Not used for prices.json — kept for completeness.
    """
    return api_get(
        "/api/website/v1/Dashboard/ratehistory"
        f"?weekMonthYear=week:{ad_date_iso}"
    )


def fetch_month_minmax(ad_date_iso: str):
    """Month min/max rates. Requires full ISO date (e.g. 2026-09-01)."""
    return api_get(
        "/api/website/v1/Dashboard/ratehistory"
        f"?weekMonthYear=month:{ad_date_iso}"
    )


def fetch_year_minmax(ad_date_iso: str):
    """Year min/max rates. Requires full ISO date (e.g. 2026-01-01)."""
    return api_get(
        "/api/website/v1/Dashboard/ratehistory"
        f"?weekMonthYear=year:{ad_date_iso}"
    )


def classify_rate_type(rate_type: str) -> str | None:
    """Map Nepali rateType label to a Values.json field name."""
    rt = rate_type or ""
    if "चाँदी" in rt:
        return "silver_tola" if "तोला" in rt else "silver_gram"
    if "सुन" in rt:
        return "fine_gold_tola" if "तोला" in rt else "fine_gold_gram"
    return None


def extract_prices(rows: list) -> dict[str, float]:
    """Pull fine/silver prices from a list of API rate rows."""
    prices: dict[str, float] = {}
    if not isinstance(rows, list):
        return prices
    for row in rows:
        field = classify_rate_type(row.get("rateType", ""))
        if not field:
            continue
        raw = row.get("baseRatePerGram")
        if raw in (None, "", 0):
            raw = row.get("todayBaseRatePerGram")
        try:
            val = float(raw or 0)
        except (TypeError, ValueError):
            continue
        if val > 0:
            prices[field] = val
    return prices
