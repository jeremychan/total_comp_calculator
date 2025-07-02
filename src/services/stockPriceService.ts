interface StockPrice {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: Date;
}

interface HistoricalStockData {
    [date: string]: {
        "1. open": string;
        "2. high": string;
        "3. low": string;
        "4. close": string;
        "5. volume": string;
    };
}

interface StockDataFile {
    "Meta Data": {
        "1. Information": string;
        "2. Symbol": string;
        "3. Last Refreshed": string;
        "4. Time Zone": string;
    };
    "Monthly Time Series": HistoricalStockData;
}

class StockPriceService {
    private cache: Map<string, StockDataFile> = new Map();

    // Map company names to stock symbols and file names
    private getStockSymbol(companyName: string): string {
        const symbolMap: { [key: string]: string } = {
            'Meta': 'META',
            'Apple': 'AAPL',
            'Google': 'GOOGL',
            'Amazon': 'AMZN',
            'Microsoft': 'MSFT',
            'Tesla': 'TSLA',
            'Netflix': 'NFLX',
            'NVIDIA': 'NVDA'
        };
        return symbolMap[companyName] || 'META';
    }

    async loadStockData(symbol: string): Promise<StockDataFile | null> {
        try {
            // Check cache first
            if (this.cache.has(symbol)) {
                return this.cache.get(symbol)!;
            }

            // Load from local file - adjust path for development vs production
            const basePath = process.env.NODE_ENV === 'development' ? '' : (process.env.PUBLIC_URL || '');
            const fetchUrl = `${basePath}/data/${symbol}.json`;

            console.log(`Fetching stock data from: ${fetchUrl}`);
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                console.warn(`No data file found for ${symbol} at ${fetchUrl}, status: ${response.status}`);
                return null;
            }

            const data: StockDataFile = await response.json();
            this.cache.set(symbol, data);
            return data;
        } catch (error) {
            console.error(`Error loading stock data for ${symbol}:`, error);
            return null;
        }
    }

    async fetchStockPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const data = await this.loadStockData(symbol);
            if (!data) {
                // Return fallback price if no data file available
                return this.getFallbackPrice(symbol);
            }

            // Get the most recent price from the data
            const monthlyData = data["Monthly Time Series"];
            const dates = Object.keys(monthlyData).sort().reverse(); // Most recent first

            if (dates.length === 0) {
                return this.getFallbackPrice(symbol);
            }

            const latestDate = dates[0];
            const latestPrice = parseFloat(monthlyData[latestDate]["4. close"]);

            // Calculate change from previous month if available
            let change = 0;
            let changePercent = 0;
            if (dates.length > 1) {
                const previousPrice = parseFloat(monthlyData[dates[1]]["4. close"]);
                change = latestPrice - previousPrice;
                changePercent = (change / previousPrice) * 100;
            }

            return {
                symbol: symbol.toUpperCase(),
                price: latestPrice,
                change,
                changePercent,
                lastUpdated: new Date(latestDate)
            };
        } catch (error) {
            console.error('Error fetching stock price:', error);
            return this.getFallbackPrice(symbol);
        }
    }

    async getHistoricalPrice(symbol: string, year: number, month: number): Promise<number> {
        try {
            const data = await this.loadStockData(symbol);
            if (!data) {
                console.warn(`No historical data available for ${symbol}, returning 0`);
                return 0;
            }

            const monthlyData = data["Monthly Time Series"];

            // Try to find the exact month first
            let targetDate = this.findClosestDate(monthlyData, year, month);

            if (targetDate && monthlyData[targetDate]) {
                return parseFloat(monthlyData[targetDate]["4. close"]);
            }

            console.warn(`No historical price found for ${symbol} at ${year}-${month}, returning 0`);
            return 0;
        } catch (error) {
            console.error(`Error getting historical price for ${symbol}:`, error);
            return 0;
        }
    }

    private findClosestDate(monthlyData: HistoricalStockData, year: number, month: number): string | null {
        const dates = Object.keys(monthlyData);

        // Try exact month first
        const targetMonthStr = month.toString().padStart(2, '0');
        let exactMatch = dates.find(date => {
            const [dateYear, dateMonth] = date.split('-');
            return dateYear === year.toString() && dateMonth === targetMonthStr;
        });

        if (exactMatch) return exactMatch;

        // Try to find the closest date in the same year and month
        const sameYearMonth = dates.filter(date => {
            const [dateYear, dateMonth] = date.split('-');
            return dateYear === year.toString() && dateMonth === targetMonthStr;
        });

        if (sameYearMonth.length > 0) {
            return sameYearMonth.sort().reverse()[0]; // Latest date in that month
        }

        // Try to find closest month in the same year
        const sameYear = dates.filter(date => {
            const [dateYear] = date.split('-');
            return dateYear === year.toString();
        }).sort();

        if (sameYear.length > 0) {
            // Find the closest month
            let closest = sameYear[0];
            let closestDiff = Math.abs(parseInt(sameYear[0].split('-')[1]) - month);

            for (const date of sameYear) {
                const dateMonth = parseInt(date.split('-')[1]);
                const diff = Math.abs(dateMonth - month);
                if (diff < closestDiff) {
                    closest = date;
                    closestDiff = diff;
                }
            }
            return closest;
        }

        return null;
    }

    private getFallbackPrice(symbol: string): StockPrice {
        // Fallback prices for demo purposes (should be reasonably current)
        const fallbackPrices: { [key: string]: { price: number; change: number } } = {
            'META': { price: 738, change: 5.25 },
            'AAPL': { price: 175, change: 2.10 },
            'GOOGL': { price: 140, change: 1.85 },
            'AMZN': { price: 155, change: 3.20 },
            'MSFT': { price: 410, change: 4.75 },
            'TSLA': { price: 240, change: -2.30 },
            'NFLX': { price: 480, change: 6.40 },
            'NVDA': { price: 900, change: 15.20 }
        };

        const fallback = fallbackPrices[symbol] || { price: 0, change: 0 };

        return {
            symbol: symbol.toUpperCase(),
            price: fallback.price,
            change: fallback.change,
            changePercent: fallback.price > 0 ? (fallback.change / fallback.price) * 100 : 0,
            lastUpdated: new Date()
        };
    }

    getPopularSymbols(): string[] {
        return ['META', 'AAPL', 'GOOGL', 'AMZN', 'MSFT', 'TSLA', 'NFLX', 'NVDA'];
    }

    clearCache(): void {
        this.cache.clear();
    }
}

export const stockPriceService = new StockPriceService();
export type { StockPrice }; 