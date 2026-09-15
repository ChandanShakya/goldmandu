"""GoldMandu live updater — incremental sync from api.fenegosida.org.

Strategy:
  1. Load data/prices.json (BS-dated history).
  2. Convert max BS date → AD date (via nepali-datetime).
  3. Live sync: every missing AD day up to today via monthwisehistory
     (with datewisehistory / today fallback).
  4. History API scan (same source as /history → By Month): walk recent
     AD months, convert each day AD→BS, fill holes inside retention.
  5. Optional --backfill: Wayback snapshots for pre-retention gaps.
  6. Validate, then write data/prices.json + public/data copy.

API retention is only ~1–2 months. Run at least monthly (CI runs daily)
or gaps become unrecoverable. Gaps are logged, never fabricated.
"""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import sys
from pathlib import Path

from .api import extract_prices, fetch_day, fetch_month, fetch_today
from .backfill import backfill
from .history import sync_history_api
from .schema import (
    NEPALI_MONTHS,
    TEJABI_RATIO,
    bs_key,
    format_price,
)
from .validate import validate_records

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "data" / "prices.json"
DEFAULT_SITE_COPY = ROOT / "public" / "data" / "prices.json"


def load_records(path: Path) -> list:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else []


def write_records(records: list, path: Path, site_copy: Path | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(records, indent=4, ensure_ascii=False)
    path.write_text(payload, encoding="utf-8")
    if site_copy is not None:
        site_copy.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, site_copy)
    print(f"Wrote {len(records)} records → {path}"
          + (f" (+ site copy {site_copy})" if site_copy else ""))


def build_record(bs_day: str, bs_month: str, bs_year: str,
                 prices: dict[str, float]) -> dict:
    fine_t = prices.get("fine_gold_tola", 0.0)
    fine_g = prices.get("fine_gold_gram", 0.0)
    return {
        "day": bs_day,
        "month": bs_month,
        "year": bs_year,
        "fine_gold_gram": format_price(fine_g),
        "tejabi_gold_gram": format_price(fine_g * TEJABI_RATIO),
        "silver_gram": format_price(prices.get("silver_gram", 0.0)),
        "fine_gold_tola": format_price(fine_t),
        "tejabi_gold_tola": format_price(fine_t * TEJABI_RATIO),
        "silver_tola": format_price(prices.get("silver_tola", 0.0)),
    }


def merge_record(records: list, existing: set, record: dict) -> str:
    key = (record["day"], record["month"], record["year"])
    if key not in existing:
        records.append(record)
        existing.add(key)
        return "added"
    for i, rec in enumerate(records):
        if (rec.get("day"), rec.get("month"), rec.get("year")) == key:
            for field, value in record.items():
                if field not in ("day", "month", "year") and value != "0":
                    records[i][field] = value
            return "updated"
    return "skipped"


