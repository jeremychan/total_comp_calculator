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

### Firebase Sync Setup (Optional)
To enable cross-device sync with Google sign-in:

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication with Google provider
3. Create a Firestore database
4. Copy `firebase.config.example.js` to `src/services/firebaseConfig.ts`
5. Replace the placeholder values with your Firebase project settings
6. The app will automatically enable sync features when Firebase is configured

Without Firebase setup, the app works normally with local browser storage only.

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

- **Local storage** - Your data stays private in your browser by default
- **Cross-device sync** - Sign in with Google to sync data across all your devices (optional)
- **Share functionality** - Generate URLs to share calculations with others
- **Read-only mode** - View shared calculations without affecting your data
- **Export/Import** capabilities - Import data from share URLs or base64 data

---

TC calculator - Your data is stored locally in your browser
