import React, { useState } from 'react';
import { Form, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import { getYear } from 'date-fns';
import { CURRENCIES, SalaryConfig } from '../types';

interface SalaryConfigurationProps {
    salaryConfigs: SalaryConfig[];
    baseCurrency: string;
    onChange: (salaryConfigs: SalaryConfig[]) => void;
}

const SalaryConfiguration: React.FC<SalaryConfigurationProps> = ({
    salaryConfigs,
    baseCurrency,
    onChange
}) => {
    const [newConfig, setNewConfig] = useState<Partial<SalaryConfig>>({
        amount: 100000,
        year: getYear(new Date())
    });

    const currencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
    const symbol = currencyInfo?.symbol || baseCurrency;
    const currentYear = getYear(new Date());

    const addSalaryConfig = () => {
        if (newConfig.amount && newConfig.year) {
            const config: SalaryConfig = {
                amount: newConfig.amount,
                year: newConfig.year,
                isHistorical: newConfig.year < currentYear
            };

            // Remove any existing config for the same year
            const filtered = salaryConfigs.filter(c => c.year !== config.year);
            onChange([...filtered, config].sort((a, b) => a.year - b.year));

            // Reset form
            setNewConfig({
                amount: 100000,
                year: currentYear
            });
        }
    };

    const removeSalaryConfig = (year: number) => {
        onChange(salaryConfigs.filter(c => c.year !== year));
    };

    const getCurrentSalary = (): SalaryConfig => {
        const currentConfig = salaryConfigs
            .filter(c => c.year <= currentYear)
            .sort((a, b) => b.year - a.year)[0];

        return currentConfig || { amount: 100000, year: currentYear };
    };

    const currentSalary = getCurrentSalary();

    const formatCurrency = (amount: number): string => {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    };

    return (
        <div>
            {/* Current Salary Display */}
            <div className="mb-3">
                <h6>Current Base Salary</h6>
                <Badge bg="success" className="fs-6">
                    {symbol}{formatCurrency(currentSalary.amount)}
                </Badge>
                <div className="small text-muted mt-1">
                    Effective from {currentSalary.year}
                </div>
            </div>

            {/* Add New Configuration */}
            <Card className="mb-3">
                <Card.Header className="py-2">
                    <small>Add/Update Salary Configuration</small>
                </Card.Header>
                <Card.Body className="py-2">
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label className="small">Year</Form.Label>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={newConfig.year || ''}
                                    onChange={(e) => setNewConfig(prev => ({
                                        ...prev,
                                        year: parseInt(e.target.value) || currentYear
                                    }))}
                                    min={2020}
                                    max={2030}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label className="small">Base Salary ({symbol})</Form.Label>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={newConfig.amount || ''}
                                    onChange={(e) => setNewConfig(prev => ({
                                        ...prev,
                                        amount: parseFloat(e.target.value) || 0
                                    }))}
                                    min={0}
                                    step={1000}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Button variant="primary" size="sm" onClick={addSalaryConfig}>
                        Add/Update Salary
                    </Button>
                </Card.Body>
            </Card>

            {/* Existing Configurations */}
            {salaryConfigs.length > 0 && (
                <div>
                    <Form.Label className="small">Historical Salaries:</Form.Label>
                    {salaryConfigs.sort((a, b) => b.year - a.year).map((config) => (
                        <div key={config.year} className="d-flex justify-content-between align-items-center mb-1 p-2 bg-light rounded">
                            <span className="small">
                                {config.year}: {symbol}{formatCurrency(config.amount)}
                                {config.isHistorical && <Badge bg="secondary" className="ms-1">Historical</Badge>}
                            </span>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeSalaryConfig(config.year)}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default React.memo(SalaryConfiguration); 