import React, { useState, useEffect } from 'react';
import { Table, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { YearlyProjection, CURRENCIES, RSUGrant } from '../types';
import { getYear } from 'date-fns';
import { stockPriceService } from '../services/stockPriceService';

interface ProjectionTableProps {
    projections: YearlyProjection[];
    baseCurrency: string;
    rsuCurrency: string;
    rsuGrants: RSUGrant[];
    stockPrice: number;
    company: string;
    vestingSchedule: number[];
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({
    projections,
    baseCurrency,
    rsuCurrency,
    rsuGrants,
    stockPrice,
    company,
    vestingSchedule
}) => {
    const baseCurrencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
    const rsuCurrencyInfo = CURRENCIES.find(c => c.code === rsuCurrency);
    const baseSymbol = baseCurrencyInfo?.symbol || baseCurrency;
    const rsuSymbol = rsuCurrencyInfo?.symbol || rsuCurrency;

    const [historicalPrices, setHistoricalPrices] = useState<Map<string, number>>(new Map());

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

    const stockSymbol = getStockSymbol(company);

    // Pre-load historical prices for all relevant vesting dates
    useEffect(() => {
        const loadHistoricalPrices = async () => {
            if (rsuGrants.length === 0 || vestingSchedule.length === 0) return;

            const priceMap = new Map<string, number>();
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            // Collect all unique year-month combinations we need prices for
            const dateKeys = new Set<string>();

            // Generate years based on grants (more stable than using projections)
            const startYear = Math.min(...rsuGrants.map(g => getYear(g.grantDate)));
            const endYear = currentYear;

            for (let year = startYear; year <= endYear; year++) {
                rsuGrants.forEach(grant => {
                    const grantYear = getYear(grant.grantDate);
                    const yearsFromGrant = year - grantYear;

                    if (yearsFromGrant >= 0 && yearsFromGrant < grant.vestingPattern.schedule.length) {
                        vestingSchedule.forEach(month => {
                            if (year < currentYear ||
                                (year === currentYear && month <= currentMonth)) {
                                dateKeys.add(`${year}-${month}`);
                            }
                        });
                    }
                });
            }

            // Fetch prices for all needed dates
            for (const dateKey of Array.from(dateKeys)) {
                const [year, month] = dateKey.split('-').map(Number);
                try {
                    const price = await stockPriceService.getHistoricalPrice(stockSymbol, year, month);
                    if (price > 0) {
                        priceMap.set(dateKey, price);
                    }
                } catch (error) {
                    console.warn(`Failed to get historical price for ${stockSymbol} ${dateKey}:`, error);
                }
            }

            setHistoricalPrices(priceMap);
        };

        loadHistoricalPrices();
    }, [rsuGrants, vestingSchedule, stockSymbol]);

    const formatCurrency = (value: number, symbol: string): string => {
        return `${symbol}${value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })}`;
    };

    const getRSUVestingBreakdown = (year: number): string => {
        if (!rsuGrants || rsuGrants.length === 0) return 'No RSU grants';

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const breakdown: string[] = [];

        // Process existing grants with quarterly breakdown
        rsuGrants.forEach(grant => {
            const grantYear = getYear(grant.grantDate);
            const yearsFromGrant = year - grantYear;

            if (yearsFromGrant >= 0 && yearsFromGrant < grant.vestingPattern.schedule.length) {
                const annualVestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
                if (annualVestingPercentage === 0) return;

                const quarterlyVestingPercentage = annualVestingPercentage / 4;
                const quarterlyShares = (grant.totalShares * quarterlyVestingPercentage) / 100;

                let totalYearValue = 0;
                const quarterBreakdown: string[] = [];

                vestingSchedule.forEach(month => {
                    // For the grant year, only vest after the grant month
                    if (year === grantYear && month < (grant.grantDate.getMonth() + 1)) {
                        return;
                    }

                    let price: number;

                    // Use historical price for past vests, current price for future vests
                    if (year < currentYear || (year === currentYear && month <= currentMonth)) {
                        const priceKey = `${year}-${month}`;
                        price = historicalPrices.get(priceKey) || stockPrice;
                    } else {
                        price = stockPrice;
                    }

                    const quarterValue = quarterlyShares * price;
                    totalYearValue += quarterValue;

                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    quarterBreakdown.push(`  ${monthNames[month]}: ${quarterlyShares.toFixed(0)} × ${rsuSymbol}${price.toFixed(2)} = ${rsuSymbol}${quarterValue.toLocaleString()}`);
                });

                if (quarterBreakdown.length > 0) {
                    breakdown.push(`${grantYear} Grant (${annualVestingPercentage}% of ${grant.totalShares.toLocaleString()}): ${rsuSymbol}${totalYearValue.toLocaleString()}`);
                    breakdown.push(...quarterBreakdown);
                }
            }
        });

        // For future years, add projected grants
        if (year > currentYear && rsuGrants.length > 0) {
            // Find the most recent grant to use as template
            const mostRecentGrant = rsuGrants.reduce((latest, grant) =>
                getYear(grant.grantDate) > getYear(latest.grantDate) ? grant : latest
            );

            // Project new grants for each year from next year until target year
            for (let futureGrantYear = currentYear + 1; futureGrantYear <= year; futureGrantYear++) {
                const yearsFromFutureGrant = year - futureGrantYear;

                if (yearsFromFutureGrant >= 0 && yearsFromFutureGrant < mostRecentGrant.vestingPattern.schedule.length) {
                    const annualVestingPercentage = mostRecentGrant.vestingPattern.schedule[yearsFromFutureGrant];
                    if (annualVestingPercentage === 0) continue;

                    const quarterlyVestingPercentage = annualVestingPercentage / 4;
                    const quarterlyShares = (mostRecentGrant.totalShares * quarterlyVestingPercentage) / 100;

                    let totalYearValue = 0;
                    const quarterBreakdown: string[] = [];

                    vestingSchedule.forEach(month => {
                        const quarterValue = quarterlyShares * stockPrice;
                        totalYearValue += quarterValue;

                        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        quarterBreakdown.push(`  ${monthNames[month]}: ${quarterlyShares.toFixed(0)} × ${rsuSymbol}${stockPrice.toFixed(2)} = ${rsuSymbol}${quarterValue.toLocaleString()}`);
                    });

                    breakdown.push(`${futureGrantYear} Grant (projected, ${annualVestingPercentage}%): ${rsuSymbol}${totalYearValue.toLocaleString()}`);
                    breakdown.push(...quarterBreakdown);
                }
            }
        }

        return breakdown.length > 0 ? breakdown.join('\n') : 'No vesting this year';
    };

    return (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Table size="sm" className="mb-0">
                <thead className="table-dark sticky-top">
                    <tr>
                        <th>Year</th>
                        <th>Base</th>
                        <th>Bonus</th>
                        <th>RSU ({rsuCurrency})</th>
                        {rsuCurrency !== baseCurrency && <th>RSU ({baseCurrency})</th>}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {projections.map((projection, index) => {
                        const currentYear = new Date().getFullYear();
                        const isCurrentYear = projection.year === currentYear;
                        const isFutureYear = projection.year > currentYear;
                        return (
                            <tr key={projection.year} className={isCurrentYear ? 'table-primary' : isFutureYear ? 'table-secondary' : ''}>
                                <td className="fw-bold" style={isFutureYear ? { color: '#6c757d' } : {}}>
                                    {projection.year}
                                    {isCurrentYear && <div className="small text-muted">Current</div>}
                                </td>
                                <td style={isFutureYear ? { color: '#6c757d' } : {}}>{formatCurrency(projection.baseSalary, baseSymbol)}</td>
                                <td style={isFutureYear ? { color: '#6c757d' } : {}}>{formatCurrency(projection.bonus, baseSymbol)}</td>
                                <td style={isFutureYear ? { color: '#6c757d' } : {}}>
                                    <OverlayTrigger
                                        placement="top"
                                        overlay={
                                            <Tooltip id={`rsu-tooltip-${projection.year}`}>
                                                <div style={{ whiteSpace: 'pre-line', textAlign: 'left' }}>
                                                    {getRSUVestingBreakdown(projection.year)}
                                                </div>
                                            </Tooltip>
                                        }
                                    >
                                        <span style={{ cursor: 'help' }}>
                                            {formatCurrency(projection.rsuVest, rsuSymbol)}
                                        </span>
                                    </OverlayTrigger>
                                </td>
                                {rsuCurrency !== baseCurrency && (
                                    <td style={isFutureYear ? { color: '#6c757d' } : {}}>{formatCurrency(projection.rsuVestInBaseCurrency, baseSymbol)}</td>
                                )}
                                <td className="fw-bold" style={isFutureYear ? { color: '#6c757d' } : {}}>
                                    {formatCurrency(projection.totalCompInBaseCurrency, baseSymbol)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
};

export default React.memo(ProjectionTable); 