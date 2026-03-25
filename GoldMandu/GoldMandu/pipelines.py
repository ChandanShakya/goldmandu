import json
import os
import csv


MONTH_ORDER = {
    "Baisakh": 1,
    "Jestha": 2,
    "Ashad": 3,
    "Shrawan": 4,
    "Bhadra": 5,
    "Ashoj": 6,
    "Kartik": 7,
    "Mansir": 8,
    "Poush": 9,
    "Magh": 10,
    "Falgun": 11,
    "Chaitra": 12,
}


def _normalize_price(value):
    if value is None:
        return "0"

    cleaned = str(value).strip().replace(",", "")
    if cleaned in {"", "-", "N/A", "NA", "None", "null"}:
        return "0"

    if set(cleaned) <= {"0", "."}:
        return "0"

    try:
        float(cleaned)
    except (TypeError, ValueError):
        return "0"

    return cleaned


def _normalize_day(day):
    text = str(day).strip()
    if text.isdigit():
        return str(int(text))
    return text


def _date_key(day, month, year):
    return f"{_normalize_day(day)}_{str(month).strip()}_{str(year).strip()}"


def _sort_key(item):
    year = (
        int(str(item.get("year", "0")).strip())
        if str(item.get("year", "")).strip().isdigit()
        else 0
    )
    month = MONTH_ORDER.get(str(item.get("month", "")).strip(), 99)
    day_text = str(item.get("day", "")).strip()
    day = int(day_text) if day_text.isdigit() else 0
    return (year, month, day)


def _is_missing_value(value):
    return _normalize_price(value) == "0"


def _merge_record_fill_missing(existing, incoming):
    merged = dict(existing)
    for key, incoming_value in incoming.items():
        if key in {"day", "month", "year"}:
            merged[key] = incoming_value
            continue

        existing_value = merged.get(key, "0")
        if _is_missing_value(existing_value) and not _is_missing_value(incoming_value):
            merged[key] = incoming_value

    return merged


def _merge_record_prefer_incoming(existing, incoming):
    merged = dict(existing)
    for key, incoming_value in incoming.items():
        if key in {"day", "month", "year"}:
            merged[key] = incoming_value
            continue

        if not _is_missing_value(incoming_value):
            merged[key] = incoming_value

    return merged


def _parse_csv_row_to_value_item(row):
    day = _normalize_day(row.get("Nepali_Day", ""))
    month = str(row.get("Nepali_Month", "")).strip()
    year = str(row.get("Nepali_Year", "")).strip()

    if not day or not month or not year:
        return None

    return {
        "day": day,
        "month": month,
        "year": year,
        "fine_gold_gram": _normalize_price(row.get("Fine_Gold_9999_10grm", "0")),
        "tejabi_gold_gram": _normalize_price(row.get("Standard_Gold_9950_10grm", "0")),
        "silver_gram": _normalize_price(row.get("Silver_10grm", "0")),
        "fine_gold_tola": _normalize_price(row.get("Fine_Gold_9999_Tola", "0")),
        "tejabi_gold_tola": _normalize_price(row.get("Standard_Gold_9950_Tola", "0")),
        "silver_tola": _normalize_price(row.get("Silver_Tola", "0")),
    }


