import { getYear, getMonth } from 'date-fns';
import { CompensationData, RSUGrant, BonusConfig, YearlyProjection } from '../types';
import { exchangeRateService } from './exchangeRateService';

export class CompensationCalculator {
    async calculateProjections(
        data: CompensationData,
        startYear: number,
        endYear: number
    ): Promise<YearlyProjection[]> {
        const projections: YearlyProjection[] = [];

        // Get exchange rate if needed
        const exchangeRate = data.baseCurrency === data.rsuCurrency
            ? 1
            : await exchangeRateService.getExchangeRate(data.rsuCurrency, data.baseCurrency);

        for (let year = startYear; year <= endYear; year++) {
            const projection = await this.calculateYearlyProjection(
                data,
                year,
                exchangeRate
            );
            projections.push(projection);
        }

        return projections;
    }

    private async calculateYearlyProjection(
        data: CompensationData,
        year: number,
        exchangeRate: number
    ): Promise<YearlyProjection> {
        // Calculate base salary for the year (historical or current)
        const baseSalary = this.getSalaryForYear(data, year);

        // Calculate bonus
        const bonusConfig = this.getBonusConfigForYear(data.bonusConfigs, year);
        const bonus = baseSalary * (bonusConfig.percentage / 100) * (bonusConfig.performanceMultiplier || 1);

        // Calculate RSU vesting for this year
        const rsuVest = this.calculateRSUVestingForYear(data.rsuGrants, year, data.stockPrice);

        // Convert RSU vesting to base currency
        const rsuVestInBaseCurrency = data.baseCurrency === data.rsuCurrency
            ? rsuVest
            : rsuVest * exchangeRate;

        // Total compensation in USD (or RSU currency)
        const totalComp = baseSalary + bonus + rsuVest;

        // Convert to base currency if different
        const totalCompInBaseCurrency = data.baseCurrency === data.rsuCurrency
            ? totalComp
            : baseSalary + bonus + rsuVestInBaseCurrency;

        return {
            year,
            baseSalary,
            bonus,
            rsuVest,
            rsuVestInBaseCurrency,
            totalComp,
            totalCompInBaseCurrency
        };
    }

    private getSalaryForYear(data: CompensationData, year: number): number {
        // If we have salary configs, use them
        if (data.salaryConfigs && data.salaryConfigs.length > 0) {
            const sortedConfigs = data.salaryConfigs
                .filter(config => config.year <= year)
                .sort((a, b) => b.year - a.year);

            return sortedConfigs[0]?.amount || data.baseSalary || 0;
        }

        // Fallback to legacy baseSalary field
        return data.baseSalary || 0;
    }

    private getBonusConfigForYear(bonusConfigs: BonusConfig[], year: number): BonusConfig {
        // Find the most recent bonus config for or before the given year
        const sortedConfigs = bonusConfigs
            .filter(config => config.year <= year)
            .sort((a, b) => b.year - a.year);

        return sortedConfigs[0] || { percentage: 15, year, performanceMultiplier: 1 };
    }

    private calculateRSUVestingForYear(grants: RSUGrant[], year: number, currentStockPrice: number): number {
        let totalVesting = 0;
        const currentYear = new Date().getFullYear();

        // Process existing grants
        for (const grant of grants) {
            const grantYear = getYear(grant.grantDate);
            const yearsFromGrant = year - grantYear;

            // Only consider grants that have started vesting and haven't fully vested
            if (yearsFromGrant >= 0 && yearsFromGrant < grant.vestingPattern.schedule.length) {
                const vestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
                const sharesVesting = (grant.totalShares * vestingPercentage) / 100;
                const vestingValue = sharesVesting * currentStockPrice;
                totalVesting += vestingValue;
            }
        }

        // For future years, project continuation of the most recent grant pattern
        if (grants.length > 0 && year > currentYear) {
            // Find the most recent grant
            const mostRecentGrant = grants.reduce((latest, grant) =>
                getYear(grant.grantDate) > getYear(latest.grantDate) ? grant : latest
            );

            // Assume a new grant of the same size is given each year starting from currentYear + 1
            for (let futureGrantYear = currentYear + 1; futureGrantYear <= year; futureGrantYear++) {
                const yearsFromFutureGrant = year - futureGrantYear;

                // Only calculate vesting if this future grant would be vesting in the target year
                if (yearsFromFutureGrant >= 0 && yearsFromFutureGrant < mostRecentGrant.vestingPattern.schedule.length) {
                    const vestingPercentage = mostRecentGrant.vestingPattern.schedule[yearsFromFutureGrant];
                    const sharesVesting = (mostRecentGrant.totalShares * vestingPercentage) / 100;
                    const vestingValue = sharesVesting * currentStockPrice;
                    totalVesting += vestingValue;
                }
            }
        }

        return totalVesting;
    }

