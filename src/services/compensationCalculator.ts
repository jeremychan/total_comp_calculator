import { getYear, getMonth } from 'date-fns';
import { CompensationData, RSUGrant, BonusConfig, YearlyProjection } from '../types';
import { exchangeRateService } from './exchangeRateService';
import { stockPriceService } from './stockPriceService';

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

        // Get stock symbol for historical price lookups
        const stockSymbol = this.getStockSymbol(data.company);

        for (let year = startYear; year <= endYear; year++) {
            const projection = await this.calculateYearlyProjection(
                data,
                year,
                exchangeRate,
                stockSymbol
            );
            projections.push(projection);
        }

        return projections;
    }

    private getStockSymbol(companyName: string): string {
        const symbolMap: { [key: string]: string } = {
            'Meta': 'META',
            'Apple': 'AAPL',
            'Google': 'GOOGL',
            'Amazon': 'AMZN',
            'Microsoft': 'MSFT',
            'Tesla': 'TSLA',
            'Netflix': 'NFLX',
            'NVIDIA': 'NVDA'
        };
        return symbolMap[companyName] || 'META';
    }

    private async calculateYearlyProjection(
        data: CompensationData,
        year: number,
        exchangeRate: number,
        stockSymbol: string
    ): Promise<YearlyProjection> {
        // Calculate base salary for the year (historical or current)
        const baseSalary = this.getSalaryForYear(data, year);

        // Calculate bonus
        const bonusConfig = this.getBonusConfigForYear(data.bonusConfigs, year);
        const bonus = baseSalary * (bonusConfig.percentage / 100) * (bonusConfig.performanceMultiplier || 1);

        // Calculate RSU vesting for this year using historical prices
        const rsuVest = await this.calculateRSUVestingForYear(
            data.rsuGrants,
            year,
            data.stockPrice,
            data.vestingSchedule,
            stockSymbol
        );

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

    private async calculateRSUVestingForYear(
        grants: RSUGrant[],
        year: number,
        currentStockPrice: number,
        vestingSchedule: number[],
        stockSymbol: string
    ): Promise<number> {
        let totalVesting = 0;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Process existing grants
        for (const grant of grants) {
            // Calculate quarterly vests for this grant in the target year
            const quarterlyVests = this.calculateQuarterlyVestsForYear(
                grant,
                year,
                vestingSchedule
            );

            for (const vest of quarterlyVests) {
                let stockPrice: number;

                // Use historical price for past vests, current price for future vests
                if (year < currentYear || (year === currentYear && vest.month <= currentMonth)) {
                    // Historical vesting - use actual historical stock price
                    stockPrice = await stockPriceService.getHistoricalPrice(stockSymbol, year, vest.month);
                    if (stockPrice === 0) {
                        // Fallback to current price if no historical data
                        stockPrice = currentStockPrice;
                    }
                } else {
                    // Future vesting - use current stock price
                    stockPrice = currentStockPrice;
                }

                const vestingValue = vest.shares * stockPrice;
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
                // Create a virtual grant for the future year
                const futureGrant: RSUGrant = {
                    ...mostRecentGrant,
                    id: `future-${futureGrantYear}`,
                    grantDate: new Date(futureGrantYear, mostRecentGrant.grantDate.getMonth(), mostRecentGrant.grantDate.getDate())
                };

                const quarterlyVests = this.calculateQuarterlyVestsForYear(
                    futureGrant,
                    year,
                    vestingSchedule
                );

                for (const vest of quarterlyVests) {
                    // Use current price for all future projections
                    const vestingValue = vest.shares * currentStockPrice;
                    totalVesting += vestingValue;
                }
            }
        }

        return totalVesting;
    }

    private calculateQuarterlyVestsForYear(
        grant: RSUGrant,
        targetYear: number,
        vestingSchedule: number[]
    ): Array<{ month: number; shares: number }> {
        const grantYear = getYear(grant.grantDate);
        const grantMonth = getMonth(grant.grantDate) + 1;
        const yearsFromGrant = targetYear - grantYear;
        const vests: Array<{ month: number; shares: number }> = [];

        // Only consider grants that have started vesting and haven't fully vested
        if (yearsFromGrant < 0 || yearsFromGrant >= grant.vestingPattern.schedule.length) {
            return vests;
        }

        // Get total percentage vesting this year
        const annualVestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
        if (annualVestingPercentage === 0) return vests;

        // Calculate quarterly vesting amount (divide annual by 4 quarters)
        const quarterlyVestingPercentage = annualVestingPercentage / 4;
        const quarterlyShares = (grant.totalShares * quarterlyVestingPercentage) / 100;

        // Find vesting months for this year
        for (const vestingMonth of vestingSchedule) {
            // For the grant year, only vest after the grant month
            if (yearsFromGrant === 0 && vestingMonth < grantMonth) {
                continue;
            }

            vests.push({
                month: vestingMonth,
                shares: quarterlyShares
            });
        }

        return vests;
    }

    // Calculate the actual vested value of a grant using historical prices
    async calculateVestedValue(
        grant: RSUGrant,
        vestingSchedule: number[],
        stockSymbol: string,
        currentStockPrice: number,
        targetYear?: number,
        targetMonth?: number
    ): Promise<{ totalVested: number; vestedShares: number }> {
        const currentDate = new Date();
        const checkYear = targetYear || currentDate.getFullYear();
        const checkMonth = targetMonth || currentDate.getMonth() + 1;

        const grantYear = getYear(grant.grantDate);
        const grantMonth = getMonth(grant.grantDate) + 1;

        let totalVested = 0;
        let vestedShares = 0;

        // Calculate vesting through each completed year
        for (let year = grantYear; year < grantYear + grant.vestingPattern.schedule.length; year++) {
            const yearsFromGrant = year - grantYear;

            // Stop if we haven't reached this year yet
            if (year > checkYear) break;

            const annualVestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
            if (annualVestingPercentage === 0) continue;

            const quarterlyVestingPercentage = annualVestingPercentage / 4;
            const quarterlyShares = (grant.totalShares * quarterlyVestingPercentage) / 100;

            // Check each vesting month in this year
            for (const vestingMonth of vestingSchedule) {
                // For the grant year, only vest after the grant month
                if (year === grantYear && vestingMonth < grantMonth) {
                    continue;
                }

                // For the current check year, only vest if we've passed the vesting month
                if (year === checkYear && vestingMonth > checkMonth) {
                    continue;
                }

                // Get historical price for this vesting event
                let stockPrice: number;
                if (year < currentDate.getFullYear() || (year === currentDate.getFullYear() && vestingMonth <= currentDate.getMonth() + 1)) {
                    // Historical vesting - use actual historical stock price
                    stockPrice = await stockPriceService.getHistoricalPrice(stockSymbol, year, vestingMonth);
                    if (stockPrice === 0) {
                        stockPrice = currentStockPrice;
                    }
                } else {
                    stockPrice = currentStockPrice;
                }

                vestedShares += quarterlyShares;
                totalVested += quarterlyShares * stockPrice;
            }
        }

        return { totalVested, vestedShares };
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

    calculateRemainingValue(grant: RSUGrant, currentStockPrice: number, currentYear: number, vestingSchedule?: number[]): number {
        const currentDate = new Date();
        const grantYear = getYear(grant.grantDate);
        const grantMonth = getMonth(grant.grantDate) + 1;
        const currentMonth = currentDate.getMonth() + 1;

        const yearsFromGrant = currentYear - grantYear;

        if (yearsFromGrant < 0) {
            // Grant hasn't started vesting yet
            return this.calculateTotalGrantValue(grant, currentStockPrice);
        }

        if (yearsFromGrant >= grant.vestingPattern.schedule.length) {
            // Grant has fully vested
            return 0;
        }

        // Calculate total vested percentage based on current date
        let totalVestedPercentage = 0;

        // Process each vesting year
        for (let vestingYearIndex = 0; vestingYearIndex < grant.vestingPattern.schedule.length; vestingYearIndex++) {
            const vestingYear = grantYear + vestingYearIndex;
            const annualVestingPercentage = grant.vestingPattern.schedule[vestingYearIndex];
            const quarterlyVestingPercentage = annualVestingPercentage / 4;

            // Use provided vesting schedule or default to Meta's
            const vestingMonths = vestingSchedule || [2, 5, 8, 11];

            let completedQuarters = 0;
            let hasIncompleteYear = false;

            for (const vestingMonth of vestingMonths) {
                // For the grant year, only count vests after grant month
                if (vestingYear === grantYear && vestingMonth < grantMonth) {
                    continue;
                }

                // Count this quarter if we've passed the vesting month
                if (currentYear > vestingYear ||
                    (currentYear === vestingYear && currentMonth >= vestingMonth)) {
                    completedQuarters++;
                } else {
                    // Haven't reached this vest yet
                    hasIncompleteYear = true;
                    break;
                }
            }

            // Add the vested portion of this year
            totalVestedPercentage += completedQuarters * quarterlyVestingPercentage;

            // If we haven't completed all quarters of this year, or we're in a future year, stop
            if (hasIncompleteYear || vestingYear > currentYear) {
                break;
            }
        }

        const remainingPercentage = Math.max(0, 100 - totalVestedPercentage);
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