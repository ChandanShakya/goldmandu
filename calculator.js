/**
 * Goldmandu Calculator Module
 * ===========================
 * Comprehensive calculator for gold and silver prices
 * Includes: unit conversions, purity calculations, investment tools
 */

// Constants
const GRAM_PER_TOLA = 11.66;
const KARAT_PURITY = {
    '24K': 0.999,
    '22K': 0.916,
    '18K': 0.750,
    '14K': 0.585,
    '10K': 0.417
};

// Current prices (will be loaded from Values.json)
let currentPrices = {
    fine_gold_tola: 0,
    fine_gold_gram: 0,
    tejabi_gold_tola: 0,
    tejabi_gold_gram: 0,
    silver_tola: 0,
    silver_gram: 0
};

/**
 * Load current prices from Values.json
 */
async function loadCurrentPrices() {
    try {
        const response = await fetch('Values.json');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            const latest = data[data.length - 1];
            currentPrices = {
                fine_gold_tola: parseFloat(latest.fine_gold_tola) || 0,
                fine_gold_gram: parseFloat(latest.fine_gold_gram) || 0,
                tejabi_gold_tola: parseFloat(latest.tejabi_gold_tola) || 0,
                tejabi_gold_gram: parseFloat(latest.tejabi_gold_gram) || 0,
                silver_tola: parseFloat(latest.silver_tola) || 0,
                silver_gram: parseFloat(latest.silver_gram) || 0
            };
        }
    } catch (error) {
        console.error('Error loading prices:', error);
    }
}

// ============================================
// 1. UNIT CONVERSION FUNCTIONS
// ============================================

/**
 * Convert grams to tola
 * @param {number} grams - Weight in grams
 * @returns {number} Weight in tola
 */
function gramsToTola(grams) {
    return grams / GRAM_PER_TOLA;
}

/**
 * Convert tola to grams
 * @param {number} tola - Weight in tola
 * @returns {number} Weight in grams
 */
function tolaToGrams(tola) {
    return tola * GRAM_PER_TOLA;
}

/**
 * Convert price per gram to price per tola
 * @param {number} pricePerGram - Price per gram
 * @returns {number} Price per tola
 */
function pricePerGramToTola(pricePerGram) {
    return pricePerGram * GRAM_PER_TOLA;
}

/**
 * Convert price per tola to price per gram
 * @param {number} pricePerTola - Price per tola
 * @returns {number} Price per gram
 */
function pricePerTolaToGram(pricePerTola) {
    return pricePerTola / GRAM_PER_TOLA;
}

// ============================================
// 2. PRICE CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate total price for given weight
 * @param {number} weight - Weight of metal
 * @param {number} pricePerUnit - Price per unit (gram or tola)
 * @param {string} unit - 'gram' or 'tola'
 * @returns {object} Price breakdown
 */
function calculateTotalPrice(weight, pricePerUnit, unit = 'tola') {
    const totalPrice = weight * pricePerUnit;
    
    // Convert to other unit for reference
    let weightInGrams, weightInTola;
    if (unit === 'gram') {
        weightInGrams = weight;
        weightInTola = gramsToTola(weight);
    } else {
        weightInTola = weight;
        weightInGrams = tolaToGrams(weight);
    }
    
    return {
        totalPrice: Math.round(totalPrice),
        weightInGrams: weightInGrams.toFixed(2),
        weightInTola: weightInTola.toFixed(2),
        pricePerGram: unit === 'gram' ? pricePerUnit : pricePerTolaToGram(pricePerUnit),
        pricePerTola: unit === 'tola' ? pricePerUnit : pricePerGramToTola(pricePerUnit)
    };
}

/**
 * Calculate price for jewelry with making charges
 * @param {number} goldWeight - Weight of gold in tola
 * @param {number} goldPricePerTola - Current gold price per tola
 * @param {number} makingChargePerTola - Making charge per tola
 * @param {number} wastagePercent - Wastage percentage
 * @returns {object} Detailed price breakdown
 */
