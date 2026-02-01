import scrapy
import re

class GoldSpider(scrapy.Spider):
    name = "gold_spider"
    start_urls = [
        'https://fenegosida.org/',
    ]

    def parse(self, response):
        # Extract date from the page
        # The date is shown as "18 Magh 2082" format
        full_text = ' '.join(response.css('::text').getall())
        date_match = re.search(r'(\d{1,2})\s+(Magh|Poush|Falgun|Chaitra|Baisakh|Jestha|Ashad|Shrawan|Bhadra|Ashoj|Kartik|Mansir)\s+(\d{4})', full_text)
        
        if date_match:
            day = date_match.group(1)
            month = date_match.group(2)
            year = date_match.group(3)
        else:
            # Fallback: use current Nepali date (you might need to calculate this)
            day = month = year = None
        
        # Find all rate containers
        rate_containers = response.css('div.rate-gold, div.rate-silver')
        
        # Initialize prices
        fine_gold_gram = "0"
        tejabi_gold_gram = "0"
        silver_gram = "0"
        fine_gold_tola = "0"
        tejabi_gold_tola = "0"
        silver_tola = "0"
        
        for container in rate_containers:
            text = container.css('p::text').getall()
            text_str = ' '.join(t.strip() for t in text if t.strip())
            
            # Get the price from <b> tag
            price = container.css('b::text').get()
            if price:
                price = price.strip()
            else:
                price = "0"
            
            # Check for per 10 gram prices
            if 'per 10 grm' in text_str or 'per 10 gram' in text_str:
                if 'FINE GOLD (9999)' in text_str:
                    fine_gold_gram = price
                elif 'TEJABI GOLD' in text_str:
                    tejabi_gold_gram = price if price != "0" else "0"
                elif 'SILVER' in text_str:
                    silver_gram = price
            
            # Check for per tola prices
            elif 'per 1 tola' in text_str or 'per 1 tole' in text_str:
                if 'FINE GOLD (9999)' in text_str:
                    fine_gold_tola = price
                elif 'TEJABI GOLD' in text_str:
                    tejabi_gold_tola = price if price != "0" else "0"
                elif 'SILVER' in text_str:
                    silver_tola = price
        
        # If Tejabi Gold is 0 or not found, calculate it as a percentage of Fine Gold
        # Tejabi Gold is typically 22K gold (91.6% pure) vs Fine Gold 24K (99.9% pure)
        # The typical difference is about 5-8% lower than Fine Gold
        if tejabi_gold_tola == "0" or tejabi_gold_tola == "-" or not tejabi_gold_tola:
            if fine_gold_tola and fine_gold_tola != "0":
                try:
                    # Tejabi Gold is typically ~94-96% of Fine Gold price
                    # Using 95% as a standard estimate
                    fine_gold_val = float(fine_gold_tola.replace(',', ''))
                    tejabi_gold_tola = str(int(fine_gold_val * 0.95))
                except:
                    tejabi_gold_tola = "0"
            else:
                tejabi_gold_tola = "0"
        
        if tejabi_gold_gram == "0" or tejabi_gold_gram == "-" or not tejabi_gold_gram:
            if fine_gold_gram and fine_gold_gram != "0":
                try:
                    fine_gold_val = float(fine_gold_gram.replace(',', ''))
                    tejabi_gold_gram = str(int(fine_gold_val * 0.95))
                except:
                    tejabi_gold_gram = "0"
            else:
                tejabi_gold_gram = "0"
        
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
