import React from 'react';
import { Form, Badge } from 'react-bootstrap';

interface VestingScheduleSelectorProps {
    vestingSchedule: number[];
    onChange: (vestingSchedule: number[]) => void;
}

const VestingScheduleSelector: React.FC<VestingScheduleSelectorProps> = ({
    vestingSchedule,
    onChange
}) => {
    const months = [
        { num: 1, name: 'Jan' },
        { num: 2, name: 'Feb' },
        { num: 3, name: 'Mar' },
        { num: 4, name: 'Apr' },
        { num: 5, name: 'May' },
        { num: 6, name: 'Jun' },
        { num: 7, name: 'Jul' },
        { num: 8, name: 'Aug' },
        { num: 9, name: 'Sep' },
        { num: 10, name: 'Oct' },
        { num: 11, name: 'Nov' },
        { num: 12, name: 'Dec' }
    ];

    const toggleMonth = (monthNum: number) => {
        const newSchedule = vestingSchedule.includes(monthNum)
            ? vestingSchedule.filter(m => m !== monthNum)
            : [...vestingSchedule, monthNum].sort((a, b) => a - b);
        onChange(newSchedule);
    };

    return (
        <div>
            <Form.Label className="small">Vesting Schedule</Form.Label>
            <div className="d-flex flex-wrap gap-1 mb-2">
                {months.map(month => (
                    <Badge
                        key={month.num}
                        bg={vestingSchedule.includes(month.num) ? 'primary' : 'outline-secondary'}
                        className="cursor-pointer user-select-none"
                        style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                        onClick={() => toggleMonth(month.num)}
                    >
                        {month.name}
                    </Badge>
                ))}
            </div>
            <Form.Text className="text-muted">
                Select months when RSU vesting occurs (typically quarterly)
            </Form.Text>
        </div>
    );
};

export default VestingScheduleSelector; 