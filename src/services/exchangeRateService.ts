import axios from 'axios';
import { ExchangeRate } from '../types';

const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest';

export class ExchangeRateService {
    private cache: Map<string, ExchangeRate> = new Map();
    private cacheExpiry = 1000 * 60 * 60; // 1 hour

    async getExchangeRate(from: string, to: string): Promise<number> {
        if (from === to) return 1;

        const cacheKey = `${from}-${to}`;
        const cached = this.cache.get(cacheKey);

        if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.cacheExpiry) {
            return cached.rate;
        }

        try {
            const response = await axios.get(`${EXCHANGE_API_URL}/${from}`);
            const rates = response.data.rates;

            if (!rates[to]) {
                throw new Error(`Exchange rate not found for ${from} to ${to}`);
            }

            const rate = rates[to];
            const exchangeRate: ExchangeRate = {
                from,
                to,
                rate,
                lastUpdated: new Date()
            };

            this.cache.set(cacheKey, exchangeRate);

            // Store in localStorage for offline access
            localStorage.setItem(`exchange-rate-${cacheKey}`, JSON.stringify({
                ...exchangeRate,
                lastUpdated: exchangeRate.lastUpdated.toISOString()
            }));

            return rate;
        } catch (error) {
            console.error('Error fetching exchange rate:', error);

            // Try to get from localStorage as fallback
            const stored = localStorage.getItem(`exchange-rate-${cacheKey}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.rate;
            }

            // Return a default rate or throw
            throw new Error(`Unable to fetch exchange rate from ${from} to ${to}`);
        }
    }

    async getMultipleRates(from: string, currencies: string[]): Promise<Record<string, number>> {
        const rates: Record<string, number> = {};

        for (const to of currencies) {
            try {
                rates[to] = await this.getExchangeRate(from, to);
            } catch (error) {
                console.error(`Error getting rate for ${from} to ${to}:`, error);
                rates[to] = 1; // Default fallback
            }
        }

        return rates;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

export const exchangeRateService = new ExchangeRateService(); 