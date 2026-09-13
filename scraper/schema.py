"""Shared constants and record helpers for GoldMandu price data."""

from __future__ import annotations

# BS month names, index 0 = Baisakh
NEPALI_MONTHS = [
    "Baisakh", "Jestha", "Ashad", "Shrawan",
    "Bhadra", "Ashoj", "Kartik", "Mansir",
    "Poush", "Magh", "Falgun", "Chaitra",
]

MONTH_ORDER = {m: i for i, m in enumerate(NEPALI_MONTHS)}

# Live API only publishes chapawal (fine) gold; tejabi is market-derived.
TEJABI_RATIO = 0.95
TEJABI_TOLERANCE = 0.03  # allow ±3% absolute ratio deviation

# 1 tola = 11.66 g; *_gram fields store the association's "per 10 gram" rate.
GRAMS_PER_TOLA = 11.66
TOLA_PER_10G = GRAMS_PER_TOLA / 10.0  # ≈ 1.166

REQUIRED_FIELDS = (
    "day", "month", "year",
    "fine_gold_gram", "tejabi_gold_gram", "silver_gram",
    "fine_gold_tola", "tejabi_gold_tola", "silver_tola",
)

PRICE_FIELDS = (
    "fine_gold_gram", "tejabi_gold_gram", "silver_gram",
    "fine_gold_tola", "tejabi_gold_tola", "silver_tola",
)


def bs_key(day, month, year) -> tuple:
    """Sort key for a BS date. Unparseable dates sort last."""
    try:
        return (int(year), MONTH_ORDER.get(month, 99), int(day))
    except (TypeError, ValueError):
        return (0, 99, 0)


def format_price(value: float) -> str:
    """Normalise a numeric price to the Values.json string style."""
    if not value:
        return "0"
    return str(int(round(float(value))))


def parse_price(value) -> float | None:
    """Parse a price string/number. Returns None for missing/invalid/non-positive."""
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None
