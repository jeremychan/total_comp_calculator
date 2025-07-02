# Stock Data System

## Overview

The application now uses local JSON files for stock price data instead of external APIs. This provides:

- **Historical Accuracy**: RSU vesting calculations use actual historical stock prices from vesting dates
- **Reliability**: No dependency on external APIs that may fail or have CORS issues
- **Offline Capability**: Works without internet connection once data is loaded
- **Control**: Data can be updated on your own schedule

## How It Works

### File Structure
```
public/data/
├── META.json
├── AAPL.json
├── GOOGL.json
└── ...
```

### Data Format
Each JSON file contains monthly stock price data:
```json
{
    "Meta Data": {
        "1. Information": "Monthly Prices (open, high, low, close) and Volumes",
        "2. Symbol": "META",
        "3. Last Refreshed": "2025-06-30",
        "4. Time Zone": "US/Eastern"
    },
    "Monthly Time Series": {
        "2025-06-30": {
            "1. open": "644.39",
            "2. high": "747.90",
            "3. low": "644.26",
            "4. close": "738.09",
            "5. volume": "254794159"
        }
    }
}
```

### Historical Compensation Calculation

For accurate RSU vesting calculations, the system:

1. **Looks up historical prices** for each vesting date (e.g., Feb, May, Aug, Nov for Meta)
2. **Uses actual stock prices** from those months for vesting calculations
3. **Falls back to current price** if historical data is unavailable
4. **Calculates quarterly vesting** based on company-specific vesting schedules

### Example: Meta 2024 Compensation

For a Meta grant vesting in 2024, the system will use:
- **February 2024**: $490.13 (actual historical price)
- **May 2024**: $466.83 (actual historical price)  
- **August 2024**: $521.31 (actual historical price)
- **November 2024**: $574.32 (actual historical price)

Instead of assuming all vests happened at current market price.

## Adding New Companies

1. **Get stock symbol** (e.g., TSLA for Tesla)
2. **Create JSON file** at `public/data/TSLA.json`
3. **Add to company mapping** in `stockPriceService.ts` if needed
4. **Update COMPANIES array** in `types/index.ts` with vesting schedule

## Updating Data

### Manual Update
1. Download monthly price data from your preferred source
2. Convert to the required JSON format
3. Replace the existing file in `public/data/`

### Automated Pipeline (Recommended)
Set up a monthly cron job or GitHub Action to:
1. Fetch latest monthly data from Alpha Vantage, Yahoo Finance, etc.
2. Convert to required format
3. Update the JSON files
4. Deploy to your hosting platform

## Fallback Behavior

If a company's data file is missing or doesn't contain the required date:
- **Stock price defaults to 0** (user must enter manually)
- **Historical calculations fall back** to current stock price
- **Warning shown** in UI indicating manual input required

## Benefits

- **Accurate historical compensation**: Shows what RSUs were actually worth when they vested
- **No API rate limits**: Works offline and doesn't depend on external services
- **Customizable**: Add any company by providing historical data
- **Fast**: Local file access is faster than API calls
- **Reliable**: No network failures or CORS issues 