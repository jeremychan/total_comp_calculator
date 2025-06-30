import React, { useState, useEffect, useCallback } from 'react';
import { Form, InputGroup, Button, Spinner, Alert } from 'react-bootstrap';
import { CURRENCIES } from '../types';
import { stockPriceService, StockPrice } from '../services/stockPriceService';

interface StockPriceInputProps {
    value: number;
    currency: string;
    company: string;
    onChange: (value: number) => void;
}

const StockPriceInput: React.FC<StockPriceInputProps> = ({ value, currency, company, onChange }) => {
    const currencyInfo = CURRENCIES.find(c => c.code === currency);
    const symbol = currencyInfo?.symbol || currency;

    const [stockData, setStockData] = useState<StockPrice | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Map company names to stock symbols
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

    const fetchStockPrice = useCallback(async () => {
        const stockSymbol = getStockSymbol(company);
        console.log(`Fetching stock price for ${stockSymbol}...`);
        setLoading(true);
        setError(null);

        try {
            const data = await stockPriceService.fetchStockPrice(stockSymbol);
            console.log('Stock price data received:', data);
            if (data) {
                setStockData(data);
                setError(null); // Clear any previous errors
            } else {
                setError('Unable to fetch stock price - using manual input');
                setStockData(null);
            }
        } catch (err) {
            console.log('Stock price fetch error:', err);
            setError('API unavailable - using fallback prices');
            setStockData(null);
        } finally {
            console.log('Stock price fetch completed');
            setLoading(false);
        }
    }, [company]); // Remove onChange dependency to prevent infinite loops

    // Auto-fetch on company change
    useEffect(() => {
        if (company) {
            fetchStockPrice();
        }
    }, [company, fetchStockPrice]);

    // Update parent component when stock data changes
    useEffect(() => {
        if (stockData && !error) {
            onChange(stockData.price);
        }
    }, [stockData, error, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value) || 0;
        onChange(numValue);
        setStockData(null); // Clear fetched data when manually edited
    };

    const formatNumber = (num: number): string => {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return (
        <Form.Group className="mb-3">
            <Form.Label>Current Stock Price</Form.Label>
            <InputGroup>
                <InputGroup.Text>{symbol}</InputGroup.Text>
                <Form.Control
                    type="number"
                    value={value}
                    onChange={handleChange}
                    placeholder="Enter current stock price"
                    min="0"
                    step="0.01"
                />
                <Button
                    variant="outline-primary"
                    onClick={fetchStockPrice}
                    disabled={loading}
                    title={`Fetch live ${getStockSymbol(company)} stock price`}
                >
                    {loading ? (
                        <Spinner size="sm" animation="border" />
                    ) : (
                        <i className="bi bi-arrow-clockwise"></i>
                    )}
                </Button>
            </InputGroup>

            {stockData && (
                <div className="d-flex justify-content-between align-items-center mt-2">
                    <Form.Text className={error ? "text-warning" : "text-success"}>
                        <i className={`bi ${error ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-1`}></i>
                        {error ? 'Fallback' : 'Live'} {stockData.symbol}: {symbol}{formatNumber(stockData.price)}
                        <span className={`ms-2 ${stockData.change >= 0 ? 'text-success' : 'text-danger'}`}>
                            {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)}
                            ({stockData.changePercent.toFixed(2)}%)
                        </span>
                        {error && <small className="text-muted ms-2">(Demo prices)</small>}
                    </Form.Text>
                    <small className="text-muted">
                        {error ? 'Fallback data' : `Updated: ${stockData.lastUpdated.toLocaleTimeString()}`}
                    </small>
                </div>
            )}

            {error && !stockData && (
                <Alert variant="warning" className="mt-2 mb-0 py-2">
                    <small>{error}. Using manual input.</small>
                </Alert>
            )}

            {!stockData && !error && (
                <Form.Text className="text-muted">
                    Current price: {symbol}{formatNumber(value)} per share
                    <span className="ms-2">
                        <Button variant="link" size="sm" onClick={fetchStockPrice} disabled={loading}>
                            {loading ? 'Fetching...' : 'Fetch live price'}
                        </Button>
                    </span>
                </Form.Text>
            )}

            {/* Debug info - remove this later */}
            <div className="mt-1">
                <small className="text-muted">
                    Status: {loading ? 'Loading...' : stockData ? 'Data loaded' : error ? 'Error state' : 'No data'}
                    {stockData && ` | Price: ${stockData.price}`}
                </small>
            </div>
        </Form.Group>
    );
};

export default StockPriceInput; 