function calculateJewelryPrice(goldWeight, goldPricePerTola, makingChargePerTola = 1000, wastagePercent = 8) {
    const goldValue = goldWeight * goldPricePerTola;
    const makingCharges = goldWeight * makingChargePerTola;
    const wastageCharges = goldValue * (wastagePercent / 100);
    const totalPrice = goldValue + makingCharges + wastageCharges;
    
    return {
        goldWeight: goldWeight.toFixed(3),
        goldValue: Math.round(goldValue),
        makingCharges: Math.round(makingCharges),
        wastageCharges: Math.round(wastageCharges),
        wastagePercent: wastagePercent,
        totalPrice: Math.round(totalPrice),
        pricePerTolaWithCharges: Math.round(totalPrice / goldWeight)
    };
}

// ============================================
// 3. PURITY/KARAT CONVERSION FUNCTIONS
// ============================================

/**
 * Convert gold price between different karats
 * @param {number} price - Price at source karat
 * @param {string} fromKarat - Source karat (e.g., '24K')
 * @param {string} toKarat - Target karat (e.g., '22K')
 * @returns {number} Converted price
 */
function convertKaratPrice(price, fromKarat, toKarat) {
    const fromPurity = KARAT_PURITY[fromKarat];
    const toPurity = KARAT_PURITY[toKarat];
    
    if (!fromPurity || !toPurity) {
        throw new Error('Invalid karat specified');
    }
    
    // Convert to pure gold value, then to target karat
    const pureGoldValue = price / fromPurity;
    return Math.round(pureGoldValue * toPurity);
}

/**
 * Get price for any karat based on 24K price
 * @param {number} price24K - Price of 24K gold
 * @param {string} targetKarat - Target karat
 * @returns {number} Price for target karat
 */
function getPriceForKarat(price24K, targetKarat) {
    const purity = KARAT_PURITY[targetKarat];
    if (!purity) {
        throw new Error('Invalid karat');
    }
    return Math.round(price24K * purity);
}

/**
 * Get all karat prices based on 24K price
 * @param {number} price24K - Price of 24K gold per tola
 * @returns {object} Prices for all karats
 */
function getAllKaratPrices(price24K) {
    const prices = {};
    for (const [karat, purity] of Object.entries(KARAT_PURITY)) {
        prices[karat] = {
            purity: (purity * 100).toFixed(1) + '%',
            pricePerTola: Math.round(price24K * purity),
            pricePerGram: Math.round((price24K * purity) / GRAM_PER_TOLA)
        };
    }
    return prices;
}

// ============================================
// 4. BUY/SELL CALCULATIONS
// ============================================

/**
 * Calculate selling price (what you'll get when selling gold)
 * @param {number} goldWeight - Weight in tola
 * @param {number} buyBackRate - Buy-back rate as % of market price (typically 95-98%)
 * @param {string} goldType - 'fine' or 'tejabi'
 * @returns {object} Selling price breakdown
 */
function calculateSellingPrice(goldWeight, buyBackRate = 97, goldType = 'fine') {
    const pricePerTola = goldType === 'fine' ? currentPrices.fine_gold_tola : currentPrices.tejabi_gold_tola;
    const marketValue = goldWeight * pricePerTola;
    const sellingPrice = marketValue * (buyBackRate / 100);
    
    return {
        goldWeight: goldWeight.toFixed(3),
        marketValue: Math.round(marketValue),
        buyBackRate: buyBackRate,
        deduction: Math.round(marketValue - sellingPrice),
        sellingPrice: Math.round(sellingPrice),
        pricePerTolaReceived: Math.round(sellingPrice / goldWeight)
    };
}

/**
 * Calculate exchange value when exchanging old gold for new
 * @param {number} oldGoldWeight - Weight of old gold in tola
 * @param {number} oldGoldKarat - Karat of old gold
 * @param {number} newGoldPrice - Price of new gold per tola
 * @param {number} exchangeRate - Exchange rate as % (typically 90-95%)
 * @returns {object} Exchange calculation
 */
