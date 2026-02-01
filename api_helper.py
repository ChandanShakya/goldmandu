#!/usr/bin/env python3
"""
API Helper for Goldmandu
========================
This script provides helper functions to:
1. Fetch gold prices from FENEGOSIDA
2. Calculate Tejabi Gold prices
3. Convert between units (tola/gram)
4. Convert international gold prices to NPR

Usage:
    python api_helper.py
"""

import requests
from bs4 import BeautifulSoup
import re

# Conversion constants
GRAM_PER_TOLA = 11.66  # 1 tola = 11.66 grams
USD_TO_NPR_RATE = 133.5  # Approximate rate (update as needed)

# Tejabi Gold is 22K (91.6% pure) vs Fine Gold 24K (99.9% pure)
# Market typically prices Tejabi at 94-96% of Fine Gold
TEJABI_GOLD_RATIO = 0.95


def fetch_fenegosida_prices():
    """
    Fetch current gold and silver prices from FENEGOSIDA website.
    
    Returns:
        dict: Dictionary containing all prices
    """
    url = "https://fenegosida.org"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract date
        full_text = soup.get_text()
        date_match = re.search(
            r'(\d{1,2})\s+(Magh|Poush|Falgun|Chaitra|Baisakh|Jestha|Ashad|Shrawan|Bhadra|Ashoj|Kartik|Mansir)\s+(\d{4})',
            full_text
        )
        
        day = date_match.group(1) if date_match else None
        month = date_match.group(2) if date_match else None
        year = date_match.group(3) if date_match else None
        
        # Find all rate containers
        rate_containers = soup.find_all('div', class_=['rate-gold', 'rate-silver'])
        
        prices = {
            'day': day,
            'month': month,
            'year': year,
            'fine_gold_gram': '0',
            'tejabi_gold_gram': '0',
            'silver_gram': '0',
            'fine_gold_tola': '0',
            'tejabi_gold_tola': '0',
            'silver_tola': '0'
        }
        
        for container in rate_containers:
            text = container.get_text()
            b_tag = container.find('b')
            price = b_tag.get_text().strip() if b_tag else '0'
            
            if 'per 10 grm' in text:
                if 'FINE GOLD (9999)' in text:
                    prices['fine_gold_gram'] = price
                elif 'TEJABI GOLD' in text:
                    prices['tejabi_gold_gram'] = price
                elif 'SILVER' in text:
                    prices['silver_gram'] = price
            elif 'per 1 tola' in text:
                if 'FINE GOLD (9999)' in text:
                    prices['fine_gold_tola'] = price
                elif 'TEJABI GOLD' in text:
                    prices['tejabi_gold_tola'] = price
                elif 'SILVER' in text:
                    prices['silver_tola'] = price
        
        # Calculate Tejabi Gold if not available
        prices['tejabi_gold_tola'] = calculate_tejabi_price(
            prices['fine_gold_tola'],
            prices['tejabi_gold_tola']
        )
        prices['tejabi_gold_gram'] = calculate_tejabi_price(
            prices['fine_gold_gram'],
            prices['tejabi_gold_gram']
        )
        
        return prices
        
    except Exception as e:
        print(f"Error fetching from FENEGOSIDA: {e}")
        return None


def calculate_tejabi_price(fine_gold_price, tejabi_price):
    """
    Calculate Tejabi Gold price if not available from source.
    
    Args:
        fine_gold_price: Price of Fine Gold (24K)
        tejabi_price: Current Tejabi price (may be "0" or "-")
    
    Returns:
        str: Calculated Tejabi Gold price
    """
    if tejabi_price and tejabi_price not in ['0', '-', '', None]:
        return tejabi_price
    
    if fine_gold_price and fine_gold_price not in ['0', '-', '', None]:
        try:
            fine_val = float(fine_gold_price.replace(',', ''))
            return str(int(fine_val * TEJABI_GOLD_RATIO))
        except:
            pass
    return '0'


def convert_tola_to_gram(tola_price):
    """Convert price per tola to price per 10 grams."""
    try:
        tola_val = float(tola_price.replace(',', ''))
        gram_val = (tola_val / GRAM_PER_TOLA) * 10
        return str(int(gram_val))
    except:
        return '0'


def convert_gram_to_tola(gram_price):
    """Convert price per 10 grams to price per tola."""
    try:
        gram_val = float(gram_price.replace(',', ''))
        tola_val = (gram_val / 10) * GRAM_PER_TOLA
        return str(int(tola_val))
    except:
        return '0'


def convert_usd_to_npr(usd_price):
    """Convert USD price to NPR."""
    try:
        usd_val = float(usd_price)
        npr_val = usd_val * USD_TO_NPR_RATE
        return str(int(npr_val))
    except:
        return '0'


def get_international_gold_price():
    """
    Fetch international gold price (this is a placeholder).
    You would need an actual API key for services like GoldAPI or Metals-API.
    """
    # Example with GoldAPI (requires API key):
    # url = "https://www.goldapi.io/api/XAU/USD"
    # headers = {"x-access-token": "YOUR_API_KEY"}
    # response = requests.get(url, headers=headers)
    # return response.json()
    
    return {
        'note': 'This is a placeholder. Get a free API key from goldapi.io or metals-api.com'
    }


if __name__ == '__main__':
    print("=" * 60)
    print("Goldmandu API Helper")
    print("=" * 60)
    
    # Fetch current prices
    prices = fetch_fenegosida_prices()
    
    if prices:
        print(f"\nDate: {prices['day']} {prices['month']} {prices['year']}")
        print("-" * 60)
        print(f"Fine Gold (9999):")
        print(f"  Per 10 Gram: Rs. {prices['fine_gold_gram']}")
        print(f"  Per Tola: Rs. {prices['fine_gold_tola']}")
        print(f"\nTejabi Gold (22K):")
        print(f"  Per 10 Gram: Rs. {prices['tejabi_gold_gram']}")
        print(f"  Per Tola: Rs. {prices['tejabi_gold_tola']}")
        print(f"\nSilver:")
        print(f"  Per 10 Gram: Rs. {prices['silver_gram']}")
        print(f"  Per Tola: Rs. {prices['silver_tola']}")
    else:
        print("Failed to fetch prices from FENEGOSIDA")
    
    print("=" * 60)