def _get_csv_summary(csv_path):
    count = 0
    last_item = None

    with open(csv_path, "r", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            parsed = _parse_csv_row_to_value_item(row)
            if not parsed:
                continue
            count += 1
            if last_item is None or _sort_key(parsed) >= _sort_key(last_item):
                last_item = parsed

    last_sort_key = _sort_key(last_item) if last_item else (0, 99, 0)
    return count, last_sort_key


class JsonHistoryPipeline:
    def open_spider(self, spider):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.file_path = os.path.join(base_dir, "Values.json")
        self.csv_history_path = self._resolve_history_csv_path(base_dir, spider)
        # Ensure the directory for Values.json exists, if not, create it.
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)

        existing_items = []
        if os.path.exists(self.file_path) and os.path.getsize(self.file_path) > 0:
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    existing_items = json.load(f)
                if not isinstance(existing_items, list):
                    spider.logger.warning(
                        f"Values.json does not contain a list. Initializing with an empty list."
                    )
                    existing_items = []
            except json.JSONDecodeError:
                spider.logger.error(
                    f"Error decoding JSON from {self.file_path}. Initializing with an empty list."
                )
                existing_items = []
            except Exception as e:
                spider.logger.error(
                    f"Unexpected error reading {self.file_path}: {e}. Initializing with an empty list."
                )
                existing_items = []
        else:
            if not os.path.exists(self.file_path):
                spider.logger.info(
                    f"{self.file_path} does not exist. Will create it upon closing."
                )
            elif os.path.getsize(self.file_path) == 0:
                spider.logger.info(
                    f"{self.file_path} is empty. Initializing with an empty list."
                )

        historical_items = self._load_historical_from_csv(spider)
        self.items = self._merge_items(
            existing_items, historical_items, spider, source_label="historical CSV"
        )

    def _load_historical_from_csv(self, spider):
        historical_items = []

        if not os.path.exists(self.csv_history_path):
            spider.logger.warning(
                f"Historical CSV not found at {self.csv_history_path}. Skipping backfill."
            )
            return historical_items

        try:
            with open(self.csv_history_path, "r", encoding="utf-8") as csv_file:
                reader = csv.DictReader(csv_file)
                for row in reader:
                    parsed = _parse_csv_row_to_value_item(row)
                    if parsed:
                        historical_items.append(parsed)

            spider.logger.info(
                f"Loaded {len(historical_items)} historical records from CSV."
            )
        except Exception as e:
            spider.logger.error(
                f"Failed to load historical CSV {self.csv_history_path}: {e}"
            )

        return historical_items

    def _resolve_history_csv_path(self, base_dir, spider):
        local_csv = os.path.join(base_dir, "nepal_gold_silver_prices.csv")
        parent_csv = os.path.join(
            os.path.abspath(os.path.join(base_dir, "..")),
            "nepal_gold_silver_prices.csv",
        )
        candidates = [local_csv, parent_csv]

        best_path = None
        best_count = -1
        best_last_key = (0, 99, 0)

        for candidate in candidates:
            if not os.path.exists(candidate):
                continue

            try:
                count, last_key = _get_csv_summary(candidate)
            except Exception as e:
                spider.logger.warning(f"Failed to summarize CSV {candidate}: {e}")
                continue

            if (
                best_path is None
                or count > best_count
                or (count == best_count and last_key > best_last_key)
            ):
                best_path = candidate
                best_count = count
                best_last_key = last_key

        if best_path:
            spider.logger.info(
                f"Using historical CSV source: {best_path} (records={best_count}, last_key={best_last_key})"
            )
            return best_path

        spider.logger.warning(
            f"No historical CSV candidate found. Defaulting to local path: {local_csv}"
        )
        return local_csv

    def _merge_items(self, base_items, incoming_items, spider, source_label):
        merged = {}

        for item in base_items:
            key = _date_key(item.get("day"), item.get("month"), item.get("year"))
            merged[key] = dict(item)

        updates = 0
        additions = 0

        for item in incoming_items:
            key = _date_key(item.get("day"), item.get("month"), item.get("year"))
            if key in merged:
                merged[key] = _merge_record_fill_missing(merged[key], item)
                updates += 1
            else:
                merged[key] = dict(item)
                additions += 1

        merged_items = sorted(merged.values(), key=_sort_key)
        spider.logger.info(
            f"Merged {source_label}: {additions} added, {updates} updated. Total records: {len(merged_items)}"
        )
        return merged_items

    def process_item(self, item, spider):
        normalized_item = {
            "day": _normalize_day(item.get("day", "")),
            "month": str(item.get("month", "")).strip(),
            "year": str(item.get("year", "")).strip(),
            "fine_gold_gram": _normalize_price(item.get("fine_gold_gram", "0")),
            "tejabi_gold_gram": _normalize_price(item.get("tejabi_gold_gram", "0")),
            "silver_gram": _normalize_price(item.get("silver_gram", "0")),
            "fine_gold_tola": _normalize_price(item.get("fine_gold_tola", "0")),
            "tejabi_gold_tola": _normalize_price(item.get("tejabi_gold_tola", "0")),
            "silver_tola": _normalize_price(item.get("silver_tola", "0")),
        }

        if (
            normalized_item["day"] == ""
            or normalized_item["month"] == ""
            or normalized_item["year"] == ""
        ):
            spider.logger.warning("Skipping item with incomplete date fields.")
            return item

        date_key = _date_key(
            normalized_item.get("day"),
            normalized_item.get("month"),
            normalized_item.get("year"),
        )

        existing_index = None
        for i, existing_item in enumerate(self.items):
            existing_key = _date_key(
                existing_item.get("day"),
                existing_item.get("month"),
                existing_item.get("year"),
            )
            if existing_key == date_key:
                existing_index = i
                break

        if existing_index is not None:
            spider.logger.info(
                f"Updating existing entry for {normalized_item['day']} {normalized_item['month']} {normalized_item['year']}"
            )
            self.items[existing_index] = _merge_record_prefer_incoming(
                self.items[existing_index], normalized_item
            )
        else:
            spider.logger.info(
                f"Adding new entry for {normalized_item['day']} {normalized_item['month']} {normalized_item['year']}"
            )
            self.items.append(normalized_item)

        return item

    def close_spider(self, spider):
        try:
            self.items = sorted(self.items, key=_sort_key)
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.items, f, indent=4, ensure_ascii=False)
            spider.logger.info(
                f"Successfully wrote {len(self.items)} items to {self.file_path}"
            )
        except Exception as e:
            spider.logger.error(f"Error writing to {self.file_path}: {e}")


class GoldmanduPipeline:
    def process_item(self, item, spider):
        return item
