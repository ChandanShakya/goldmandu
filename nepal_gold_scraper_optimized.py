import requests
from bs4 import BeautifulSoup
import csv
from statistics import mean
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time

# Try to import nepali_datetime, if not available, use basic conversion
try:
    from nepali_datetime import date as nepali_date
    HAS_NEPALI_DATETIME = True
except ImportError:
    HAS_NEPALI_DATETIME = False
    print("⚠ Warning: nepali-datetime not installed. Install with: pip install nepali-datetime")
    print("Using approximate date conversion...\n")

# Global locks for thread safety
ratio_lock = Lock()

def scrape_nepal_gold_prices():
    """Main scraping function"""
    url = "https://www.fenegosida.org/rate-history.php"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
    }

    nepali_months = ['Baisakh', 'Jestha', 'Ashad', 'Shrawan',
                     'Bhadra', 'Ashoj', 'Kartik', 'Mansir',
                     'Poush', 'Magh', 'Falgun', 'Chaitra']

    years = list(range(2073, 2083))

    # CSV headers with separate English date columns
    csv_data = [[
        # Nepali Date Components
        'Nepali_Year', 'Nepali_Month', 'Nepali_Month_Num', 'Nepali_Day', 'Nepali_Date',
        # English Date Components
        'English_Year', 'English_Month', 'English_Day', 'English_Date',
        # Price Data - Tola
        'Fine_Gold_9999_Tola', 'Standard_Gold_9950_Tola', 'Silver_Tola',
        # Price Data - 10 Gram
        'Fine_Gold_9999_10grm', 'Standard_Gold_9950_10grm', 'Silver_10grm',
        # Calculated Ratios - Tola
        'Tola_Actual_Ratio_9999_9950', 'Tola_9950_Calculated', 'Tola_Margin',
        # Calculated Ratios - Gram
        'Gram_Actual_Ratio_9999_9950', 'Gram_9950_Calculated', 'Gram_Margin',
        # Market Metrics
        'Gold_Silver_Ratio_Tola', 'Gold_Silver_Ratio_Gram',
        'Discount_Pct_9999_9950_Tola', 'Discount_Pct_9999_9950_Gram',
        # Price Changes (Daily)
        'Tola_Fine_Change_Amount', 'Tola_Fine_Change_Percent',
        # Data Quality Indicators
        'Missing_Standard_Tola', 'Missing_Standard_Gram', 'Data_Quality_Score'
    ]]

    monthly_ratios_tola = {}
    monthly_ratios_gram = {}
    all_month_data = {}

    # Test connection
    print("=" * 70)
    print("NEPAL GOLD & SILVER PRICE SCRAPER")
    print("=" * 70)
    print("\n🔍 Testing connection...")
    
    try:
        test_payload = {'year': '2081', 'month': 'Shrawan', 'submit': 'Submit'}
        test_response = requests.post(url, data=test_payload, headers=headers, timeout=30)
        
        if test_response.status_code == 200:
            soup = BeautifulSoup(test_response.text, 'lxml')
            tables = soup.find_all('table', {'class': 'table_rate_month'})
            print(f"✓ Connection successful (Status: {test_response.status_code})")
            print(f"✓ Found {len(tables)} tables in test request")
        else:
            print(f"✗ Bad response: {test_response.status_code}")
            return
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return

    # Create tasks
    tasks = []
    for year in years:
        for month in nepali_months:
            month_val = nepali_months.index(month) + 1
            tasks.append((year, month, month_val))

    print(f"\n📊 Starting parallel scraping...")
    print(f"   • Total months to scrape: {len(tasks)}")
    print(f"   • Parallel workers: {min(10, len(tasks))}")
    print(f"   • Date range: {years[0]}-{years[-1]} BS\n")

    # Parallel fetching
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_task = {
            executor.submit(fetch_month_data, url, headers, year, month, month_val): 
            (year, month, month_val)
            for year, month, month_val in tasks
        }

        completed = 0
        success_count = 0
        
        for future in as_completed(future_to_task):
            year, month, month_val = future_to_task[future]
            try:
                result = future.result()
                if result and result['record_count'] > 0:
                    month_key = f"{year}-{month}"
                    with ratio_lock:
                        all_month_data[month_key] = result
                        if result['ratio_tola']:
                            monthly_ratios_tola[month_key] = result['ratio_tola']
                        if result['ratio_gram']:
                            monthly_ratios_gram[month_key] = result['ratio_gram']
                    
                    completed += 1
                    success_count += 1
                    print(f"[{completed:3d}/{len(tasks)}] ✓ {year}-{month:8s} → {result['record_count']:2d} records")
                else:
                    completed += 1
                    print(f"[{completed:3d}/{len(tasks)}] ✗ {year}-{month:8s} → No data")
            except Exception as e:
                completed += 1
                print(f"[{completed:3d}/{len(tasks)}] ✗ {year}-{month:8s} → Error: {str(e)[:40]}")

    print(f"\n{'='*70}")
    print(f"Scraping Summary: {success_count}/{len(tasks)} months successful")
    print(f"{'='*70}\n")

    if success_count == 0:
        print("✗ No data scraped. Please check your connection and website status.")
        return

    print("📝 Processing and organizing data...\n")

    previous_fine_tola = None
    total_records = 0

    # Process all data in chronological order
    for year in years:
        for month in nepali_months:
            month_val = nepali_months.index(month) + 1
            month_key = f"{year}-{month}"
            
            if month_key not in all_month_data:
                continue

            data = all_month_data[month_key]
            
            fallback_ratio_tola = get_fallback_value(monthly_ratios_tola, year, month, nepali_months)
            fallback_ratio_gram = get_fallback_value(monthly_ratios_gram, year, month, nepali_months)

            for day in sorted(data['days'], key=lambda x: int(x) if x.isdigit() else 0):
                tola = data['tola_data'].get(day, {})
                grm = data['grm_data'].get(day, {})

                # Extract prices
                fine_tola = tola.get('fine', '')
                standard_tola = tola.get('standard', '')
                silver_tola = tola.get('silver', '')
                
                fine_gram = grm.get('fine', '')
                standard_gram = grm.get('standard', '')
                silver_gram = grm.get('silver', '')

                # Process ratios and calculations
                actual_ratio_tola, calc_9950_tola, margin_tola = process_record(
                    fine_tola, standard_tola,
                    data['ratio_tola'], fallback_ratio_tola,
                    is_tola=True
                )
                
                actual_ratio_gram, calc_9950_gram, margin_gram = process_record(
                    fine_gram, standard_gram,
                    data['ratio_gram'], fallback_ratio_gram,
                    is_tola=False
                )

                # Date conversions
                nepali_date_str = f"{year}-{month_val:02d}-{day}"
                eng_year, eng_month, eng_day, english_date_str = convert_nepali_to_english(
                    year, month_val, day
                )

                # Market metrics
                gold_silver_ratio_tola = calculate_ratio(fine_tola, silver_tola)
                gold_silver_ratio_gram = calculate_ratio(fine_gram, silver_gram)
                
                discount_pct_tola = calculate_discount_percentage(fine_tola, standard_tola)
                discount_pct_gram = calculate_discount_percentage(fine_gram, standard_gram)
                
                # Price changes
                daily_change, daily_change_pct = calculate_daily_change(fine_tola, previous_fine_tola)
                
                # Data quality
                missing_std_tola = 1 if (fine_tola and not standard_tola) else 0
                missing_std_gram = 1 if (fine_gram and not standard_gram) else 0
                quality_score = calculate_quality_score(fine_tola, standard_tola, fine_gram, standard_gram)

                # Add row
                csv_data.append([
                    # Nepali Date
                    year, month, month_val, day, nepali_date_str,
                    # English Date
                    eng_year, eng_month, eng_day, english_date_str,
                    # Prices - Tola
                    fine_tola, standard_tola, silver_tola,
                    # Prices - Gram
                    fine_gram, standard_gram, silver_gram,
                    # Ratios - Tola
                    actual_ratio_tola, calc_9950_tola, margin_tola,
                    # Ratios - Gram
                    actual_ratio_gram, calc_9950_gram, margin_gram,
                    # Market Metrics
                    gold_silver_ratio_tola, gold_silver_ratio_gram,
                    discount_pct_tola, discount_pct_gram,
                    # Changes
                    daily_change, daily_change_pct,
                    # Quality
                    missing_std_tola, missing_std_gram, quality_score
                ])

                # Update previous price
                if fine_tola:
                    try:
                        previous_fine_tola = float(fine_tola)
                    except:
                        pass
                
                total_records += 1

    # Save to CSV
    filename = 'nepal_gold_silver_prices.csv'
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(csv_data)

    # Summary
    print(f"{'='*70}")
    print(f"✓ SCRAPING COMPLETE!")
    print(f"{'='*70}")
    print(f"📊 Total records saved: {total_records:,}")
    print(f"💾 File: {filename}")
    print(f"📁 Size: {len(csv_data):,} rows × {len(csv_data[0])} columns")
    print(f"{'='*70}\n")

