import React, { useState, useEffect, useCallback } from 'react';
import { Form, InputGroup, Button, Spinner, Alert } from 'react-bootstrap';
import { CURRENCIES } from '../types';
import { stockPriceService, StockPrice } from '../services/stockPriceService';
import { useDebouncedCallback } from '../hooks/useDebounce';

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
    const [inputValue, setInputValue] = useState(value.toString());

    // Debounce the onChange callback to avoid excessive updates while typing
    const debouncedOnChange = useDebouncedCallback(onChange, 500);

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
        console.log(`Loading stock price for ${stockSymbol} from local data...`);
        setLoading(true);
        setError(null);

        try {
            const data = await stockPriceService.fetchStockPrice(stockSymbol);
            console.log('Stock price data received:', data);
            if (data) {
                setStockData(data);
                if (data.price === 0) {
                    setError(`No data available for ${stockSymbol} - please enter price manually`);
                } else {
                    setError(null);
                }
            } else {
                setError(`Unable to load ${stockSymbol} data - please enter price manually`);
                setStockData(null);
            }
        } catch (err) {
            console.log('Stock price load error:', err);
            setError(`Data unavailable for ${stockSymbol} - please enter price manually`);
            setStockData(null);
        } finally {
            console.log('Stock price load completed');
            setLoading(false);
        }
    }, [company]);

    // Auto-fetch on company change
    useEffect(() => {
        if (company) {
            fetchStockPrice();
        }
    }, [company, fetchStockPrice]);

    // Update parent component when stock data changes (only for valid prices)
    useEffect(() => {
        if (stockData && !error && stockData.price > 0) {
            onChange(stockData.price);
            setInputValue(stockData.price.toString());
        }
    }, [stockData, error, onChange]);

    // Sync input value with prop value when it changes externally
    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Only update parent if the value is a valid number
        if (newValue === '' || newValue === '.') {
            // Allow empty input or just a decimal point
            return;
        }

        const numValue = parseFloat(newValue);
        if (!isNaN(numValue) && numValue >= 0) {
            // Use debounced callback to avoid triggering expensive recalculations on every keystroke
            debouncedOnChange(numValue);
        }

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
                    value={inputValue}
                    onChange={handleChange}
                    placeholder="Enter current stock price"
                    min="0"
                    step="0.01"
                />
                <Button
                    variant="outline-primary"
                    onClick={fetchStockPrice}
                    disabled={loading}
                    title={`Load ${getStockSymbol(company)} stock price from local data`}
                >
                    {loading ? (
                        <Spinner size="sm" animation="border" />
                    ) : (
                        <i className="bi bi-arrow-clockwise"></i>
                    )}
                </Button>
            </InputGroup>

            {error && (
                <Alert variant="warning" className="mt-2 mb-0 py-2">
                    <small>
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        {error}
                    </small>
                </Alert>
            )}

            {!stockData && !error && !loading && (
                <Form.Text className="text-muted">
                    Current price: {symbol}{formatNumber(value)} per share
                    <span className="ms-2">
                        <Button variant="link" size="sm" onClick={fetchStockPrice} className="p-0">
                            Load from data
                        </Button>
                    </span>
                </Form.Text>
            )}
        </Form.Group>
    );
};

export default StockPriceInput; 