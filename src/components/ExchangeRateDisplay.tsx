import React from 'react';
import { Badge } from 'react-bootstrap';
import { format } from 'date-fns';

interface ExchangeRateDisplayProps {
    from: string;
    to: string;
    rate: number;
    lastUpdated: Date | null;
}

const ExchangeRateDisplay: React.FC<ExchangeRateDisplayProps> = ({
    from,
    to,
    rate,
    lastUpdated
}) => {
    const formatRate = (rate: number): string => {
        return rate.toLocaleString('en-US', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
    };

    const formatTime = (date: Date): string => {
        return format(date, 'MMM dd, HH:mm');
    };

    return (
        <div className="text-center">
            <h6 className="mb-2">Exchange Rate</h6>
            <div className="mb-2">
                <Badge bg="primary" className="fs-6">
                    1 {from} = {formatRate(rate)} {to}
                </Badge>
            </div>
            {lastUpdated && (
                <small className="text-muted">
                    <i className="bi bi-clock me-1"></i>
                    Updated: {formatTime(lastUpdated)}
                </small>
            )}
        </div>
    );
};

export default ExchangeRateDisplay; 