def convert_nepali_to_english(nepali_year, nepali_month, nepali_day):
    """Convert Nepali date to English date"""
    try:
        day_int = int(nepali_day) if str(nepali_day).isdigit() else 1
        
        if HAS_NEPALI_DATETIME:
            # Accurate conversion using nepali-datetime
            nep_date = nepali_date(nepali_year, nepali_month, day_int)
            eng_date = nep_date.to_datetime_date()
            
            return (
                eng_date.year,
                eng_date.month,
                eng_date.day,
                eng_date.strftime('%Y-%m-%d')
            )
        else:
            # Approximate conversion (Nepali calendar starts ~mid-April)
            # This is rough - install nepali-datetime for accuracy
            year_offset = nepali_year - 2000  # Convert BS to AD roughly
            approx_year = year_offset + 1943  # BS 2000 ≈ AD 1943
            
            return (
                approx_year,
                nepali_month,
                day_int,
                f"{approx_year}-{nepali_month:02d}-{day_int:02d}"
            )
    except:
        return ('', '', '', '')

def fetch_month_data(url, headers, year, month, month_val):
    """Fetch data for a single month (runs in parallel)"""
    try:
        payload = {'year': str(year), 'month': month, 'submit': 'Submit'}
        response = requests.post(url, data=payload, headers=headers, timeout=30)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.text, 'lxml')
        tables = soup.find_all('table', {'class': 'table_rate_month'})

        if len(tables) < 2:
            return None

        tola_data = parse_table(tables[0])
        grm_data = parse_table(tables[1])

        if not tola_data and not grm_data:
            return None

        ratio_tola = calculate_perfect_ratio(tola_data)
        ratio_gram = calculate_perfect_ratio(grm_data)

        all_days = set(list(tola_data.keys()) + list(grm_data.keys()))

        return {
            'tola_data': tola_data,
            'grm_data': grm_data,
            'ratio_tola': ratio_tola,
            'ratio_gram': ratio_gram,
            'days': all_days,
            'record_count': len(all_days)
        }

    except Exception as e:
        return None

