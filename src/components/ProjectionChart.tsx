import React, { useMemo, useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { YearlyProjection, CURRENCIES } from '../types';

interface ProjectionChartProps {
    projections: YearlyProjection[];
    baseCurrency: string;
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({ projections, baseCurrency }) => {
    const currencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
    const symbol = currencyInfo?.symbol || baseCurrency;

    // Mobile detection
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
            const isPredicted = p.year > currentYear;

            // Format year based on mobile/desktop
            let yearLabel;
            if (isMobile) {
                // Show last 2 digits on mobile
                const shortYear = p.year.toString().slice(-2);
                yearLabel = isPredicted ? `${shortYear}*` : shortYear;
            } else {
                // Show full year on desktop
                yearLabel = isPredicted ? `${p.year}*` : p.year.toString();
            }

            return {
                year: yearLabel,
                'Base Salary': hasBaseSalary ? Math.round(p.baseSalary) : null,
                'Bonus': hasBaseSalary ? Math.round(p.bonus) : null,
                'RSU Vesting': hasBaseSalary ? Math.round(p.rsuVestInBaseCurrency) : null,
                'Total Comp': hasBaseSalary ? Math.round(p.totalCompInBaseCurrency) : null
            };
        });
    }, [projections, isMobile]);

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
                            Total: {formatTooltipValue(
                                payload
                                    .filter((p: any) => ['Base Salary', 'Bonus', 'RSU Vesting'].includes(p.dataKey))
                                    .reduce((sum: number, p: any) => sum + (p.value || 0), 0)
                            )}
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
                        <XAxis
                            dataKey="year"
                            tick={{ fontSize: 12, fill: '#666' }}
                            interval={0}
                            height={40}
                        />
                        <YAxis tickFormatter={formatCurrency} domain={[0, yAxisMax]} />
                        <Tooltip content={CustomTooltip} />
                        <Legend />
                        <Bar dataKey="Base Salary" stackId="a" fill="#0d6efd" />
                        <Bar dataKey="Bonus" stackId="a" fill="#198754" />
                        <Bar dataKey="RSU Vesting" stackId="a" fill="#fd7e14" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Legend for predicted years */}
            {projections.some(p => p.year > new Date().getFullYear()) && (
                <div className="mb-3">
                    <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        * Predicted years based on current configuration
                    </small>
                </div>
            )}

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