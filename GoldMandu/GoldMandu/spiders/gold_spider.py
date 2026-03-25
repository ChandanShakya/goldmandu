import scrapy


class GoldSpider(scrapy.Spider):
    name = "gold_spider"
    allowed_domains = ["fenegosida.org", "www.fenegosida.org"]

    history_url = "https://www.fenegosida.org/rate-history.php"
    nepali_months = [
        "Baisakh",
        "Jestha",
        "Ashad",
        "Shrawan",
        "Bhadra",
        "Ashoj",
        "Kartik",
        "Mansir",
        "Poush",
        "Magh",
        "Falgun",
        "Chaitra",
    ]

    custom_settings = {
        "DOWNLOAD_TIMEOUT": 30,
        "RETRY_TIMES": 3,
        "DOWNLOADER_CLIENTCONTEXTFACTORY": "scrapy.core.downloader.contextfactory.ScrapyClientContextFactory",
    }

    def __init__(self, start_year=2073, end_year=2082, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_year = int(start_year)
        self.end_year = int(end_year)

    def start_requests(self):
        for year in range(self.start_year, self.end_year + 1):
            for month in self.nepali_months:
                yield scrapy.FormRequest(
                    url=self.history_url,
                    formdata={"year": str(year), "month": month, "submit": "Submit"},
                    callback=self.parse_month,
                    meta={"year": str(year), "month": month},
                    dont_filter=True,
                )

    def parse_month(self, response):
        year = response.meta["year"]
        month = response.meta["month"]

        tables = response.css("table.table_rate_month")
        if len(tables) < 2:
            return

        tola_data = self._parse_table(tables[0])
        gram_data = self._parse_table(tables[1])
        all_days = sorted(
            set(tola_data.keys()) | set(gram_data.keys()),
            key=lambda d: int(d) if d.isdigit() else 0,
        )

        for day in all_days:
            tola = tola_data.get(day, {})
            gram = gram_data.get(day, {})

            fine_gold_tola = self._normalize_price(tola.get("fine", "0"))
            tejabi_gold_tola = self._normalize_price(tola.get("standard", "0"))
            silver_tola = self._normalize_price(tola.get("silver", "0"))

            fine_gold_gram = self._normalize_price(gram.get("fine", "0"))
            tejabi_gold_gram = self._normalize_price(gram.get("standard", "0"))
            silver_gram = self._normalize_price(gram.get("silver", "0"))

            tejabi_gold_tola = self._fallback_tejabi(fine_gold_tola, tejabi_gold_tola)
            tejabi_gold_gram = self._fallback_tejabi(fine_gold_gram, tejabi_gold_gram)

            yield {
                "day": day,
                "month": month,
                "year": year,
                "fine_gold_gram": fine_gold_gram,
                "tejabi_gold_gram": tejabi_gold_gram,
                "silver_gram": silver_gram,
                "fine_gold_tola": fine_gold_tola,
                "tejabi_gold_tola": tejabi_gold_tola,
                "silver_tola": silver_tola,
            }

    def _parse_table(self, table_selector):
        parsed = {}
        for row in table_selector.css("tr"):
            day = row.css("th::text").get(default="").strip()
            if not day:
                continue

            day = str(int(day)) if day.isdigit() else day
            cells = row.css("td")
            if len(cells) < 3:
                continue

            fine = self._extract_price(cells[0])
            standard = self._extract_price(cells[1])
            silver = self._extract_price(cells[2])

            if fine != "0" or standard != "0" or silver != "0":
                parsed[day] = {
                    "fine": fine,
                    "standard": standard,
                    "silver": silver,
                }

        return parsed

    def _extract_price(self, cell_selector):
        value = cell_selector.css("b::text").get()
        if value is None:
            value = " ".join(cell_selector.css("::text").getall()).strip()
        return self._normalize_price(value)

    def _normalize_price(self, value):
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

    def _fallback_tejabi(self, fine_value, tejabi_value):
        if tejabi_value != "0":
            return tejabi_value

        if fine_value == "0":
            return "0"

        try:
            return str(int(float(fine_value) * 0.95))
        except (TypeError, ValueError):
            return "0"
