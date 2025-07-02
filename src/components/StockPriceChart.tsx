import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, getYear, getMonth } from 'date-fns';
import { RSUGrant, CURRENCIES } from '../types';
import { stockPriceService } from '../services/stockPriceService';

interface StockPriceChartProps {
    company: string;
    currency: string;
    rsuGrants: RSUGrant[];
    vestingSchedule: number[];
}

interface StockDataPoint {
    date: string;
    price: number;
    month: string;
    year: number;
}

interface GrantEvent {
    date: string;
    price: number;
    shares: number;
    grantDate: Date;
}

const StockPriceChart: React.FC<StockPriceChartProps> = ({
    company,
    currency,
    rsuGrants,
    vestingSchedule
}) => {
    const [stockData, setStockData] = useState<StockDataPoint[]>([]);
    const [grantEvents, setGrantEvents] = useState<GrantEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currencyInfo = CURRENCIES.find(c => c.code === currency);
    const symbol = currencyInfo?.symbol || currency;

    // Get stock symbol for the company
    const getStockSymbol = (companyName: string): string => {
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
    };

    // Load stock data and vesting prices - SIMPLIFIED to prevent infinite loops
    useEffect(() => {
        let isCancelled = false;

        const loadData = async () => {
            if (rsuGrants.length === 0 || vestingSchedule.length === 0) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const stockSymbol = getStockSymbol(company);

                // Load stock data file
                const data = await stockPriceService.loadStockData(stockSymbol);
                if (!data) {
                    setError(`No historical data available for ${stockSymbol}`);
                    return;
                }

                if (isCancelled) return;

                // Parse monthly stock data for the past 4 years
                const monthlyData = data["Monthly Time Series"];
                const stockPoints: StockDataPoint[] = [];
                const currentDate = new Date();
                const fourYearsAgo = new Date(currentDate.getFullYear() - 3, 0, 1);

                Object.entries(monthlyData)
                    .filter(([dateStr]) => new Date(dateStr) >= fourYearsAgo)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .forEach(([dateStr, priceData]) => {
                        const date = new Date(dateStr);
                        stockPoints.push({
                            date: dateStr,
                            price: parseFloat(priceData["4. close"]),
                            month: format(date, 'MMM'),
                            year: date.getFullYear()
                        });
                    });

                if (isCancelled) return;

                // Calculate grant events - Show when RSU grants were made
                const events: GrantEvent[] = [];

                for (const grant of rsuGrants) {
                    // Only show grants from the past 4 years
                    if (grant.grantDate >= fourYearsAgo) {
                        const grantYear = getYear(grant.grantDate);
                        const grantMonth = getMonth(grant.grantDate) + 1;

                        // Get historical price for the grant date
                        const grantPrice = await stockPriceService.getHistoricalPrice(stockSymbol, grantYear, grantMonth);

                        // Format grant date to match stock data (first day of the month)
                        const grantMonthDate = format(new Date(grantYear, grantMonth - 1, 1), 'yyyy-MM-dd');

                        events.push({
                            date: grantMonthDate,
                            price: grantPrice > 0 ? grantPrice : grant.grantPrice, // Use historical price or fallback to grant price
                            shares: grant.totalShares,
                            grantDate: grant.grantDate
                        });
                    }
                }

                if (!isCancelled) {
                    setStockData(stockPoints);
                    setGrantEvents(events);
                }
            } catch (err) {
                if (!isCancelled) {
                    console.error('Error loading stock chart data:', err);
                    setError('Failed to load stock price data');
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isCancelled = true;
        };
    }, [company, rsuGrants, vestingSchedule.length]); // Include full grant data to detect changes

    const formatCurrency = (value: number): string => {
        return `${symbol}${value.toFixed(0)}`;
    };

    const formatTooltipValue = (value: number): string => {
        return `${symbol}${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2 text-muted small">Loading stock price history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-5">
                <i className="bi bi-exclamation-triangle text-warning" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2">{error}</p>
            </div>
        );
    }

    if (stockData.length === 0) {
        return (
            <div className="text-center py-5">
                <i className="bi bi-graph-down text-muted" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2">No stock price data available</p>
            </div>
        );
    }

    const minPrice = Math.min(...stockData.map(d => d.price));
    const maxPrice = Math.max(...stockData.map(d => d.price));
    const priceRange = maxPrice - minPrice;
    const yAxisMin = Math.max(0, minPrice - priceRange * 0.1);
    const yAxisMax = maxPrice + priceRange * 0.1;

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">{getStockSymbol(company)} Stock Price History</h6>
                <small className="text-muted">
                    {grantEvents.length} grant events | Past 4 years
                </small>
            </div>

            <ResponsiveContainer width="100%" height={400}>
                <LineChart
                    data={stockData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return format(date, 'MMM yy');
                        }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        domain={[yAxisMin, yAxisMax]}
                    />
                    <Tooltip
                        formatter={(value: number) => [formatTooltipValue(value), 'Stock Price']}
                        labelFormatter={(label) => {
                            const date = new Date(label);
                            return format(date, 'MMM dd, yyyy');
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />

                    {/* Vertical lines for grant events */}
                    {grantEvents.map((event, index) => {
                        console.log('Rendering grant event:', event, 'Chart data sample:', stockData.slice(0, 2));
                        return (
                            <ReferenceLine
                                key={`grant-${index}`}
                                x={event.date}
                                stroke="#dc3545"
                                strokeWidth={4}
                                strokeDasharray="10 5"
                                label={{
                                    value: `Grant: ${formatCurrency(event.price)}`,
                                    position: "top",
                                    offset: 15,
                                    fontSize: 12,
                                    fill: "#dc3545",
                                    fontWeight: "bold"
                                }}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>

            {/* Legend for grant events */}
            {grantEvents.length > 0 && (
                <div className="mt-3">
                    <div className="d-flex align-items-center mb-2">
                        <div
                            className="me-2"
                            style={{
                                width: '20px',
                                height: '2px',
                                background: '#dc3545',
                                border: '1px dashed #dc3545'
                            }}
                        ></div>
                        <small className="text-muted">RSU Grant Events</small>
                    </div>
                    <div className="row">
                        {grantEvents.slice(0, 6).map((event, index) => {
                            const eventDate = new Date(event.date);
                            return (
                                <div key={index} className="col-md-6 col-lg-4 mb-2">
                                    <div className="small">
                                        <div className="fw-bold">
                                            {format(eventDate, 'MMM yyyy')}
                                        </div>
                                        <div className="text-muted">
                                            {formatTooltipValue(event.price)} • {event.shares.toFixed(0)} shares granted
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {grantEvents.length > 6 && (
                            <div className="col-12">
                                <small className="text-muted">
                                    ...and {grantEvents.length - 6} more grant events
                                </small>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(StockPriceChart); 