    calculateTotalGrantValue(grant: RSUGrant, currentStockPrice: number): number {
        return grant.totalShares * currentStockPrice;
    }

    // Check if a grant has vested based on current date and vesting schedule
    hasGrantVested(grant: RSUGrant, vestingSchedule: number[], targetYear?: number, targetMonth?: number): boolean {
        const currentDate = new Date();
        const checkYear = targetYear || currentDate.getFullYear();
        const checkMonth = targetMonth || currentDate.getMonth() + 1; // getMonth() returns 0-11

        const grantYear = getYear(grant.grantDate);
        const grantMonth = getMonth(grant.grantDate) + 1; // getMonth() returns 0-11

        // Grant hasn't started yet
        if (checkYear < grantYear) return false;

        // Grant is fully vested (4+ years past grant)
        if (checkYear >= grantYear + grant.vestingPattern.schedule.length) return true;

        // For the grant year and subsequent years, check if we've passed any vesting dates
        const yearsFromGrant = checkYear - grantYear;

        if (yearsFromGrant < 0) return false;
        if (yearsFromGrant >= grant.vestingPattern.schedule.length) return true;

        // Check if we've passed the vesting dates for this year
        // For quarterly vesting, we need to check if current date is past the quarterly vesting date
        const targetVestingYear = grantYear + yearsFromGrant;

        if (checkYear > targetVestingYear) return true;
        if (checkYear < targetVestingYear) return false;

        // Same year as vesting year - check if we've passed the first vesting month for this year
        const vestingMonthsThisYear = vestingSchedule.filter(month => month >= grantMonth || yearsFromGrant > 0);

        if (vestingMonthsThisYear.length === 0) return false;

        const firstVestingMonth = Math.min(...vestingMonthsThisYear);
        return checkMonth >= firstVestingMonth;
    }

    calculateRemainingValue(grant: RSUGrant, currentStockPrice: number, currentYear: number): number {
        const grantYear = getYear(grant.grantDate);
        const yearsFromGrant = currentYear - grantYear;

        if (yearsFromGrant < 0) {
            // Grant hasn't started vesting yet
            return this.calculateTotalGrantValue(grant, currentStockPrice);
        }

        if (yearsFromGrant >= grant.vestingPattern.schedule.length) {
            // Grant has fully vested
            return 0;
        }

        // Calculate remaining unvested percentage
        const vestedPercentage = grant.vestingPattern.schedule
            .slice(0, yearsFromGrant)
            .reduce((sum, percentage) => sum + percentage, 0);

        const remainingPercentage = 100 - vestedPercentage;
        const remainingShares = (grant.totalShares * remainingPercentage) / 100;

        return remainingShares * currentStockPrice;
    }

    // Utility function to create sample data for testing
    createSampleData(): CompensationData {
        const currentYear = new Date().getFullYear();
        return {
            baseSalary: 120000, // Legacy field for backward compatibility
            salaryConfigs: [
                { amount: 120000, year: currentYear, isHistorical: false }
            ],
            baseCurrency: 'GBP',
            rsuCurrency: 'USD',
            stockPrice: 350,
            company: 'Meta',
            vestingSchedule: [2, 5, 8, 11], // Meta's default: Feb, May, Aug, Nov
            bonusConfigs: [
                { percentage: 15, year: currentYear, performanceMultiplier: 1.0 }
            ],
            rsuGrants: [] // Start with no grants - user will add their own
        };
    }
}

export const compensationCalculator = new CompensationCalculator(); 