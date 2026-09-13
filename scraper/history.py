"""Import daily rates from the official History page API (By Month).

The React history UI maps BS year+month → AD date via ex(y, m, 1), then
calls:

    GET /api/website/v1/Dashboard/monthwisehistory?date=YYYY-MM-DD

which returns every published row in that **AD** month (fine gold + silver,
per tola and per 10 gram). A single BS month often spans two AD months, so
this module walks AD months across the retention window and converts each
AD day back to BS — same data the /history By Month table shows.
"""

from __future__ import annotations

import datetime

from .api import extract_prices, fetch_month
from .schema import NEPALI_MONTHS, TEJABI_RATIO, format_price

# How far back the live history API still serves daily rows (~1-2 months).
# Older AD months return HTTP 204 empty.
DEFAULT_LOOKBACK_DAYS = 120


def _ad_months(start: datetime.date, end: datetime.date):
    """Yield (year, month) for each AD month overlapping [start, end]."""
    cursor = start.replace(day=1)
    while cursor <= end:
        yield (cursor.year, cursor.month)
        # first day of next month
        cursor = (cursor.replace(day=28) + datetime.timedelta(days=5)).replace(day=1)


def sync_history_api(
    records: list,
    existing: set,
    ndate,
    *,
    start_ad: datetime.date | None = None,
    end_ad: datetime.date | None = None,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
) -> int:
    """Fetch monthwisehistory for AD months and merge missing BS dates.

    Mirrors the /history → By Month tab. Returns count of records added.
    """
    today = end_ad or datetime.date.today()
    if start_ad is None:
        start_ad = today - datetime.timedelta(days=lookback_days)

    print(
        f"History API (By Month): scanning AD {start_ad} .. {today}",
        flush=True,
    )

    added = 0
    updated = 0
    months_with_data = 0
    empty_months = 0

    for year, month in _ad_months(start_ad, today):
        probe = f"{year:04d}-{month:02d}-15"
        rows = fetch_month(probe)
        if rows is None:
            print(f"  ! month {probe}: FETCH ERROR — aborting history sync",
                  flush=True)
            return added
        if not rows:
            empty_months += 1
            print(f"  month {probe}: empty (out of retention / no rates)",
                  flush=True)
            continue

        months_with_data += 1
        # Group rate rows by AD date, then one record per AD day.
        by_date: dict[str, list] = {}
        for row in rows:
            ad = (row.get("todayDate") or "")[:10]
            if ad:
                by_date.setdefault(ad, []).append(row)

        day_added = 0
        for ad_str in sorted(by_date):
            try:
                ad_date = datetime.date.fromisoformat(ad_str)
                bs = ndate.from_datetime_date(ad_date)
            except Exception:
                continue

            prices = extract_prices(by_date[ad_str])
            if "fine_gold_tola" not in prices and "fine_gold_gram" not in prices:
                continue

            record = {
                "day": str(bs.day),
                "month": NEPALI_MONTHS[bs.month - 1],
                "year": str(bs.year),
                "fine_gold_gram": format_price(prices.get("fine_gold_gram", 0)),
                "tejabi_gold_gram": format_price(
                    prices.get("fine_gold_gram", 0) * TEJABI_RATIO),
                "silver_gram": format_price(prices.get("silver_gram", 0)),
                "fine_gold_tola": format_price(prices.get("fine_gold_tola", 0)),
                "tejabi_gold_tola": format_price(
                    prices.get("fine_gold_tola", 0) * TEJABI_RATIO),
                "silver_tola": format_price(prices.get("silver_tola", 0)),
            }
            key = (record["day"], record["month"], record["year"])
            if key not in existing:
                records.append(record)
                existing.add(key)
                added += 1
                day_added += 1
                print(
                    f"  + {record['day']} {record['month']} {record['year']} "
                    f"(AD {ad_str}): fine {record['fine_gold_tola']}/tola",
                    flush=True,
                )
            else:
                # Refresh non-zero fields if we already have a stub.
                for i, rec in enumerate(records):
                    if (rec.get("day"), rec.get("month"), rec.get("year")) == key:
                        changed = False
                        for field, value in record.items():
                            if field in ("day", "month", "year"):
                                continue
                            if value != "0" and rec.get(field) in ("0", None, ""):
                                rec[field] = value
                                changed = True
                        if changed:
                            updated += 1
                        break

        print(
            f"  month {probe}: {len(by_date)} AD days with rates "
            f"(+{day_added} new BS records)",
            flush=True,
        )

    print(
        f"History API done: +{added} added, {updated} refreshed, "
        f"{months_with_data} months with data, {empty_months} empty",
        flush=True,
    )
    return added
