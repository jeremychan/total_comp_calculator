import React, { useState } from 'react';
import { Form, Button, Row, Col, Card, Table, Badge, Modal } from 'react-bootstrap';
import { format, getYear } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { RSUGrant, VESTING_PATTERNS, COMPANIES, CURRENCIES } from '../types';
import { compensationCalculator } from '../services/compensationCalculator';

interface RSUManagerProps {
    rsuGrants: RSUGrant[];
    company: string;
    stockPrice: number;
    currency: string;
    onChange: (rsuGrants: RSUGrant[]) => void;
}

const RSUManager: React.FC<RSUManagerProps> = ({
    rsuGrants,
    company,
    stockPrice,
    currency,
    onChange
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingGrant, setEditingGrant] = useState<RSUGrant | null>(null);
    const [newGrant, setNewGrant] = useState<Partial<RSUGrant>>({
        grantDate: new Date(),
        totalShares: 0,
        vestingPattern: COMPANIES.find(c => c.name === company)?.defaultVestingPattern || VESTING_PATTERNS[0],
        customVestingSchedule: []
    });

    const currencyInfo = CURRENCIES.find(c => c.code === currency);
    const symbol = currencyInfo?.symbol || currency;
    const currentYear = getYear(new Date());

    const formatCurrency = (amount: number): string => {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    };

    const formatDate = (date: Date): string => {
        return format(date, 'MMM dd, yyyy');
    };

    const addGrant = () => {
        if (newGrant.grantDate && newGrant.totalShares && newGrant.vestingPattern) {
            const grant: RSUGrant = {
                id: uuidv4(),
                grantDate: newGrant.grantDate,
                totalShares: newGrant.totalShares,
                grantPrice: 0, // Grant price is not used in calculations, only current stock price matters
                vestingPattern: newGrant.vestingPattern,
                customVestingSchedule: newGrant.customVestingSchedule
            };

            onChange([...rsuGrants, grant]);
            resetForm();
            setShowAddModal(false);
        }
    };

    const updateGrant = () => {
        if (editingGrant && newGrant.grantDate && newGrant.totalShares && newGrant.vestingPattern) {
            const updatedGrant: RSUGrant = {
                ...editingGrant,
                grantDate: newGrant.grantDate,
                totalShares: newGrant.totalShares,
                grantPrice: 0, // Grant price is not used in calculations
                vestingPattern: newGrant.vestingPattern,
                customVestingSchedule: newGrant.customVestingSchedule
            };

            onChange(rsuGrants.map(grant => grant.id === editingGrant.id ? updatedGrant : grant));
            resetForm();
            setEditingGrant(null);
            setShowAddModal(false);
        }
    };

    const deleteGrant = (id: string) => {
        onChange(rsuGrants.filter(grant => grant.id !== id));
    };

    const startEdit = (grant: RSUGrant) => {
        setEditingGrant(grant);
        setNewGrant({
            grantDate: grant.grantDate,
            totalShares: grant.totalShares,
            vestingPattern: grant.vestingPattern,
            customVestingSchedule: grant.customVestingSchedule || []
        });
        setShowAddModal(true);
    };

    const resetForm = () => {
        setNewGrant({
            grantDate: new Date(),
            totalShares: 0,
            vestingPattern: COMPANIES.find(c => c.name === company)?.defaultVestingPattern || VESTING_PATTERNS[0],
            customVestingSchedule: []
        });
        setEditingGrant(null);
    };

    const handleVestingPatternChange = (patternName: string) => {
        const pattern = VESTING_PATTERNS.find(p => p.name === patternName);
        if (pattern) {
            setNewGrant(prev => ({
                ...prev,
                vestingPattern: pattern,
                customVestingSchedule: pattern.type === 'custom' ? [25, 25, 25, 25] : []
            }));
        }
    };

    const updateCustomSchedule = (index: number, value: number) => {
        const schedule = [...(newGrant.customVestingSchedule || [25, 25, 25, 25])];
        schedule[index] = value;
        setNewGrant(prev => ({ ...prev, customVestingSchedule: schedule }));
    };

    const getGrantStatus = (grant: RSUGrant): { status: string; variant: string } => {
        const grantYear = getYear(grant.grantDate);
        const yearsFromGrant = currentYear - grantYear;

        if (yearsFromGrant < 0) return { status: 'Not Started', variant: 'secondary' };
        if (yearsFromGrant >= grant.vestingPattern.schedule.length) return { status: 'Fully Vested', variant: 'success' };
        return { status: `Vesting (Year ${yearsFromGrant + 1})`, variant: 'primary' };
    };

    const totalPortfolioValue = rsuGrants.reduce((sum, grant) =>
        sum + compensationCalculator.calculateTotalGrantValue(grant, stockPrice), 0
    );

    const totalRemainingValue = rsuGrants.reduce((sum, grant) =>
        sum + compensationCalculator.calculateRemainingValue(grant, stockPrice, currentYear), 0
    );

    return (
        <div>
            {/* Summary Cards */}
            <Row className="mb-3">
                <Col md={4}>
                    <Card className="text-center">
                        <Card.Body>
                            <h6 className="text-muted">Total Grants</h6>
                            <h4>{rsuGrants.length}</h4>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="text-center">
                        <Card.Body>
                            <h6 className="text-muted">Portfolio Value</h6>
                            <h4>{symbol}{formatCurrency(totalPortfolioValue)}</h4>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="text-center">
                        <Card.Body>
                            <h6 className="text-muted">Remaining Unvested</h6>
                            <h4>{symbol}{formatCurrency(totalRemainingValue)}</h4>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Add Grant Button */}
            <div className="mb-3">
                <Button variant="primary" onClick={() => setShowAddModal(true)}>
                    <i className="bi bi-plus-circle me-2"></i>
                    Add RSU Grant
                </Button>
            </div>

            {/* Grants Table */}
            {rsuGrants.length > 0 ? (
                <Table striped hover responsive>
                    <thead>
                        <tr>
                            <th>Grant Date</th>
                            <th>Shares</th>
                            <th>Current Value</th>
                            <th>Vesting Pattern</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rsuGrants.sort((a, b) => b.grantDate.getTime() - a.grantDate.getTime()).map((grant) => {
                            const status = getGrantStatus(grant);
                            const totalValue = compensationCalculator.calculateTotalGrantValue(grant, stockPrice);
                            const remainingValue = compensationCalculator.calculateRemainingValue(grant, stockPrice, currentYear);

                            return (
                                <tr key={grant.id}>
                                    <td>{formatDate(grant.grantDate)}</td>
                                    <td>{grant.totalShares.toLocaleString()}</td>
                                    <td>
                                        <div>{symbol}{formatCurrency(totalValue)}</div>
                                        <small className="text-muted">
                                            Remaining: {symbol}{formatCurrency(remainingValue)}
                                        </small>
                                    </td>
                                    <td>
                                        <small>{grant.vestingPattern.name}</small>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                            {grant.vestingPattern.schedule.join('%, ')}%
                                        </div>
                                    </td>
                                    <td>
                                        <Badge bg={status.variant}>{status.status}</Badge>
                                    </td>
                                    <td>
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            className="me-1"
                                            onClick={() => startEdit(grant)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => deleteGrant(grant.id)}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            ) : (
                <div className="text-center text-muted py-4">
                    <i className="bi bi-graph-up" style={{ fontSize: '2rem' }}></i>
                    <p className="mt-2">No RSU grants added yet. Click "Add RSU Grant" to get started.</p>
                </div>
            )}

            {/* Add/Edit Grant Modal */}
            <Modal show={showAddModal} onHide={() => { setShowAddModal(false); resetForm(); }} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{editingGrant ? 'Edit' : 'Add'} RSU Grant</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Grant Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={newGrant.grantDate ? format(newGrant.grantDate, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setNewGrant(prev => ({
                                                    ...prev,
                                                    grantDate: new Date(e.target.value + 'T00:00:00')
                                                }));
                                            }
                                        }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Total Shares</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={newGrant.totalShares || ''}
                                        onChange={(e) => setNewGrant(prev => ({
                                            ...prev,
                                            totalShares: parseInt(e.target.value) || 0
                                        }))}
                                        placeholder="e.g., 500"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Vesting Pattern</Form.Label>
                                    <Form.Select
                                        value={newGrant.vestingPattern?.name || ''}
                                        onChange={(e) => handleVestingPatternChange(e.target.value)}
                                    >
                                        {VESTING_PATTERNS.map((pattern) => (
                                            <option key={pattern.name} value={pattern.name}>
                                                {pattern.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Custom Vesting Schedule */}
                        {newGrant.vestingPattern?.type === 'custom' && (
                            <Row>
                                <Col>
                                    <Form.Label>Custom Vesting Schedule (%)</Form.Label>
                                    <Row>
                                        {(newGrant.customVestingSchedule || [25, 25, 25, 25]).map((percentage, index) => (
                                            <Col md={3} key={index}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="small">Year {index + 1}</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        value={percentage}
                                                        onChange={(e) => updateCustomSchedule(index, parseFloat(e.target.value) || 0)}
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                    />
                                                </Form.Group>
                                            </Col>
                                        ))}
                                    </Row>
                                    <small className="text-muted">
                                        Total: {(newGrant.customVestingSchedule || []).reduce((sum, p) => sum + p, 0)}%
                                    </small>
                                </Col>
                            </Row>
                        )}

                        {/* Grant Value Preview */}
                        {newGrant.totalShares && stockPrice && (
                            <div className="alert alert-info">
                                <strong>Grant Value Preview:</strong><br />
                                Total Value: {symbol}{formatCurrency((newGrant.totalShares || 0) * stockPrice)}<br />
                                <small>Based on current stock price of {symbol}{stockPrice}</small>
                            </div>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={editingGrant ? updateGrant : addGrant}>
                        {editingGrant ? 'Update' : 'Add'} Grant
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default React.memo(RSUManager); 