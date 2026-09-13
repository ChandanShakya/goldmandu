"""Historical backfill from Wayback Machine snapshots of fenegosida.org.

Only days missing from the in-memory records are inserted. Snapshots are
sparse (~one per few days, not daily), so this recovers what the archive
still has — not a complete calendar.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import ssl
import time
import urllib.request

from .api import HEADERS
from .schema import NEPALI_MONTHS, TEJABI_RATIO, format_price

# Some environments MITM web.archive.org; keep live API verified, archive not.
_ARCHIVE_CTX = ssl._create_unverified_context()

# Homepage + old rate-history form both carry the day's rate divs.
_CDX_ENDPOINTS = (
    (
        "https://web.archive.org/cdx/search/cdx?url=fenegosida.org/"
        "&output=json&fl=timestamp,original,statuscode,mimetype"
        "&filter=statuscode:200&filter=mimetype:text/html"
        "&collapse=timestamp:8&from=2017&limit=5000"
    ),
    (
        "https://web.archive.org/cdx/search/cdx?url=fenegosida.org/rate-history.php"
        "&output=json&fl=timestamp,original,statuscode,mimetype"
        "&filter=statuscode:200&filter=mimetype:text/html"
        "&collapse=timestamp:8&from=2017&limit=2000"
    ),
)


def _urlopen(url: str, timeout: int = 60):
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=timeout, context=_ARCHIVE_CTX)


def list_snapshots() -> list[tuple[str, str]]:
    """Return sorted (timestamp, original_url) pairs, one per day per URL family."""
    seen: dict[str, str] = {}
    for cdx_url in _CDX_ENDPOINTS:
        try:
            with _urlopen(cdx_url) as resp:
                data = json.load(resp)
        except Exception as exc:
            print(f"  ! Wayback CDX failed: {exc}", flush=True)
            continue
        if not isinstance(data, list) or len(data) < 2:
            continue
        for row in data[1:]:
            if not row or not row[0]:
                continue
            ts = row[0]
            original = row[1] if len(row) > 1 and row[1] else "https://fenegosida.org/"
            # Prefer homepage over rate-history for the same day (richer markup).
            if ts not in seen or "rate-history" in seen[ts]:
                if "rate-history" in original and ts in seen and "rate-history" not in seen[ts]:
                    continue
                seen[ts] = original
    return sorted(seen.items())


def parse_homepage(html: str) -> dict[str, float] | None:
    """Parse archived homepage / rate-history rate divs into a price dict."""
    found: dict[str, float] = {}
    pattern = re.finditer(
        r'<div class="rate-(?:gold|silver)[^"]*">\s*<p>(.*?)</p>',
        html,
        re.S,
    )
    for match in pattern:
        text = " ".join(re.sub(r"<[^>]+>", " ", match.group(1)).split())
        pm = re.search(
            r"(FINE GOLD|TEJABI GOLD|SILVER)\s*(?:\(9999\))?\s*"
            r"per\s+(10 grm|1 tola).*?([\d,]+(?:\.\d+)?)",
            text,
            re.I,
        )
        if not pm:
            continue
        label, unit, num = pm.groups()
        try:
            val = float(num.replace(",", ""))
        except ValueError:
            continue
        label = label.upper()
        is_gram = "grm" in unit
        if "FINE" in label:
            key = "fine_gold_gram" if is_gram else "fine_gold_tola"
        elif "TEJABI" in label:
            key = "tejabi_gold_gram" if is_gram else "tejabi_gold_tola"
        else:
            key = "silver_gram" if is_gram else "silver_tola"
        if val > 0:
            found[key] = val

    if "fine_gold_tola" not in found and "fine_gold_gram" not in found:
        return None
    return found


def _snapshot_url(original: str, ts: str) -> str:
    # id_ returns the raw archived document without Wayback chrome.
    if original.startswith("http://") or original.startswith("https://"):
        return f"https://web.archive.org/web/{ts}id_/{original}"
    return f"https://web.archive.org/web/{ts}id_/https://{original}"


def backfill(
    records: list,
    existing: set,
    ndate,
    *,
    sleep_s: float = 0.6,
    max_snapshots: int | None = None,
) -> int:
    """Insert missing BS-dated records from Wayback homepage snapshots.

    Never modifies existing records. Returns count of records added.
    """
    added = 0
    skipped_existing = 0
    unparseable = 0
    fetch_fail = 0

    snapshots = list_snapshots()
    if max_snapshots is not None:
        snapshots = snapshots[:max_snapshots]
    print(f"  Wayback: {len(snapshots)} candidate snapshots", flush=True)

    for ts, original in snapshots:
        try:
            snap_ad = dt.date(int(ts[0:4]), int(ts[4:6]), int(ts[6:8]))
            bs = ndate.from_datetime_date(snap_ad)
        except Exception:
            continue

        key = (str(bs.day), NEPALI_MONTHS[bs.month - 1], str(bs.year))
        if key in existing:
            skipped_existing += 1
            continue

        url = _snapshot_url(original, ts)
        try:
            with _urlopen(url, timeout=30) as resp:
                html = resp.read().decode("utf-8", "replace")
        except Exception as exc:
            fetch_fail += 1
            print(f"  ! Wayback fetch {ts} failed: {exc}", flush=True)
            continue

        found = parse_homepage(html)
        time.sleep(sleep_s)
        if not found:
            unparseable += 1
            continue

        fine_tola = format_price(found.get("fine_gold_tola", 0))
        fine_gram = format_price(found.get("fine_gold_gram", 0))
        tej_tola = format_price(
            found.get("tejabi_gold_tola",
                      found.get("fine_gold_tola", 0) * TEJABI_RATIO)
        )
        tej_gram = format_price(
            found.get("tejabi_gold_gram",
                      found.get("fine_gold_gram", 0) * TEJABI_RATIO)
        )

        records.append({
            "day": key[0],
            "month": key[1],
            "year": key[2],
            "fine_gold_gram": fine_gram,
            "tejabi_gold_gram": tej_gram,
            "silver_gram": format_price(found.get("silver_gram", 0)),
            "fine_gold_tola": fine_tola,
            "tejabi_gold_tola": tej_tola,
            "silver_tola": format_price(found.get("silver_tola", 0)),
        })
        existing.add(key)
        added += 1
        print(
            f"  + {key[0]} {key[1]} {key[2]} (snapshot {ts[:8]}): "
            f"fine {fine_tola}/tola",
            flush=True,
        )

    print(
        f"  Wayback summary: +{added} added, {skipped_existing} already present, "
        f"{unparseable} unparsable, {fetch_fail} fetch errors",
        flush=True,
    )
    return added
