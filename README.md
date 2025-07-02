# TC Calculator - Total Compensation Calculator

A comprehensive web application for tracking and projecting total compensation packages at tech companies, including base salary, bonuses, and RSU vesting schedules.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Local Development
```bash
# Clone the repository
git clone https://github.com/jeremychan/total_comp_calculator.git
cd total_comp_calculator

# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view in browser.

## 📊 Preconfigured Market Data

### Stock Data Setup (Optional)
To enable historical stock price charts:

1. Get a free API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Copy the example config: `cp config.env.example config.env`
3. Add your API key to `config.env`
4. Fetch stock data: `npm run fetch-stock-data`

### Supported Companies
Pre-configured with data for:
- Apple (AAPL)
- Google (GOOGL) 
- Amazon (AMZN)
- Microsoft (MSFT)
- Tesla (TSLA)
- Netflix (NFLX)
- NVIDIA (NVDA)

## 🔄 Data Management

- **Local storage** - Your data stays private in your browser
- **Share functionality** - Generate URLs to share calculations
- **Read-only mode** - View shared calculations without affecting your data
- **Export/Import** capabilities

---

TC calculator - Your data is stored locally in your browser