def parse_table(table):
    """Parse HTML table and extract price data"""
    data = {}
    rows = table.find_all('tr')
    
    for row in rows:
        th = row.find('th')
        tds = row.find_all('td')
        
        if not th or len(tds) < 3:
            continue
            
        day = th.text.strip()
        fine = extract_price(tds[0])
        standard = extract_price(tds[1])
        silver = extract_price(tds[2])
        
        if fine or standard or silver:
            data[day] = {
                'fine': fine,
                'standard': standard,
                'silver': silver
            }
    
    return data

def extract_price(td):
    """Extract price from <b> tag"""
    b_tag = td.find('b')
    if b_tag:
        price = b_tag.text.strip().replace(',', '')
        if price and price != '0':
            return price
    return ''

def calculate_perfect_ratio(data_dict):
    """Calculate average ratio from valid 9999/9950 pairs"""
    ratios = []
    
    for values in data_dict.values():
        fine = values.get('fine', '')
        standard = values.get('standard', '')
        
        if fine and standard:
            try:
                fine_val = float(fine)
                standard_val = float(standard)
                if fine_val > standard_val > 0:
                    ratios.append(fine_val / standard_val)
            except ValueError:
                continue
    
    return round(mean(ratios), 5) if ratios else None

def calculate_ratio(numerator, denominator):
    """Generic ratio calculation"""
    try:
        if numerator and denominator:
            num_val = float(numerator)
            den_val = float(denominator)
            if den_val > 0:
                return round(num_val / den_val, 2)
    except:
        pass
    return ''

