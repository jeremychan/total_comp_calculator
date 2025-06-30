import React from 'react';
import { Table } from 'react-bootstrap';
import { YearlyProjection, CURRENCIES } from '../types';

interface ProjectionTableProps {
    projections: YearlyProjection[];
    baseCurrency: string;
    rsuCurrency: string;
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({
    projections,
    baseCurrency,
    rsuCurrency
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

    return (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Table size="sm" className="mb-0">
                <thead className="table-dark sticky-top">
                    <tr>
                        <th>Year</th>
                        <th>Base</th>
                        <th>Bonus</th>
                        <th>RSU</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {projections.map((projection, index) => (
                        <tr key={projection.year} className={index === 0 ? 'table-primary' : ''}>
                            <td className="fw-bold">
                                {projection.year}
                                {index === 0 && <div className="small text-muted">Current</div>}
                            </td>
                            <td>{formatCurrency(projection.baseSalary, baseSymbol)}</td>
                            <td>{formatCurrency(projection.bonus, baseSymbol)}</td>
                            <td>{formatCurrency(projection.rsuVest, rsuSymbol)}</td>
                            <td className="fw-bold">
                                {formatCurrency(projection.totalCompInBaseCurrency, baseSymbol)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="table-secondary">
                    <tr>
                        <td className="fw-bold">Total</td>
                        <td className="fw-bold">
                            {formatCurrency(projections.reduce((sum, p) => sum + p.baseSalary, 0), baseSymbol)}
                        </td>
                        <td className="fw-bold">
                            {formatCurrency(projections.reduce((sum, p) => sum + p.bonus, 0), baseSymbol)}
                        </td>
                        <td className="fw-bold">
                            {formatCurrency(projections.reduce((sum, p) => sum + p.rsuVest, 0), rsuSymbol)}
                        </td>
                        <td className="fw-bold text-success">
                            {formatCurrency(projections.reduce((sum, p) => sum + p.totalCompInBaseCurrency, 0), baseSymbol)}
                        </td>
                    </tr>
                </tfoot>
            </Table>
        </div>
    );
};

export default React.memo(ProjectionTable); 