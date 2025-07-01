import React from 'react';
import { Table, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { YearlyProjection, CURRENCIES, RSUGrant } from '../types';
import { getYear } from 'date-fns';

interface ProjectionTableProps {
    projections: YearlyProjection[];
    baseCurrency: string;
    rsuCurrency: string;
    rsuGrants: RSUGrant[];
    stockPrice: number;
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({
    projections,
    baseCurrency,
    rsuCurrency,
    rsuGrants,
    stockPrice
}) => {
    const baseCurrencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
    const rsuCurrencyInfo = CURRENCIES.find(c => c.code === rsuCurrency);
    const baseSymbol = baseCurrencyInfo?.symbol || baseCurrency;
    const rsuSymbol = rsuCurrencyInfo?.symbol || rsuCurrency;

    const formatCurrency = (value: number, symbol: string): string => {
        return `${symbol}${value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })}`;
    };

    const getRSUVestingBreakdown = (year: number): string => {
        if (!rsuGrants || rsuGrants.length === 0) return 'No RSU grants';

        const currentYear = new Date().getFullYear();
        const breakdown: string[] = [];

        // Process existing grants
        rsuGrants.forEach(grant => {
            const grantYear = getYear(grant.grantDate);
            const yearsFromGrant = year - grantYear;

            if (yearsFromGrant >= 0 && yearsFromGrant < grant.vestingPattern.schedule.length) {
                const vestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
                const sharesVesting = (grant.totalShares * vestingPercentage) / 100;
                const vestingValue = sharesVesting * stockPrice;
                breakdown.push(`${grantYear}: ${sharesVesting.toFixed(0)} shares (${vestingPercentage}%) = ${rsuSymbol}${vestingValue.toLocaleString()}`);
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
                    const vestingPercentage = mostRecentGrant.vestingPattern.schedule[yearsFromFutureGrant];
                    const sharesVesting = (mostRecentGrant.totalShares * vestingPercentage) / 100;
                    const vestingValue = sharesVesting * stockPrice;
                    breakdown.push(`${futureGrantYear} (projected): ${sharesVesting.toFixed(0)} shares (${vestingPercentage}%) = ${rsuSymbol}${vestingValue.toLocaleString()}`);
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
                        <th>RSU ({baseCurrency})</th>
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
                                <td style={isFutureYear ? { color: '#6c757d' } : {}}>{formatCurrency(projection.rsuVestInBaseCurrency, baseSymbol)}</td>
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