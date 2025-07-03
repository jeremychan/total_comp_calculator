import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { CURRENCIES } from '../types';
import { useDebouncedCallback } from '../hooks/useDebounce';

interface BaseSalaryInputProps {
    value: number;
    currency: string;
    onChange: (value: number) => void;
}

const BaseSalaryInput: React.FC<BaseSalaryInputProps> = ({ value, currency, onChange }) => {
    const currencyInfo = CURRENCIES.find(c => c.code === currency);
    const symbol = currencyInfo?.symbol || currency;

    // Debounce the onChange callback to avoid excessive updates while typing
    const debouncedOnChange = useDebouncedCallback(onChange, 500);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value) || 0;
        // Use debounced callback to avoid triggering expensive recalculations on every keystroke
        debouncedOnChange(numValue);
    };

    const formatNumber = (num: number): string => {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    };

    return (
        <Form.Group className="mb-3">
            <Form.Label>Base Salary</Form.Label>
            <InputGroup>
                <InputGroup.Text>{symbol}</InputGroup.Text>
                <Form.Control
                    type="number"
                    value={value}
                    onChange={handleChange}
                    placeholder="Enter your base salary"
                    min="0"
                    step="1000"
                />
            </InputGroup>
            <Form.Text className="text-muted">
                Current value: {symbol}{formatNumber(value)}
            </Form.Text>
        </Form.Group>
    );
};

export default BaseSalaryInput; 