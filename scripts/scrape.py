import scrapy

class GoldSpider(scrapy.Spider):
    name = "gold_spider"
    start_urls = [
        'http://fenegosida.org/',
    ]

    def parse(self, response):
        fine_gold_gram = response.css('div.rate-gold p:contains("FINE GOLD (9999)") b::text').get()
        tejabi_gold_gram = response.css('div.rate-gold p:contains("TEJABI GOLD") b::text').get()
        silver_gram = response.css('div.rate-silver p:contains("SILVER") b::text').get()
        fine_gold_tola = response.css('div.rate-gold p:contains("FINE GOLD (9999)") b::text').get()
        tejabi_gold_tola = response.css('div.rate-gold p:contains("TEJABI GOLD") b::text').get()
        silver_tola = response.css('div.rate-silver p:contains("SILVER") b::text').get()

        yield {
            'fine_gold_gram': fine_gold_gram,
            'tejabi_gold_gram': tejabi_gold_gram,
            'silver_gram': silver_gram,
            'fine_gold_tola': fine_gold_tola,
            'tejabi_gold_tola': tejabi_gold_tola,
            'silver_tola': silver_tola
        }
