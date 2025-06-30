import React, { useState } from 'react';
import { Form, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import { getYear } from 'date-fns';
import { BonusConfig, COMPANIES } from '../types';

interface BonusConfigurationProps {
    bonusConfigs: BonusConfig[];
    company: string;
    onChange: (bonusConfigs: BonusConfig[]) => void;
}

const BonusConfiguration: React.FC<BonusConfigurationProps> = ({
    bonusConfigs,
    company,
    onChange
}) => {
    const [newConfig, setNewConfig] = useState<Partial<BonusConfig>>({
        percentage: 15,
        year: getYear(new Date()),
        performanceMultiplier: 1.0
    });

    const companyInfo = COMPANIES.find(c => c.name === company);
    const currentYear = getYear(new Date());

    const addBonusConfig = () => {
        if (newConfig.percentage && newConfig.year) {
            const config: BonusConfig = {
                percentage: newConfig.percentage,
                year: newConfig.year,
                performanceMultiplier: newConfig.performanceMultiplier || 1.0,
                isHistorical: newConfig.year < currentYear
            };

            // Remove any existing config for the same year
            const filtered = bonusConfigs.filter(c => c.year !== config.year);
            onChange([...filtered, config].sort((a, b) => a.year - b.year));

            // Reset form
            setNewConfig({
                percentage: 15,
                year: currentYear,
                performanceMultiplier: 1.0
            });
        }
    };

    const removeBonusConfig = (year: number) => {
        onChange(bonusConfigs.filter(c => c.year !== year));
    };

    const getCurrentBonus = (): BonusConfig => {
        const currentConfig = bonusConfigs
            .filter(c => c.year <= currentYear)
            .sort((a, b) => b.year - a.year)[0];

        return currentConfig || { percentage: 15, year: currentYear, performanceMultiplier: 1.0 };
    };

    const currentBonus = getCurrentBonus();

    return (
        <div>
            {/* Current Bonus Display */}
            <div className="mb-3">
                <h6>Current Bonus</h6>
                <Badge bg="success" className="fs-6">
                    {currentBonus.percentage}% × {currentBonus.performanceMultiplier}
                </Badge>
                <div className="small text-muted mt-1">
                    Effective from {currentBonus.year}
                </div>
            </div>

            {/* Quick Set Common Values */}
            {companyInfo && (
                <div className="mb-3">
                    <Form.Label className="small">Quick set common values for {company}:</Form.Label>
                    <div className="d-flex flex-wrap gap-1">
                        {companyInfo.commonBonusPercentages.map(percentage => (
                            <Button
                                key={percentage}
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => setNewConfig(prev => ({ ...prev, percentage }))}
                            >
                                {percentage}%
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Add New Configuration */}
            <Card className="mb-3">
                <Card.Header className="py-2">
                    <small>Add/Update Bonus Configuration</small>
                </Card.Header>
                <Card.Body className="py-2">
                    <Row>
                        <Col md={4}>
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
                        <Col md={4}>
                            <Form.Group className="mb-2">
                                <Form.Label className="small">Bonus %</Form.Label>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={newConfig.percentage || ''}
                                    onChange={(e) => setNewConfig(prev => ({
                                        ...prev,
                                        percentage: parseFloat(e.target.value) || 0
                                    }))}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group className="mb-2">
                                <Form.Label className="small">Performance Multiplier</Form.Label>
                                <Form.Select
                                    size="sm"
                                    value={newConfig.performanceMultiplier || 1.0}
                                    onChange={(e) => setNewConfig(prev => ({
                                        ...prev,
                                        performanceMultiplier: parseFloat(e.target.value)
                                    }))}
                                >
                                    <option value={0.8}>0.8 (Below Expectations)</option>
                                    <option value={1.0}>1.0 (Meets Expectations)</option>
                                    <option value={1.1}>1.1 (Exceeds)</option>
                                    <option value={1.2}>1.2 (Greatly Exceeds)</option>
                                    <option value={1.3}>1.3 (Redefines)</option>
                                    <option value={1.5}>1.5 (Outstanding)</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Button variant="primary" size="sm" onClick={addBonusConfig}>
                        Add/Update Configuration
                    </Button>
                </Card.Body>
            </Card>

            {/* Existing Configurations */}
            {bonusConfigs.length > 0 && (
                <div>
                    <Form.Label className="small">Historical Configurations:</Form.Label>
                    {bonusConfigs.sort((a, b) => b.year - a.year).map((config) => (
                        <div key={config.year} className="d-flex justify-content-between align-items-center mb-1 p-2 bg-light rounded">
                            <span className="small">
                                {config.year}: {config.percentage}% × {config.performanceMultiplier}
                                {config.isHistorical && <Badge bg="secondary" className="ms-1">Historical</Badge>}
                            </span>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeBonusConfig(config.year)}
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

export default React.memo(BonusConfiguration); 