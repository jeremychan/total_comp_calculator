const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ALPHAVANTAGE_API_KEY || (() => {
    console.error('❌ ALPHAVANTAGE_API_KEY environment variable is required');
    console.log('💡 Copy config.env.example to config.env and add your API key');
    console.log('💡 Then run: source config.env && npm run fetch-stock-data');
    process.exit(1);
})();
const BASE_URL = 'https://www.alphavantage.co/query';

// Companies to fetch data for
const COMPANIES = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'GOOGL', name: 'Google' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'NFLX', name: 'Netflix' },
    { symbol: 'NVDA', name: 'NVIDIA' }
];

// Directory to save the JSON files
const OUTPUT_DIR = path.join(__dirname, '../public/data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function fetchStockData(symbol) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${API_KEY}`;

        console.log(`Fetching data for ${symbol}...`);

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);

                    // Check for API errors
                    if (jsonData['Error Message']) {
                        reject(new Error(`API Error for ${symbol}: ${jsonData['Error Message']}`));
                        return;
                    }

                    if (jsonData['Note']) {
                        reject(new Error(`API Rate Limit for ${symbol}: ${jsonData['Note']}`));
                        return;
                    }

                    if (!jsonData['Meta Data'] || !jsonData['Monthly Time Series']) {
                        reject(new Error(`Invalid response structure for ${symbol}`));
                        return;
                    }

                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`JSON parsing failed for ${symbol}: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`HTTP request failed for ${symbol}: ${error.message}`));
        });
    });
}

function saveStockData(symbol, data) {
    const fileName = `${symbol}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    try {
        // Format the data nicely
        const formattedData = JSON.stringify(data, null, 4);
        fs.writeFileSync(filePath, formattedData);
        console.log(`✅ Saved ${symbol} data to ${fileName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to save ${symbol} data: ${error.message}`);
        return false;
    }
}

async function fetchAllStockData() {
    console.log('🚀 Starting stock data fetch for all companies...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const company of COMPANIES) {
        try {
            // Add delay between requests to respect API rate limits (5 requests per minute)
            if (successCount + errorCount > 0) {
                console.log('⏳ Waiting 12 seconds between requests to respect API rate limits...');
                await new Promise(resolve => setTimeout(resolve, 12000));
            }

            const data = await fetchStockData(company.symbol);
            const saved = saveStockData(company.symbol, data);

            if (saved) {
                successCount++;

                // Log some stats about the data
                const monthlyData = data['Monthly Time Series'];
                const dateCount = Object.keys(monthlyData).length;
                const latestDate = Object.keys(monthlyData).sort().reverse()[0];
                const latestPrice = monthlyData[latestDate]['4. close'];

                console.log(`   📊 ${dateCount} months of data, latest: ${latestDate} ($${latestPrice})`);
            } else {
                errorCount++;
            }

        } catch (error) {
            console.error(`❌ Error fetching ${company.symbol}: ${error.message}`);
            errorCount++;
        }

        console.log(); // Empty line for readability
    }

    console.log('📋 Summary:');
    console.log(`   ✅ Successfully fetched: ${successCount} companies`);
    console.log(`   ❌ Failed: ${errorCount} companies`);
    console.log(`   📁 Files saved to: ${OUTPUT_DIR}`);

    if (successCount > 0) {
        console.log('\n🎉 Stock data fetch completed successfully!');
        console.log('💡 You can now use these companies in the calculator with historical data.');
    }
}

// Run the script
if (require.main === module) {
    fetchAllStockData().catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
}

module.exports = { fetchStockData, saveStockData, fetchAllStockData }; 