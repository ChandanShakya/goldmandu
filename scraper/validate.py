"""Validate GoldMandu price history (data/prices.json)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .schema import (
    NEPALI_MONTHS,
    PRICE_FIELDS,
    REQUIRED_FIELDS,
    TEJABI_RATIO,
    TEJABI_TOLERANCE,
    TOLA_PER_10G,
    bs_key,
    parse_price,
)

# Absolute NPR jump vs previous valid fine-gold tola that warrants a warning.
JUMP_WARN_ABS = 25_000
# Relative tola/10g ratio must sit near 1.166 within this tolerance.
UNIT_RATIO_TOL = 0.05


def load_records(path: Path) -> list:
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("prices file must be a JSON array")
    return data


def validate_records(records: list) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors block CI; warnings are informational."""
    errors: list[str] = []
    warnings: list[str] = []

    if not records:
        errors.append("no records")
        return errors, warnings

    seen: dict[tuple, int] = {}
    prev_fine: float | None = None
    tejabi_off = 0
    tejabi_ratios: list[float] = []
    unit_off = 0
    jump_count = 0

    for i, rec in enumerate(records):
        loc = f"record[{i}]"
        if not isinstance(rec, dict):
            errors.append(f"{loc}: not an object")
            continue

        for field in REQUIRED_FIELDS:
            if field not in rec or rec[field] in (None, ""):
                errors.append(f"{loc}: missing '{field}'")

        month = rec.get("month")
        if month is not None and month not in NEPALI_MONTHS:
            errors.append(f"{loc}: unknown month '{month}'")

        try:
            day = int(rec.get("day", 0))
            year = int(rec.get("year", 0))
            if not (1 <= day <= 32):
                errors.append(f"{loc}: day out of range ({day})")
            if not (2070 <= year <= 2100):
                warnings.append(f"{loc}: unusual BS year {year}")
        except (TypeError, ValueError):
            errors.append(f"{loc}: non-numeric day/year")
            day = year = None

        if day is not None and month in NEPALI_MONTHS:
            key = (str(day), month, str(year))
            if key in seen:
                errors.append(
                    f"{loc}: duplicate BS date {day} {month} {year} "
                    f"(also at record[{seen[key]}])"
                )
            else:
                seen[key] = i

        prices = {}
        for field in PRICE_FIELDS:
            val = parse_price(rec.get(field))
            prices[field] = val
            raw = rec.get(field)
            # Allow historical "0" only as explicit missing; flag other junk.
            if raw not in (None, "", "0", 0) and val is None:
                errors.append(f"{loc}: invalid price {field}={raw!r}")
            if val is not None and val > 10_000_000:
                errors.append(f"{loc}: implausible {field}={val}")

        fine_t = prices.get("fine_gold_tola")
        fine_g = prices.get("fine_gold_gram")
        tej_t = prices.get("tejabi_gold_tola")
        tej_g = prices.get("tejabi_gold_gram")
        silver_t = prices.get("silver_tola")

        if fine_t and silver_t and silver_t >= fine_t:
            errors.append(
                f"{loc}: silver_tola ({silver_t}) >= fine_gold_tola ({fine_t})"
            )

        if fine_t and tej_t:
            ratio = tej_t / fine_t
            tejabi_ratios.append(ratio)
            if abs(ratio - TEJABI_RATIO) > TEJABI_TOLERANCE:
                tejabi_off += 1

        if fine_t and fine_g:
            unit_ratio = fine_t / fine_g
            if abs(unit_ratio - TOLA_PER_10G) > UNIT_RATIO_TOL:
                unit_off += 1

        if fine_t and prev_fine is not None:
            jump = abs(fine_t - prev_fine)
            if jump >= JUMP_WARN_ABS:
                jump_count += 1
                if jump_count <= 8:
                    warnings.append(
                        f"{loc}: fine_gold_tola jumped {jump:,.0f} "
                        f"({prev_fine:,.0f} → {fine_t:,.0f})"
                    )
        if fine_t:
            prev_fine = fine_t

    if tejabi_off:
        lo = min(tejabi_ratios) if tejabi_ratios else 0
        hi = max(tejabi_ratios) if tejabi_ratios else 0
        med = sorted(tejabi_ratios)[len(tejabi_ratios) // 2] if tejabi_ratios else 0
        warnings.append(
            f"tejabi/fine ratio off ~{TEJABI_RATIO} on {tejabi_off}/{len(records)} "
            f"records (min={lo:.3f}, median={med:.3f}, max={hi:.3f}); "
            f"early-era published tejabi was often near fine"
        )
    if unit_off:
        warnings.append(
            f"tola/10g ratio off ~{TOLA_PER_10G:.3f} on {unit_off} records"
        )
    if jump_count > 8:
        warnings.append(f"... and {jump_count - 8} more fine-gold jumps ≥ {JUMP_WARN_ABS:,}")

    # Order check (soft): sorted by BS date
    keys = [bs_key(r.get("day"), r.get("month"), r.get("year")) for r in records]
    if keys != sorted(keys):
        warnings.append("records are not sorted by BS date")

    return errors, warnings


def validate_file(path: Path) -> int:
    """Validate a prices JSON file. Returns exit code (0 ok, 1 errors)."""
    try:
        records = load_records(path)
    except Exception as exc:
        print(f"FATAL: cannot load {path}: {exc}", file=sys.stderr)
        return 1

    errors, warnings = validate_records(records)
    print(f"Validated {len(records)} records from {path}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:30]:
            print(f"  - {w}")
        if len(warnings) > 30:
            print(f"  ... and {len(warnings) - 30} more")
    if errors:
        print(f"Errors ({len(errors)}):", file=sys.stderr)
        for e in errors[:50]:
            print(f"  - {e}", file=sys.stderr)
        if len(errors) > 50:
            print(f"  ... and {len(errors) - 50} more", file=sys.stderr)
        return 1

    latest = records[-1]
    print(
        f"OK: latest {latest.get('day')} {latest.get('month')} "
        f"{latest.get('year')} fine={latest.get('fine_gold_tola')}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate GoldMandu price data")
    parser.add_argument(
        "path",
        nargs="?",
        default="data/prices.json",
        help="path to prices JSON (default: data/prices.json)",
    )
    args = parser.parse_args(argv)
    return validate_file(Path(args.path))


if __name__ == "__main__":
    sys.exit(main())
