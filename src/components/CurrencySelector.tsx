import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import { CURRENCIES } from '../types';

interface CurrencySelectorProps {
    baseCurrency: string;
    rsuCurrency: string;
    onBaseCurrencyChange: (currency: string) => void;
    onRsuCurrencyChange: (currency: string) => void;
    disabled?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
    baseCurrency,
    rsuCurrency,
    onBaseCurrencyChange,
    onRsuCurrencyChange,
    disabled = false
}) => {
    return (
        <>
            <Row>
                <Col>
                    <Form.Group className="mb-3">
                        <Form.Label>Base Salary Currency</Form.Label>
                        <Form.Select
                            value={baseCurrency}
                            onChange={(e) => onBaseCurrencyChange(e.target.value)}
                            disabled={disabled}
                        >
                            {CURRENCIES.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.symbol} {currency.name} ({currency.code})
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Form.Group className="mb-3">
                        <Form.Label>RSU Currency</Form.Label>
                        <Form.Select
                            value={rsuCurrency}
                            onChange={(e) => onRsuCurrencyChange(e.target.value)}
                            disabled={disabled}
                        >
                            {CURRENCIES.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.symbol} {currency.name} ({currency.code})
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
            {baseCurrency !== rsuCurrency && (
                <div className="alert alert-info small">
                    <i className="bi bi-info-circle me-1"></i>
                    Exchange rates will be automatically fetched and used for calculations
                </div>
            )}
        </>
    );
};

export default CurrencySelector; 