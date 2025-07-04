export interface ExchangeRate {
    from: string;
    to: string;
    rate: number;
    lastUpdated: Date;
}

export interface RSUGrant {
    id: string;
    grantDate: Date;
    totalShares: number;
    grantPrice: number;
    vestingPattern: VestingPattern;
    customVestingSchedule?: number[]; // For custom patterns
}

export interface VestingPattern {
    name: string;
    type: 'equal' | 'increasing' | 'custom';
    schedule: number[]; // Percentage per year (e.g., [25, 25, 25, 25] for Meta)
}

export interface BonusConfig {
    percentage: number;
    year: number;
    isHistorical?: boolean;
    performanceMultiplier?: number; // e.g., 1.0 for meets, 1.2 for exceeds
}

export interface SalaryConfig {
    amount: number;
    year: number;
    isHistorical?: boolean;
}

export interface CompensationData {
    baseSalary: number; // Legacy field for backward compatibility
    salaryConfigs: SalaryConfig[];
    baseCurrency: string;
    bonusConfigs: BonusConfig[];
    rsuGrants: RSUGrant[];
    rsuCurrency: string;
    stockPrice: number;
    company: string;
    vestingSchedule: number[]; // months when vesting occurs (1-12)
}

export interface YearlyProjection {
    year: number;
    baseSalary: number;
    bonus: number;
    rsuVest: number;
    rsuVestInBaseCurrency: number;
    totalComp: number;
    totalCompInBaseCurrency: number;
}

export interface Company {
    name: string;
    defaultVestingPattern: VestingPattern;
    commonBonusPercentages: number[];
    defaultVestingSchedule: number[]; // months when vesting occurs (1-12)
}

export const VESTING_PATTERNS: VestingPattern[] = [
    {
        name: 'Meta Standard (25% yearly)',
        type: 'equal',
        schedule: [25, 25, 25, 25]
    },
    {
        name: 'Amazon (5%, 15%, 40%, 40%)',
        type: 'increasing',
        schedule: [5, 15, 40, 40]
    },
    {
        name: 'Google Standard (25% yearly)',
        type: 'equal',
        schedule: [25, 25, 25, 25]
    },
    {
        name: 'Apple Standard (25% yearly)',
        type: 'equal',
        schedule: [25, 25, 25, 25]
    },
    {
        name: 'Netflix (25% yearly)',
        type: 'equal',
        schedule: [25, 25, 25, 25]
    },
    {
        name: 'Custom',
        type: 'custom',
        schedule: []
    }
];

export const COMPANIES: Company[] = [
    {
        name: 'Meta',
        defaultVestingPattern: VESTING_PATTERNS[0],
        commonBonusPercentages: [10, 15, 20, 25],
        defaultVestingSchedule: [2, 5, 8, 11] // Feb, May, Aug, Nov
    },
    {
        name: 'Amazon',
        defaultVestingPattern: VESTING_PATTERNS[1],
        commonBonusPercentages: [15, 20, 25, 30],
        defaultVestingSchedule: [3, 6, 9, 12] // Mar, Jun, Sep, Dec
    },
    {
        name: 'Google',
        defaultVestingPattern: VESTING_PATTERNS[2],
        commonBonusPercentages: [15, 20, 25],
        defaultVestingSchedule: [3, 6, 9, 12] // Mar, Jun, Sep, Dec
    },
    {
        name: 'Apple',
        defaultVestingPattern: VESTING_PATTERNS[3],
        commonBonusPercentages: [12, 18, 25],
        defaultVestingSchedule: [3, 6, 9, 12] // Mar, Jun, Sep, Dec
    },
    {
        name: 'Netflix',
        defaultVestingPattern: VESTING_PATTERNS[4],
        commonBonusPercentages: [10, 15, 20],
        defaultVestingSchedule: [1, 4, 7, 10] // Jan, Apr, Jul, Oct
    },
    {
        name: 'Other',
        defaultVestingPattern: VESTING_PATTERNS[0],
        commonBonusPercentages: [10, 15, 20, 25],
        defaultVestingSchedule: [3, 6, 9, 12] // Mar, Jun, Sep, Dec (quarterly)
    }
];

export const CURRENCIES = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' }
]; 