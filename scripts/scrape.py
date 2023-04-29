import scrapy

class GoldSpider(scrapy.Spider):
    name = "gold_spider"
    start_urls = [
        'http://fenegosida.org/',
    ]

    def parse(self, response):
        day = response.css('div.rate-date-day::text').get()
        month = response.css('div.rate-date-month::text').get()
        year = response.css('div.rate-date-year::text').get()
        fine_gold_gram = response.css('div.rate-gold p:contains("FINE GOLD (9999)") b::text').get()
        tejabi_gold_gram = response.css('div.rate-gold p:contains("TEJABI GOLD") b::text').get()
        silver_gram = response.css('div.rate-silver p:contains("SILVER") b::text').get()
        fine_gold_tola = response.css('div#vtab div:contains("FINE GOLD (9999)") + div div.rate-gold p:first-child b::text').get()
        tejabi_gold_tola = response.css('div#vtab div:contains("TEJABI GOLD") + div div.rate-gold:nth-child(2) p:first-child b::text').get()
        silver_tola = response.css('div#vtab div:contains("SILVER") + div div.rate-silver p:first-child b::text').get()

        yield {
            'day': day,
            'month': month,
            'year': year,
            'fine_gold_gram': fine_gold_gram,
            'tejabi_gold_gram': tejabi_gold_gram,
            'silver_gram': silver_gram,
            'fine_gold_tola': fine_gold_tola,
            'tejabi_gold_tola': tejabi_gold_tola,
            'silver_tola': silver_tola
        }