def sync_live(records: list, existing: set, ndate, *, dry_run: bool) -> int:
    """Fetch missing days from the live API. Returns 0/1 exit contribution."""
    if records:
        latest = max(
            records,
            key=lambda r: bs_key(r.get("day"), r.get("month"), r.get("year")),
        )
        try:
            last_ad = ndate(
                int(latest["year"]),
                NEPALI_MONTHS.index(latest["month"]) + 1,
                int(latest["day"]),
            ).to_datetime_date()
        except Exception as exc:
            print(f"FATAL: cannot convert latest BS date {latest}: {exc}",
                  file=sys.stderr)
            return 1
        print(f"Existing records: {len(records)}; latest BS: "
              f"{latest['day']} {latest['month']} {latest['year']} "
              f"(= AD {last_ad})")
    else:
        last_ad = datetime.date.today() - datetime.timedelta(days=60)
        print(f"No history; starting from AD {last_ad}")

    start_ad = last_ad + datetime.timedelta(days=1)
    today = datetime.date.today()
    print(f"Live sync AD {start_ad} .. {today}")

    if start_ad > today:
        print("Live sync: already up to date.")
        return 0

    # One API call per AD month
    month_cache: dict[tuple[int, int], list] = {}
    months: set[tuple[int, int]] = set()
    cursor = start_ad
    while cursor <= today:
        months.add((cursor.year, cursor.month))
        cursor = (cursor.replace(day=28) + datetime.timedelta(days=5)).replace(day=1)

    for year, month in sorted(months):
        probe = f"{year:04d}-{month:02d}-15"
        data = fetch_month(probe)
        if data is None:
            print(f"  month {probe}: FETCH ERROR — aborting without write",
                  file=sys.stderr)
            return 1
        month_cache[(year, month)] = data if isinstance(data, list) else []
        print(f"  month {probe}: {len(month_cache[(year, month)])} rows")

    by_date: dict[str, list] = {}
    for rows in month_cache.values():
        for row in rows:
            ad = (row.get("todayDate") or "")[:10]
            if ad:
                by_date.setdefault(ad, []).append(row)

    added = updated = 0
    missing: list[str] = []
    cursor = start_ad
    while cursor <= today:
        ad_str = cursor.isoformat()
        rows = by_date.get(ad_str)

        if not rows:
            month_rows = month_cache.get((cursor.year, cursor.month), [])
            in_current = (cursor.year, cursor.month) == (today.year, today.month)
            if month_rows or in_current:
                day_data = fetch_day(ad_str)
                if isinstance(day_data, list) and day_data:
                    rows = day_data
            if not rows and cursor == today:
                today_rows = fetch_today()
                if isinstance(today_rows, list):
                    rows = [
                        r for r in today_rows
                        if (r.get("todayDate") or "")[:10] == ad_str
                    ] or None
            if not rows:
                missing.append(ad_str)
                cursor += datetime.timedelta(days=1)
                continue

        prices = extract_prices(rows)
        if "fine_gold_tola" not in prices and "fine_gold_gram" not in prices:
            missing.append(ad_str)
            cursor += datetime.timedelta(days=1)
            continue

        # Normalise: if only one unit present, leave the other as 0 (format_price).
        bs = ndate.from_datetime_date(cursor)
        record = build_record(
            str(bs.day),
            NEPALI_MONTHS[bs.month - 1],
            str(bs.year),
            prices,
        )
        outcome = merge_record(records, existing, record)
        if outcome == "added":
            added += 1
        elif outcome == "updated":
            updated += 1
        cursor += datetime.timedelta(days=1)

    print(f"Done: +{added} added, {updated} updated, "
          f"{len(missing)} days with no market data")
    if missing:
        preview = ", ".join(missing[:10])
        more = "..." if len(missing) > 10 else ""
        print(f"  no-data days: {preview}{more}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scraper",
        description="Update GoldMandu price history from Fenegosida",
    )
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA,
                        help=f"canonical prices file (default: {DEFAULT_DATA})")
    parser.add_argument("--site-copy", type=Path, default=DEFAULT_SITE_COPY,
                        help="frontend data copy under public/data/")
    parser.add_argument("--no-site-copy", action="store_true",
                        help="do not copy data into public/data/")
    parser.add_argument("--dry-run", action="store_true",
                        help="fetch and report but do not write")
    parser.add_argument("--history-api", action="store_true", default=True,
                        help="scan /history By Month API over recent AD months "
                             "(default: on)")
    parser.add_argument("--no-history-api", action="store_true",
                        help="skip the history API month scan")
    parser.add_argument("--history-lookback", type=int, default=120,
                        help="days of AD history to scan via monthwisehistory "
                             "(default: 120)")
    parser.add_argument("--backfill", action="store_true",
                        help="also fill pre-retention gaps via Wayback")
    parser.add_argument("--skip-validate", action="store_true",
                        help="skip post-sync validation (not recommended)")
    args = parser.parse_args(argv)

    try:
        from nepali_datetime import date as ndate
    except ImportError:
        print("FATAL: nepali-datetime not installed. "
              "pip install -r requirements.txt", file=sys.stderr)
        return 1

    data_path: Path = args.data
    records = load_records(data_path)
    existing = {(r.get("day"), r.get("month"), r.get("year")) for r in records}

    rc = sync_live(records, existing, ndate, dry_run=args.dry_run)
    if rc != 0:
        return rc

    # Same endpoint the official /history "By Month" tab uses.
    if args.history_api and not args.no_history_api:
        if args.dry_run:
            print("History API scan skipped in --dry-run")
        else:
            sync_history_api(
                records, existing, ndate,
                lookback_days=args.history_lookback,
            )

    if args.backfill and not args.dry_run:
        n = backfill(records, existing, ndate)
        print(f"Wayback backfill: +{n} records")
    elif args.backfill and args.dry_run:
        print("Wayback backfill skipped in --dry-run")

    records.sort(key=lambda r: bs_key(r.get("day"), r.get("month"), r.get("year")))

    if not args.skip_validate:
        errors, warnings = validate_records(records)
        if warnings:
            print(f"Validation warnings: {len(warnings)}")
            for w in warnings[:10]:
                print(f"  - {w}")
        if errors:
            print(f"Validation FAILED with {len(errors)} errors:",
                  file=sys.stderr)
            for e in errors[:20]:
                print(f"  - {e}", file=sys.stderr)
            print("Aborting write.", file=sys.stderr)
            return 1
        print(f"Validation OK ({len(records)} records)")

    if args.dry_run:
        print("Dry run — not writing.")
        return 0

    site_copy = None if args.no_site_copy else args.site_copy
    write_records(records, data_path, site_copy)
    return 0


if __name__ == "__main__":
    sys.exit(main())