function calculateExchangeValue(oldGoldWeight, oldGoldKarat = '22K', newGoldPrice, exchangeRate = 93) {
    // Convert old gold to 24K equivalent
    const oldPurity = KARAT_PURITY[oldGoldKarat];
    const pureGoldEquivalent = oldGoldWeight * oldPurity;
    
    // Calculate exchange value
    const marketValue = pureGoldEquivalent * currentPrices.fine_gold_tola;
    const exchangeValue = marketValue * (exchangeRate / 100);
    
    // How much new gold can be bought
    const newGoldWeight = exchangeValue / newGoldPrice;
    
    return {
        oldGoldWeight: oldGoldWeight.toFixed(3),
        oldGoldKarat: oldGoldKarat,
        pureGoldEquivalent: pureGoldEquivalent.toFixed(3),
        marketValue: Math.round(marketValue),
        exchangeRate: exchangeRate,
        exchangeValue: Math.round(exchangeValue),
        newGoldCanBuy: newGoldWeight.toFixed(3)
    };
}

// ============================================
// 5. INVESTMENT CALCULATIONS
// ============================================

/**
 * Calculate future value of gold investment
 * @param {number} initialInvestment - Initial investment amount
 * @param {number} monthlyInvestment - Monthly SIP amount
 * @param {number} years - Investment period in years
 * @param {number} expectedReturn - Expected annual return %
 * @returns {object} Investment projection
 */
function calculateGoldInvestment(initialInvestment, monthlyInvestment, years, expectedReturn = 8) {
    const months = years * 12;
    const monthlyRate = expectedReturn / 100 / 12;
    
    // Future value of initial investment
    const fvInitial = initialInvestment * Math.pow(1 + monthlyRate, months);
    
    // Future value of monthly SIP
    const fvSIP = monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    
    const totalValue = fvInitial + fvSIP;
    const totalInvested = initialInvestment + (monthlyInvestment * months);
    const profit = totalValue - totalInvested;
    
    // Calculate gold that can be bought at current price
    const goldCanBuy = totalValue / currentPrices.fine_gold_tola;
    
    return {
        years: years,
        totalInvested: Math.round(totalInvested),
        totalValue: Math.round(totalValue),
        profit: Math.round(profit),
        returnPercent: ((profit / totalInvested) * 100).toFixed(2),
        goldCanBuyTola: goldCanBuy.toFixed(3),
        goldCanBuyGram: tolaToGrams(goldCanBuy).toFixed(2)
    };
}

/**
 * Compare gold investment with other options
 * @param {number} amount - Investment amount
 * @param {number} years - Investment period
 * @returns {object} Comparison of different investments
 */
function compareInvestments(amount, years) {
    const goldReturn = 8; // Historical gold return ~8%
    const fixedDepositReturn = 6; // Typical FD return
    const stockReturn = 12; // Average stock market return
    
    const calculateFV = (principal, rate, time) => {
        return principal * Math.pow(1 + rate / 100, time);
    };
    
    return {
        gold: {
            name: 'Gold',
            rate: goldReturn,
            futureValue: Math.round(calculateFV(amount, goldReturn, years)),
            goldCanBuy: (calculateFV(amount, goldReturn, years) / currentPrices.fine_gold_tola).toFixed(3) + ' tola'
        },
        fixedDeposit: {
            name: 'Fixed Deposit',
            rate: fixedDepositReturn,
            futureValue: Math.round(calculateFV(amount, fixedDepositReturn, years))
        },
        stocks: {
            name: 'Stock Market',
            rate: stockReturn,
            futureValue: Math.round(calculateFV(amount, stockReturn, years))
        }
    };
}

// ============================================
// 6. HISTORICAL COMPARISON FUNCTIONS
// ============================================

/**
 * Calculate profit/loss on past gold purchase
 * @param {number} purchasePrice - Price paid per tola
 * @param {number} weight - Weight purchased in tola
 * @param {string} purchaseDate - Date of purchase
 * @returns {object} Profit/loss calculation
 */
function calculateProfitLoss(purchasePrice, weight, purchaseDate) {
    const currentPrice = currentPrices.fine_gold_tola;
    const purchaseValue = purchasePrice * weight;
    const currentValue = currentPrice * weight;
    const profitLoss = currentValue - purchaseValue;
    const profitLossPercent = ((profitLoss / purchaseValue) * 100).toFixed(2);
    
    return {
        purchaseDate: purchaseDate,
        weight: weight.toFixed(3),
        purchasePricePerTola: purchasePrice,
        currentPricePerTola: currentPrice,
        purchaseValue: Math.round(purchaseValue),
        currentValue: Math.round(currentValue),
        profitLoss: Math.round(profitLoss),
        profitLossPercent: profitLossPercent,
        isProfit: profitLoss >= 0
    };
}

