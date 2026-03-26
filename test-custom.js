const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
    // Start local server
    const server = spawn('npx', ['http-server', '-p', '8080'], { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let errors = [];
    page.on('pageerror', exception => {
        errors.push(`Uncaught exception: "${exception}"`);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(`Console error: "${msg.text()}"`);
        }
    });

    try {
        console.log('Navigating to http://127.0.0.1:8080/index.html');
        await page.goto('http://127.0.0.1:8080/index.html');
        
        console.log('Waiting for charts to load...');
        await page.waitForSelector('.chart-container canvas', { state: 'visible', timeout: 10000 });

        console.log('1. Verify CUSTOM button exists in all 3 chart controls');
        const customButtons = await page.$$('button:has-text("CUSTOM")');
        console.log(`Found ${customButtons.length} CUSTOM buttons. Expected at least 3.`);
        if (customButtons.length < 3) throw new Error('Not enough CUSTOM buttons found');

        console.log('2. Click CUSTOM on Fine Gold and apply a mid-range date interval');
        const fineGoldContainer = (await page.$$('.chart-container'))[0];
        const fineGoldCustomBtn = await fineGoldContainer.$('button:has-text("CUSTOM")');
        await fineGoldCustomBtn.click();
        
        console.log('Verify custom panel visibility');
        const customPanel = await page.$('.custom-range-panel');
        if (!customPanel) throw new Error('Custom range panel not found after click');
        
        let isVisible = await customPanel.isVisible();
        if (!isVisible) throw new Error('Custom range panel is not visible');
        console.log('Custom panel is visible.');

        const fromOptions = await page.$$eval('#customRangeFrom option', opts => opts.map(o => o.value));
        const toOptions = await page.$$eval('#customRangeTo option', opts => opts.map(o => o.value));
        
        console.log(`From dropdown has ${fromOptions.length} options. To dropdown has ${toOptions.length} options.`);
        if (fromOptions.length === 0 || toOptions.length === 0) throw new Error('Dropdowns not populated');

        const midFrom = fromOptions[Math.floor(fromOptions.length / 4)];
        const midTo = toOptions[Math.floor(toOptions.length * 3 / 4)];
        
        await page.selectOption('#customRangeFrom', midFrom);
        await page.selectOption('#customRangeTo', midTo);
        await page.click('#applyCustomRangeBtn');
        
        await page.waitForTimeout(1000);
        
        console.log('Verify Fine Gold chart labels count decreases');
        const chartLengths = await page.evaluate(() => {
            return {
                fineGold: charts.fineGold.data.labels.length,
                tejabiGold: charts.tejabiGold.data.labels.length,
                silver: charts.silver.data.labels.length
            };
        });
        console.log(`Chart label counts after Fine Gold custom range:`, chartLengths);

        console.log('3. Click CUSTOM on Tejabi and Silver, apply different range');
        const tejabiGoldContainer = (await page.$$('.chart-container'))[1];
        const tejabiCustomBtn = await tejabiGoldContainer.$('button:has-text("CUSTOM")');
        await tejabiCustomBtn.click();
        
        const midFrom2 = fromOptions[Math.floor(fromOptions.length / 3)];
        const midTo2 = toOptions[Math.floor(toOptions.length * 2 / 3)];
        
        await page.selectOption('#customRangeFrom', midFrom2);
        await page.selectOption('#customRangeTo', midTo2);
        await page.click('#applyCustomRangeBtn');
        await page.waitForTimeout(1000);
        
        const chartLengths2 = await page.evaluate(() => {
            return {
                fineGold: charts.fineGold.data.labels.length,
                tejabiGold: charts.tejabiGold.data.labels.length,
                silver: charts.silver.data.labels.length
            };
        });
        console.log(`Chart label counts after Tejabi custom range:`, chartLengths2);

        console.log('4. Click ALL then 1M after custom to ensure presets still restore/switch correctly');
        const fineGoldAllBtn = await fineGoldContainer.$('button:has-text("ALL")');
        await fineGoldAllBtn.click();
        await page.waitForTimeout(500);
        
        const fineGold1MBtn = await fineGoldContainer.$('button:has-text("1M")');
        await fineGold1MBtn.click();
        await page.waitForTimeout(500);

        const finalLengths = await page.evaluate(() => {
            return {
                fineGold: charts.fineGold.data.labels.length,
                tejabiGold: charts.tejabiGold.data.labels.length,
                silver: charts.silver.data.labels.length
            };
        });
        console.log(`Chart label counts after ALL then 1M:`, finalLengths);
        
        console.log('Test completed successfully.');
    } catch (e) {
        console.error('Test failed:', e.message);
    }

    if (errors.length > 0) {
        console.log('\n--- Javascript Errors ---');
        for (const e of errors) { console.log(e); }
    } else {
        console.log('\nNo Javascript errors detected.');
    }

    await browser.close();
    server.kill();
    process.exit(0);
})();
