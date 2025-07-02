import React from 'react';
import { Form } from 'react-bootstrap';
import { COMPANIES } from '../types';

interface CompanySelectorProps {
    value: string;
    onChange: (company: string) => void;
    disabled?: boolean;
}

const CompanySelector: React.FC<CompanySelectorProps> = ({ value, onChange, disabled = false }) => {
    return (
        <Form.Group className="mb-3">
            <Form.Label>Company</Form.Label>
            <Form.Select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {COMPANIES.map((company) => (
                    <option key={company.name} value={company.name}>
                        {company.name}
                    </option>
                ))}
            </Form.Select>
            <Form.Text className="text-muted">
                Select your company to use appropriate vesting patterns and bonus percentages
            </Form.Text>
        </Form.Group>
    );
};

export default CompanySelector; 