/**
 * Get price trend analysis
 * @param {array} historicalData - Array of historical prices from Values.json
 * @returns {object} Trend analysis
 */
function analyzePriceTrend(historicalData) {
    if (!Array.isArray(historicalData) || historicalData.length < 2) {
        return { error: 'Insufficient data for analysis' };
    }
    
    const prices = historicalData.map(d => parseFloat(d.fine_gold_tola)).filter(Number.isFinite);
    const dates = historicalData.map(d => `${d.day} ${d.month} ${d.year}`);
    
    if (prices.length === 0) return { error: 'No valid price data' };
    
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];
    const firstPrice = prices[0];
    
    // Calculate changes
    const dailyChange = currentPrice - previousPrice;
    const dailyChangePercent = ((dailyChange / previousPrice) * 100).toFixed(2);
    
    const totalChange = currentPrice - firstPrice;
    const totalChangePercent = ((totalChange / firstPrice) * 100).toFixed(2);
    
    // Find highest and lowest
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    
    return {
        currentPrice: currentPrice,
        previousPrice: previousPrice,
        dailyChange: Math.round(dailyChange),
        dailyChangePercent: dailyChangePercent,
        totalChange: Math.round(totalChange),
        totalChangePercent: totalChangePercent,
        highestPrice: highestPrice,
        lowestPrice: lowestPrice,
        dataPoints: prices.length,
        isUp: dailyChange >= 0
    };
}

// ============================================
// 7. CURRENCY CONVERSION FUNCTIONS
// ============================================

/**
 * Convert NPR to other currencies
 * @param {number} nprAmount - Amount in NPR
 * @param {string} targetCurrency - Target currency code
 * @returns {number} Converted amount
 */
function convertFromNPR(nprAmount, targetCurrency) {
    // Approximate rates (should be updated from API in production)
    const rates = {
        'USD': 0.0075,  // 1 NPR = 0.0075 USD
        'INR': 0.625,   // 1 NPR = 0.625 INR
        'EUR': 0.0069,
        'GBP': 0.0059,
        'AUD': 0.0115,
        'CAD': 0.0102
    };
    
    const rate = rates[targetCurrency];
    if (!rate) {
        throw new Error('Currency not supported');
    }
    
    return (nprAmount * rate).toFixed(2);
}

/**
 * Convert international gold price to NPR
 * @param {number} usdPerOunce - Gold price in USD per ounce
 * @returns {object} Converted prices
 */
function convertInternationalGoldPrice(usdPerOunce) {
    const USD_TO_NPR = 133.5; // Approximate rate
    const GRAMS_PER_OUNCE = 31.1035;
    
    const nprPerOunce = usdPerOunce * USD_TO_NPR;
    const nprPerGram = nprPerOunce / GRAMS_PER_OUNCE;
    const nprPerTola = nprPerGram * GRAM_PER_TOLA;
    
    return {
        usdPerOunce: usdPerOunce,
        nprPerOunce: Math.round(nprPerOunce),
        nprPerGram: Math.round(nprPerGram),
        nprPerTola: Math.round(nprPerTola),
        nprPer10Gram: Math.round(nprPerGram * 10)
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format number as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (!Number.isFinite(amount)) return 'N/A';
    const s = Math.round(amount).toString();
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    return 'Rs. ' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}

/**
 * Format weight with unit
 * @param {number} weight - Weight value
 * @param {string} unit - 'gram' or 'tola'
 * @returns {string} Formatted weight string
 */
function formatWeight(weight, unit) {
    return weight.toFixed(3) + ' ' + unit;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        gramsToTola,
        tolaToGrams,
        calculateTotalPrice,
        calculateJewelryPrice,
        convertKaratPrice,
        getAllKaratPrices,
        calculateSellingPrice,
        calculateExchangeValue,
        calculateGoldInvestment,
        compareInvestments,
        calculateProfitLoss,
        analyzePriceTrend,
        convertFromNPR,
        convertInternationalGoldPrice,
        formatCurrency,
        formatWeight,
        loadCurrentPrices,
        currentPrices,
        KARAT_PURITY,
        GRAM_PER_TOLA
    };
}
