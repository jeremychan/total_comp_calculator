import { getYear } from 'date-fns';
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

        // Total compensation in USD (or RSU currency)
        const totalComp = baseSalary + bonus + rsuVest;

        // Convert to base currency if different
        const totalCompInBaseCurrency = data.baseCurrency === data.rsuCurrency
            ? totalComp
            : baseSalary + bonus + (rsuVest * exchangeRate);

        return {
            year,
            baseSalary,
            bonus,
            rsuVest,
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

        return totalVesting;
    }

    calculateTotalGrantValue(grant: RSUGrant, currentStockPrice: number): number {
        return grant.totalShares * currentStockPrice;
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
            bonusConfigs: [
                { percentage: 15, year: currentYear, performanceMultiplier: 1.0 }
            ],
            rsuGrants: [] // Start with no grants - user will add their own
        };
    }
}

export const compensationCalculator = new CompensationCalculator(); 