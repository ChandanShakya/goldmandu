// ============================================
// Dark mode toggle
// ============================================
const darkModeButton = document.getElementById('dark-mode-btn');
const darkModeIcon = document.getElementById('dark-mode-icon');
const dateElement = document.querySelector('.date');

function toggleDarkModeIcon() {
    if (darkModeIcon.getAttribute('src') === 'assets/images/moon.png') {
        darkModeIcon.setAttribute('src', 'assets/images/sun.png');
    } else {
        darkModeIcon.setAttribute('src', 'assets/images/moon.png');
    }
}

darkModeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    toggleDarkModeIcon();
});

// ============================================
// Helpers
// ============================================

/** Safely parse a price string. Returns null for "0", NaN, or missing. */
function safePrice(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Format a number as South Asian NPR string (e.g. Rs. 1,87,600) */
function formatNPR(n) {
    if (!Number.isFinite(n)) return 'N/A';
    const s = Math.round(n).toString();
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    return 'Rs. ' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}

// ============================================
// Insights computation
// ============================================

function computeInsights(data) {
    const valid = data.filter(r => safePrice(r.fine_gold_tola) !== null);
    if (valid.length < 2) return null;

    const latest = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    const todayPrice = safePrice(latest.fine_gold_tola);
    const prevPrice = safePrice(prev.fine_gold_tola);
    const change = (todayPrice !== null && prevPrice !== null) ? todayPrice - prevPrice : null;
    const changePct = (change !== null && prevPrice) ? ((change / prevPrice) * 100).toFixed(2) : null;

    // 7-day MA
    const last7 = valid.slice(-7).map(r => safePrice(r.fine_gold_tola)).filter(v => v !== null);
    const ma7 = last7.length >= 3 ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : null;

    // Monthly range
    const monthRecords = valid.filter(r => r.month === latest.month && r.year === latest.year);
    const monthPrices = monthRecords.map(r => safePrice(r.fine_gold_tola)).filter(v => v !== null);
    const monthHigh = monthPrices.length ? Math.max(...monthPrices) : null;
    const monthLow = monthPrices.length ? Math.min(...monthPrices) : null;

    // Gold/Silver ratio
    const silverPrice = safePrice(latest.silver_tola);
    const ratio = (todayPrice !== null && silverPrice !== null) ? (todayPrice / silverPrice).toFixed(1) : null;

    return { todayPrice, prevPrice, change, changePct, ma7, monthHigh, monthLow, ratio, latest };
}

function renderInsights(insights) {
    if (!insights) return;

    const { change, changePct, ma7, monthHigh, monthLow, ratio } = insights;

    const changeEl = document.getElementById('insight-change');
    const changeCard = document.getElementById('insight-change-card');
    if (changeEl) {
        if (change !== null) {
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${formatNPR(change)} (${sign}${changePct}%)`;
            changeCard.classList.toggle('positive', change >= 0);
            changeCard.classList.toggle('negative', change < 0);
        } else {
            changeEl.textContent = 'N/A';
        }
    }

    const ma7El = document.getElementById('insight-ma7');
    if (ma7El) ma7El.textContent = ma7 !== null ? formatNPR(ma7) : 'N/A';

    const highEl = document.getElementById('insight-month-high');
    if (highEl) highEl.textContent = monthHigh !== null ? formatNPR(monthHigh) : 'N/A';

    const lowEl = document.getElementById('insight-month-low');
    if (lowEl) lowEl.textContent = monthLow !== null ? formatNPR(monthLow) : 'N/A';

    const ratioEl = document.getElementById('insight-ratio');
    if (ratioEl) ratioEl.textContent = ratio !== null ? `${ratio} : 1` : 'N/A';
}

// ============================================
// Chart range filtering
// ============================================

let allChartData = null; // Will hold { labels, fineGold, tejabiGold, silver }
const charts = {}; // Will hold { fineGold: Chart, tejabiGold: Chart, silver: Chart }
const activeRanges = { fineGold: 'ALL', tejabiGold: 'ALL', silver: 'ALL' };

const customRangeElements = {
    fineGold: {
        wrapper: 'fineGoldCustomControls',
        from: 'fineGoldRangeFrom',
        to: 'fineGoldRangeTo',
        apply: 'fineGoldApplyBtn'
    },
    tejabiGold: {
        wrapper: 'tejabiGoldCustomControls',
        from: 'tejabiGoldRangeFrom',
        to: 'tejabiGoldRangeTo',
        apply: 'tejabiGoldApplyBtn'
    },
    silver: {
        wrapper: 'silverCustomControls',
        from: 'silverRangeFrom',
        to: 'silverRangeTo',
        apply: 'silverApplyBtn'
    }
};

function getDataForChart(chartKey, filtered) {
    if (!filtered) return [];
    if (chartKey === 'fineGold') return filtered.fineGold;
    if (chartKey === 'tejabiGold') return filtered.tejabiGold;
    if (chartKey === 'silver') return filtered.silver;
    return [];
}

function filterByCustomRange(fromLabel, toLabel) {
    if (!allChartData) return null;
    const { labels, fineGold, tejabiGold, silver } = allChartData;
    const fromIdx = labels.indexOf(fromLabel);
    const toIdx = labels.indexOf(toLabel);

    if (fromIdx < 0 || toIdx < 0) return null;
    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);

    return {
        labels: labels.slice(start, end + 1),
        fineGold: fineGold.slice(start, end + 1),
        tejabiGold: tejabiGold.slice(start, end + 1),
        silver: silver.slice(start, end + 1)
    };
}

function filterByRange(range) {
    if (!allChartData) return allChartData;
    const { labels, fineGold, tejabiGold, silver } = allChartData;
    const total = labels.length;

    let sliceFrom = 0;
    if (range === '1M') sliceFrom = Math.max(0, total - 30);
    else if (range === '6M') sliceFrom = Math.max(0, total - 182);
    else if (range === '1Y') sliceFrom = Math.max(0, total - 365);

    return {
        labels: labels.slice(sliceFrom),
        fineGold: fineGold.slice(sliceFrom),
        tejabiGold: tejabiGold.slice(sliceFrom),
        silver: silver.slice(sliceFrom)
    };
}

function updateChartRange(chartKey, range) {
    const chart = charts[chartKey];
    if (!chart || !allChartData) return;

    activeRanges[chartKey] = range;

    if (range === 'CUSTOM') {
        showCustomRangeControls(chartKey);
        applyCustomRange(chartKey);
        return;
    }

    const filtered = filterByRange(range);
    chart.data.labels = filtered.labels;
    chart.data.datasets[0].data = getDataForChart(chartKey, filtered);
    chart.update('none');
}

function buildCustomRangeSelectors() {
    if (!allChartData) return;

    const descLabels = [...allChartData.labels].reverse();
    const optionsHtml = descLabels
        .map(label => `<option value="${label}">${label}</option>`)
        .join('');

    Object.values(customRangeElements).forEach(ids => {
        const fromEl = document.getElementById(ids.from);
        const toEl = document.getElementById(ids.to);
        if (!fromEl || !toEl) return;

        fromEl.innerHTML = optionsHtml;
        toEl.innerHTML = optionsHtml;

        fromEl.selectedIndex = descLabels.length - 1;
        toEl.selectedIndex = 0;
    });
}

function showCustomRangeControls(chartKey) {
    const ids = customRangeElements[chartKey];
    if (!ids) return;
    const wrapper = document.getElementById(ids.wrapper);
    if (wrapper) wrapper.hidden = false;
}

function hideCustomRangeControlsIfUnused(chartKey = null) {
    if (chartKey) {
        const ids = customRangeElements[chartKey];
        if (!ids) return;
        const wrapper = document.getElementById(ids.wrapper);
        if (wrapper) wrapper.hidden = activeRanges[chartKey] !== 'CUSTOM';
        return;
    }

    Object.entries(customRangeElements).forEach(([key, ids]) => {
        const wrapper = document.getElementById(ids.wrapper);
        if (wrapper) wrapper.hidden = activeRanges[key] !== 'CUSTOM';
    });
}

function applyCustomRange(targetChartKey = null) {
    if (!allChartData) return;

    const keys = targetChartKey ? [targetChartKey] : Object.keys(charts);
    keys.forEach(chartKey => {
        const ids = customRangeElements[chartKey];
        if (!ids) return;
        const fromEl = document.getElementById(ids.from);
        const toEl = document.getElementById(ids.to);
        const chart = charts[chartKey];
        if (!fromEl || !toEl || !chart) return;

        const filtered = filterByCustomRange(fromEl.value, toEl.value);
        if (!filtered || filtered.labels.length === 0) return;

        chart.data.labels = filtered.labels;
        chart.data.datasets[0].data = getDataForChart(chartKey, filtered);
        chart.update('none');
    });
}

// Wire up range buttons after DOM load
function setupRangeButtons() {
    document.querySelectorAll('.chart-range-btn[data-range]').forEach(btn => {
        btn.addEventListener('click', () => {
            const chartKey = btn.dataset.chart;
            const range = btn.dataset.range;

            const group = btn.closest('.chart-controls');
            group.querySelectorAll('.chart-range-btn').forEach(b => { b.classList.remove('active'); });
            btn.classList.add('active');

            updateChartRange(chartKey, range);
            if (range !== 'CUSTOM') hideCustomRangeControlsIfUnused(chartKey);
        });
    });

    Object.entries(customRangeElements).forEach(([chartKey, ids]) => {
        const applyBtn = document.getElementById(ids.apply);
        if (!applyBtn) return;
        applyBtn.addEventListener('click', () => applyCustomRange(chartKey));
    });
}

// ============================================
// Chart creation
// ============================================

function makeChartOptions() {
    return {
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            decimation: { enabled: true, algorithm: 'lttb', samples: 500 },
            legend: { display: true },
            tooltip: { mode: 'nearest', intersect: false }
        },
        scales: {
            x: {
                ticks: { maxTicksLimit: 12, autoSkip: true },
                title: { display: true, text: 'Date (BS)' }
            },
            y: {
                beginAtZero: false,
                title: { display: true, text: 'Price (NPR)' }
            }
        },
        elements: { point: { radius: 0 } },
        spanGaps: true
    };
}

function createCharts(labels, fineGoldPrices, tejabiGoldPrices, silverPrices) {
    const fineGoldCtx = document.getElementById('fineGoldChart')?.getContext('2d');
    const tejabiGoldCtx = document.getElementById('tejabiGoldChart')?.getContext('2d');
    const silverCtx = document.getElementById('silverChart')?.getContext('2d');

    if (fineGoldCtx) {
        charts.fineGold = new Chart(fineGoldCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Fine Gold (per Tola)',
                    data: fineGoldPrices,
                    borderColor: 'rgba(255, 215, 0, 1)',
                    backgroundColor: 'rgba(255, 215, 0, 0.15)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: makeChartOptions()
        });
    }

    if (tejabiGoldCtx) {
        charts.tejabiGold = new Chart(tejabiGoldCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Tejabi Gold (per Tola)',
                    data: tejabiGoldPrices,
                    borderColor: 'rgba(218, 165, 32, 1)',
                    backgroundColor: 'rgba(218, 165, 32, 0.15)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: makeChartOptions()
        });
    }

    if (silverCtx) {
        charts.silver = new Chart(silverCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Silver (per Tola)',
                    data: silverPrices,
                    borderColor: 'rgba(192, 192, 192, 1)',
                    backgroundColor: 'rgba(192, 192, 192, 0.15)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: makeChartOptions()
        });
    }
}

// ============================================
// Data loading
// ============================================

function setError(msg) {
    dateElement.textContent = msg;
    ['fine-gold-tola','fine-gold-gram','tejabi-gold-tola','tejabi-gold-gram','silver-tola','silver-gram'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'N/A';
    });
}

fetch('Values.json')
    .then(response => {
        if (!response.ok) {
            if (response.status === 404) return Promise.reject('Values.json not found');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Try JSON directly — don't rely on content-type header (unreliable on static hosts)
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            setError('Price data not available.');
            return;
        }

        // Find latest record with valid fine gold price
        let latestIdx = data.length - 1;
        while (latestIdx >= 0 && safePrice(data[latestIdx].fine_gold_tola) === null) latestIdx--;
        const latestData = latestIdx >= 0 ? data[latestIdx] : data[data.length - 1];

        const { day, month, year } = latestData;
        dateElement.textContent = `Gold price on ${day} ${month} ${year}`;

        // Price cards
        const fgt = safePrice(latestData.fine_gold_tola);
        const fgg = safePrice(latestData.fine_gold_gram);
        const tgt = safePrice(latestData.tejabi_gold_tola);
        const tgg = safePrice(latestData.tejabi_gold_gram);
        const st  = safePrice(latestData.silver_tola);
        const sg  = safePrice(latestData.silver_gram);

        const set = (id, label, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${label}: ${val !== null ? formatNPR(val) : 'N/A'}`;
        };
        set('fine-gold-tola', 'Per Tola', fgt);
        set('fine-gold-gram', 'Per 10 Gram', fgg);
        set('tejabi-gold-tola', 'Per Tola', tgt);
        set('tejabi-gold-gram', 'Per 10 Gram', tgg);
        set('silver-tola', 'Per Tola', st);
        set('silver-gram', 'Per 10 Gram', sg);

        // Insights
        const insights = computeInsights(data);
        renderInsights(insights);

        // Build chart data arrays
        const labels = [];
        const fineGoldPrices = [];
        const tejabiGoldPrices = [];
        const silverPrices = [];

        data.forEach(record => {
            labels.push(`${record.day} ${record.month} ${record.year}`);
            fineGoldPrices.push(safePrice(record.fine_gold_tola));
            tejabiGoldPrices.push(safePrice(record.tejabi_gold_tola));
            silverPrices.push(safePrice(record.silver_tola));
        });

        // Store globally for range filtering
        allChartData = { labels, fineGold: fineGoldPrices, tejabiGold: tejabiGoldPrices, silver: silverPrices };
        buildCustomRangeSelectors();

        createCharts(labels, fineGoldPrices, tejabiGoldPrices, silverPrices);
        setupRangeButtons();
    })
    .catch(error => {
        console.error('Error fetching or processing price data:', error);
        setError('Error loading price data.');
    });
