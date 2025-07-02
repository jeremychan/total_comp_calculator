# TC Calculator - Total Compensation Calculator

A comprehensive web application for tracking and projecting total compensation packages at tech companies, including base salary, bonuses, and RSU vesting schedules.

![TC Calculator](https://img.shields.io/badge/Tech-React_TypeScript-blue) ![Deployment](https://img.shields.io/badge/Deployment-GitHub_Pages-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Live Demo

**[Try it now: jeremychan.github.io/total_comp_calculator](https://jeremychan.github.io/total_comp_calculator)**

## ✨ Features

### 📊 **Comprehensive Compensation Tracking**
- **Base Salary** configuration with year-over-year changes
- **Bonus** calculations with performance multipliers
- **RSU Grants** with flexible vesting schedules
- **Multi-currency support** with real-time exchange rates

### 📈 **Advanced Projections**
- **7-year compensation projections** with visual charts
- **Current year summary** with detailed breakdowns
- **Peak year identification** and total compensation over period
- **Mobile-responsive** charts with desktop/mobile optimizations

### 💼 **Major Tech Companies**
Pre-configured with data for:
- Apple (AAPL)
- Google (GOOGL) 
- Amazon (AMZN)
- Microsoft (MSFT)
- Tesla (TSLA)
- Netflix (NFLX)
- NVIDIA (NVDA)

### 🔄 **Data Management**
- **Local storage** - Your data stays private in your browser
- **Share functionality** - Generate URLs to share calculations
- **Read-only mode** - View shared calculations without affecting your data
- **Export/Import** capabilities

### 📱 **Modern UI/UX**
- **Collapsible sections** for organized navigation
- **Professional design** with clean, intuitive interface
- **Mobile-first** responsive design
- **Real-time calculations** as you type

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript
- **UI Framework**: React Bootstrap 5
- **Charts**: Recharts
- **Styling**: Bootstrap 5 + Custom CSS
- **Build Tool**: Create React App
- **Deployment**: GitHub Pages with GitHub Actions

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

### Stock Data Setup (Optional)
To enable historical stock price charts:

1. Get a free API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Copy the example config: `cp config.env.example config.env`
3. Add your API key to `config.env`
4. Fetch stock data: `npm run fetch-stock-data`

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run test suite |
| `npm run deploy` | Deploy to GitHub Pages |
| `npm run fetch-stock-data` | Update stock price data |

## 🔧 Configuration

### Supported Currencies
- USD, EUR, GBP, CAD, AUD, CHF, SEK, NOK, DKK, PLN

### Vesting Schedules
- **25/25/25/25** - Standard 4-year equal vesting
- **10/20/30/40** - Back-loaded vesting  
- **5/15/40/40** - Cliff + back-loaded
- **Custom** - Define your own schedule

### Company Presets
Each company includes:
- Default vesting schedules
- Typical salary ranges
- Historical stock data
- Bonus structures

## 📊 How It Works

1. **Configure** your compensation package:
   - Select company and currencies
   - Set base salary progression
   - Configure bonus percentages
   - Add RSU grants with vesting schedules

2. **View projections** across 7 years:
   - Stacked bar charts show compensation breakdown
   - Summary statistics highlight key metrics
   - Interactive tooltips provide detailed information

3. **Analyze stock performance**:
   - Historical price charts with grant event markers
   - Vesting event visualization
   - Impact of stock price on total compensation

4. **Share results**:
   - Generate shareable URLs
   - Read-only mode for viewers
   - Privacy-focused (no server storage)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📋 Roadmap

- [ ] Add more companies (Meta, Salesforce, etc.)
- [ ] Tax calculation integration
- [ ] 401k/pension tracking
- [ ] Equity dilution modeling
- [ ] PDF export functionality
- [ ] Dark mode theme

## 🐛 Issues & Support

Found a bug or have a suggestion? 
- **[Create an issue](https://github.com/jeremychan/total_comp_calculator/issues)**
- **[View existing issues](https://github.com/jeremychan/total_comp_calculator/issues)**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Alpha Vantage for stock price data
- React Bootstrap for UI components
- Recharts for data visualization
- GitHub Pages for free hosting

---

**Built with ❤️ for the tech community**

*Calculate your true total compensation and make informed career decisions.*