def calculate_discount_percentage(fine_price, standard_price):
    """Calculate (fine - standard) / fine × 100"""
    try:
        if fine_price and standard_price:
            fine_val = float(fine_price)
            standard_val = float(standard_price)
            if fine_val > 0:
                return round(((fine_val - standard_val) / fine_val) * 100, 4)
    except:
        pass
    return ''

def calculate_daily_change(current_price, previous_price):
    """Calculate absolute and percentage change from previous day"""
    try:
        if current_price and previous_price:
            curr = float(current_price)
            prev = float(previous_price)
            
            change = curr - prev
            change_pct = (change / prev) * 100 if prev > 0 else 0
            
            return round(change, 2), round(change_pct, 4)
    except:
        pass
    return '', ''

def calculate_quality_score(fine_tola, standard_tola, fine_gram, standard_gram):
    """Score from 1-5 based on data completeness"""
    if fine_tola and standard_tola and fine_gram and standard_gram:
        return 5
    
    score = sum([
        1 if fine_tola else 0,
        1 if standard_tola else 0,
        1 if fine_gram else 0,
        1 if standard_gram else 0
    ])
    
    return max(score, 1)

def get_fallback_value(value_history, year, month, month_list):
    """Get ratio from previous month if current month has none"""
    month_idx = month_list.index(month)
    
    # Look backwards in current year
    for i in range(month_idx - 1, -1, -1):
        key = f"{year}-{month_list[i]}"
        if key in value_history:
            return value_history[key]
    
    # Look at previous year
    prev_year = year - 1
    for i in range(11, -1, -1):
        key = f"{prev_year}-{month_list[i]}"
        if key in value_history:
            return value_history[key]
    
    return None

def process_record(fine_price, standard_price, current_ratio, fallback_ratio, is_tola=True):
    """Calculate ratio, calculated standard price, and margin"""
    
    # Case 1: Both prices exist - calculate actual ratio
    if fine_price and standard_price:
        try:
            fine_val = float(fine_price)
            standard_val = float(standard_price)
            
            if fine_val > standard_val > 0:
                actual_ratio = round(fine_val / standard_val, 5)
                calc_9950 = round(fine_val / actual_ratio, 2)
                margin = round(fine_val - standard_val, 2)
                return (actual_ratio, calc_9950, margin)
        except ValueError:
            pass
    
    # Case 2: Only fine price exists - use ratio to estimate
    if fine_price:
        try:
            fine_val = float(fine_price)
            ratio = current_ratio or fallback_ratio or get_default_ratio(fine_val, is_tola)
            
            calc_9950 = round(fine_val / ratio, 2)
            margin = round(fine_val - calc_9950, 2)
            return ('', calc_9950, margin)
        except ValueError:
            pass
    
    return ('', '', '')

def get_default_ratio(fine_price, is_tola):
    """Default ratios based on price levels"""
    if is_tola:
        if fine_price >= 145000:
            return 1.00476
        elif fine_price >= 130000:
            return 1.00475
        elif fine_price >= 90000:
            return 1.00537
        else:
            return 1.005
    else:
        if fine_price >= 125000:
            return 1.00476
        elif fine_price >= 110000:
            return 1.00478
        elif fine_price >= 80000:
            return 1.00538
        else:
            return 1.005

if __name__ == "__main__":
    start_time = time.time()
    
    scrape_nepal_gold_prices()
    
    elapsed = time.time() - start_time
    print(f"⏱️  Execution time: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)\n")
