import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { YearlyProjection, CURRENCIES } from '../types';

interface ProjectionChartProps {
    projections: YearlyProjection[];
    baseCurrency: string;
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({ projections, baseCurrency }) => {
    const currencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
    const symbol = currencyInfo?.symbol || baseCurrency;

    const formatCurrency = useMemo(() => {
        return (value: number): string => {
            return `${symbol}${(value / 1000).toFixed(0)}k`;
        };
    }, [symbol]);

    const formatTooltipValue = useMemo(() => {
        return (value: number): string => {
            return `${symbol}${value.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            })}`;
        };
    }, [symbol]);

    // Prepare chart data - memoized to prevent unnecessary re-renders
    const chartData = useMemo(() => {
        if (!projections || projections.length === 0) return [];
        const currentYear = new Date().getFullYear();
        return projections.map(p => {
            // Don't show data if base salary is 0 or undefined
            const hasBaseSalary = p.baseSalary > 0;
            return {
                year: p.year.toString(),
                'Base Salary': hasBaseSalary ? Math.round(p.baseSalary) : null,
                'Bonus': hasBaseSalary ? Math.round(p.bonus) : null,
                'RSU Vesting': hasBaseSalary ? Math.round(p.rsuVest) : null,
                'Total Comp': hasBaseSalary ? Math.round(p.totalCompInBaseCurrency) : null,
                totalCompHistorical: (hasBaseSalary && p.year <= currentYear) ? Math.round(p.totalCompInBaseCurrency) : null,
                totalCompFuture: (hasBaseSalary && p.year >= currentYear) ? Math.round(p.totalCompInBaseCurrency) : null
            };
        });
    }, [projections]);

    const yAxisMax = useMemo(() => {
        if (!projections || projections.length === 0) return 100000;
        const max = Math.max(...projections.map(p => p.totalCompInBaseCurrency));
        return Math.ceil(max * 1.1);
    }, [projections]);

    const CustomTooltip = useMemo(() => {
        return ({ active, payload, label }: any) => {
            if (active && payload && payload.length) {
                return (
                    <div className="bg-white p-3 border border-secondary rounded shadow">
                        <p className="fw-bold mb-2">{`Year: ${label}`}</p>
                        {payload.map((entry: any, index: number) => {
                            if (entry.dataKey === 'totalCompLine') return null;
                            return (
                                <p key={index} className="mb-1" style={{ color: entry.color }}>
                                    {`${entry.dataKey}: ${formatTooltipValue(entry.value)}`}
                                </p>
                            );
                        })}
                        <hr className="my-2" />
                        <p className="fw-bold mb-0">
                            Total: {formatTooltipValue(payload.find((p: any) => p.dataKey === 'totalCompLine')?.value || 0)}
                        </p>
                    </div>
                );
            }
            return null;
        };
    }, [formatTooltipValue]);

    // Pre-calculate statistics to avoid conditional hooks in JSX
    const avgCompensation = useMemo(() => {
        if (!projections || projections.length === 0) return 0;
        return projections.reduce((sum, p) => sum + p.totalCompInBaseCurrency, 0) / projections.length;
    }, [projections]);

    const totalCompensation = useMemo(() => {
        if (!projections || projections.length === 0) return 0;
        return projections.reduce((sum, p) => sum + p.totalCompInBaseCurrency, 0);
    }, [projections]);

    const peakCompensation = useMemo(() => {
        if (!projections || projections.length === 0) return 0;
        return Math.max(...projections.map(p => p.totalCompInBaseCurrency));
    }, [projections]);

    // Handle empty projections
    if (!projections || projections.length === 0) {
        return (
            <div className="text-center py-5">
                <i className="bi bi-graph-up text-muted" style={{ fontSize: '3rem' }}></i>
                <p className="text-muted mt-3">No projection data available.</p>
                <p className="small text-muted">Add RSU grants or configure salary/bonus to see projections.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Stacked Bar Chart */}
            <div className="mb-4">
                <h6 className="mb-3">Total Compensation Breakdown</h6>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={formatCurrency} domain={[0, yAxisMax]} />
                        <Tooltip content={CustomTooltip} />
                        <Legend />
                        <Bar dataKey="Base Salary" stackId="a" fill="#0d6efd" />
                        <Bar dataKey="Bonus" stackId="a" fill="#198754" />
                        <Bar dataKey="RSU Vesting" stackId="a" fill="#fd7e14" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Total Compensation Trend Line */}
            <div className="mb-4">
                <h6 className="mb-3">Total Compensation Trend</h6>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={formatCurrency} domain={[0, yAxisMax]} />
                        <Tooltip
                            formatter={(value: number, name: string) => {
                                if (value === null) return [null, null];
                                return [formatTooltipValue(value), 'Total Compensation'];
                            }}
                            labelFormatter={(label) => `Year: ${label}`}
                        />
                        <Line
                            type="monotone"
                            dataKey="totalCompHistorical"
                            stroke="#dc3545"
                            strokeWidth={3}
                            dot={{ fill: '#dc3545', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="totalCompFuture"
                            stroke="#dc3545"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ fill: '#dc3545', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8 }}
                            connectNulls={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Statistics */}
            <div className="row">
                <div className="col-md-4">
                    <div className="card text-center">
                        <div className="card-body">
                            <h6 className="card-title text-muted">Average Annual Comp</h6>
                            <h4 className="text-primary">
                                {formatTooltipValue(avgCompensation)}
                            </h4>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card text-center">
                        <div className="card-body">
                            <h6 className="card-title text-muted">Total Over Period</h6>
                            <h4 className="text-success">
                                {formatTooltipValue(totalCompensation)}
                            </h4>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card text-center">
                        <div className="card-body">
                            <h6 className="card-title text-muted">Peak Year Comp</h6>
                            <h4 className="text-warning">
                                {formatTooltipValue(peakCompensation)}
                            </h4>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProjectionChart); 