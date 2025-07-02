import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Row, Col, Card, Alert, Modal, Button } from 'react-bootstrap';
import { getYear } from 'date-fns';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import { CompensationData, YearlyProjection, CURRENCIES, COMPANIES } from './types';
import { compensationCalculator } from './services/compensationCalculator';
import { exchangeRateService } from './services/exchangeRateService';

import CompanySelector from './components/CompanySelector';
import CurrencySelector from './components/CurrencySelector';
import VestingScheduleSelector from './components/VestingScheduleSelector';
import SalaryConfiguration from './components/SalaryConfiguration';
import BonusConfiguration from './components/BonusConfiguration';
import RSUManager from './components/RSUManager';
import StockPriceInput from './components/StockPriceInput';
import ProjectionChart from './components/ProjectionChart';
import ProjectionTable from './components/ProjectionTable';
import StockPriceChart from './components/StockPriceChart';
import ExchangeRateDisplay from './components/ExchangeRateDisplay';

function App() {
  const [compensationData, setCompensationData] = useState<CompensationData>(() => {
    const data = initializeData();
    return data.compensationData;
  });

  const [isReadOnlyMode, setIsReadOnlyMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('data');
  });

  function initializeData() {
    // First check URL for shared data
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    if (encodedData) {
      try {
        const decodedData = JSON.parse(atob(encodedData));
        decodedData.rsuGrants = decodedData.rsuGrants.map((grant: any) => ({
          ...grant,
          grantDate: new Date(grant.grantDate)
        }));

        // Migrate legacy baseSalary to salaryConfigs if needed
        if (decodedData.baseSalary && (!decodedData.salaryConfigs || decodedData.salaryConfigs.length === 0)) {
          decodedData.salaryConfigs = [{
            amount: decodedData.baseSalary,
            year: new Date().getFullYear(),
            isHistorical: false
          }];
        }

        // Migrate legacy data to include vesting schedule if missing
        if (!decodedData.vestingSchedule) {
          const companyInfo = COMPANIES.find(c => c.name === decodedData.company);
          decodedData.vestingSchedule = companyInfo?.defaultVestingSchedule || [3, 6, 9, 12];
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return { compensationData: decodedData, isSharedData: true };
      } catch (error) {
        console.error('Error loading data from URL:', error);
      }
    }

    // Try to load from localStorage or use sample data
    const saved = localStorage.getItem('compensation-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        parsed.rsuGrants = parsed.rsuGrants.map((grant: any) => ({
          ...grant,
          grantDate: new Date(grant.grantDate)
        }));

        // Migrate legacy baseSalary to salaryConfigs if needed
        if (parsed.baseSalary && (!parsed.salaryConfigs || parsed.salaryConfigs.length === 0)) {
          parsed.salaryConfigs = [{
            amount: parsed.baseSalary,
            year: new Date().getFullYear(),
            isHistorical: false
          }];
        }

        // Migrate legacy data to include vesting schedule if missing
        if (!parsed.vestingSchedule) {
          const companyInfo = COMPANIES.find(c => c.name === parsed.company);
          parsed.vestingSchedule = companyInfo?.defaultVestingSchedule || [3, 6, 9, 12];
        }

        return { compensationData: parsed, isSharedData: false };
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }
    return { compensationData: compensationCalculator.createSampleData(), isSharedData: false };
  }

  const [projections, setProjections] = useState<YearlyProjection[]>([]);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [expandedSummaryCard, setExpandedSummaryCard] = useState<string | null>(null);

  const currentYear = getYear(new Date());
  // Removed projectionYears - now using fixed range

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('compensation-data', JSON.stringify(compensationData));
  }, [compensationData]);

  // Create a stable data hash for dependency tracking
  const dataHash = useMemo(() => {
    const data = {
      baseSalary: compensationData.baseSalary || 0,
      salaryConfigs: compensationData.salaryConfigs || [],
      bonusConfigs: compensationData.bonusConfigs || [],
      rsuGrants: (compensationData.rsuGrants || []).map(g => ({
        id: g.id,
        totalShares: g.totalShares,
        grantDate: g.grantDate?.getTime() || 0, // Use 0 instead of Date.now() for stability
        vestingPattern: g.vestingPattern
      })),
      stockPrice: compensationData.stockPrice || 0,
      baseCurrency: compensationData.baseCurrency || 'USD',
      rsuCurrency: compensationData.rsuCurrency || 'USD',
      vestingSchedule: compensationData.vestingSchedule || []
    };
    return JSON.stringify(data);
  }, [compensationData]);

  // Recalculate projections when data changes
  useEffect(() => {
    let isCancelled = false; // Prevent race conditions

    const calculateProjections = async () => {
      console.log('Starting projection calculation...', {
        dataValid: !!compensationData,
        hasBaseSalary: !!compensationData.baseSalary,
        hasSalaryConfigs: !!(compensationData.salaryConfigs?.length),
        stockPrice: compensationData.stockPrice
      });
      setLoading(true);

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (!isCancelled) {
          console.warn('Projection calculation timed out');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      try {
        const newProjections = await compensationCalculator.calculateProjections(
          compensationData,
          currentYear - 4, // Start 4 years ago
          currentYear + 3  // End 3 years in the future (8 years total)
        );

        clearTimeout(timeoutId);

        if (!isCancelled) {
          console.log('Calculated projections:', newProjections.length, 'years', newProjections);
          setProjections(newProjections);

          // Update exchange rate for display
          if (compensationData.baseCurrency !== compensationData.rsuCurrency) {
            try {
              const rate = await exchangeRateService.getExchangeRate(
                compensationData.rsuCurrency,
                compensationData.baseCurrency
              );
              if (!isCancelled) {
                setExchangeRate(rate);
                setLastUpdated(new Date());
              }
            } catch (exchangeError) {
              console.warn('Exchange rate fetch failed, using 1:1', exchangeError);
              if (!isCancelled) {
                setExchangeRate(1);
              }
            }
          } else {
            setExchangeRate(1);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error calculating projections:', error);
        if (!isCancelled) {
          // Still clear loading state even on error
          setProjections([]);
        }
      } finally {
        if (!isCancelled) {
          console.log('Projection calculation completed');
          setLoading(false);
        }
      }
    };

    calculateProjections();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataHash, currentYear]);

  const updateCompensationData = useCallback((updates: Partial<CompensationData>) => {
    if (isReadOnlyMode) {
      setShowEditWarning(true);
      return;
    }

    setCompensationData(prev => {
      const newData = { ...prev, ...updates };

      // If company changed, update default bonus percentage and vesting schedule
      if (updates.company && updates.company !== prev.company) {
        const companyInfo = COMPANIES.find(c => c.name === updates.company);
        if (companyInfo) {
          // Set default vesting schedule
          newData.vestingSchedule = companyInfo.defaultVestingSchedule;

          // Set default bonus percentage if none configured for current year
          if (!prev.bonusConfigs.length || prev.bonusConfigs.every(bc => bc.year !== currentYear)) {
            // Only set default if no current year bonus is configured
            // Use the most common bonus percentage (usually the first one) as default
            const defaultBonusPercentage = companyInfo.commonBonusPercentages[0] || 15;
            newData.bonusConfigs = [
              ...prev.bonusConfigs.filter(bc => bc.year !== currentYear),
              {
                percentage: defaultBonusPercentage,
                year: currentYear,
                performanceMultiplier: 1.0
              }
            ];
          }
        }
      }

      return newData;
    });
  }, [isReadOnlyMode, currentYear]);

  const enableEditMode = () => {
    if (window.confirm('This will overwrite your local saved data with the shared data. Continue?')) {
      setIsReadOnlyMode(false);
      setShowEditWarning(false);
      // Save to localStorage
      localStorage.setItem('compensation-data', JSON.stringify({
        ...compensationData,
        rsuGrants: compensationData.rsuGrants.map(grant => ({
          ...grant,
          grantDate: grant.grantDate.toISOString()
        }))
      }));
    } else {
      setShowEditWarning(false);
    }
  };

  const clearToDefault = () => {
    if (window.confirm('Are you sure you want to clear all data and reset to defaults?')) {
      localStorage.removeItem('compensation-data');
      setCompensationData(compensationCalculator.createSampleData());
      setProjections([]);
      setExchangeRate(1);
      setLastUpdated(null);
      setIsReadOnlyMode(false); // Exit read-only mode
      setShowEditWarning(false); // Close any open modals
    }
  };

  const shareData = () => {
    try {
      const dataToShare = {
        ...compensationData,
        rsuGrants: compensationData.rsuGrants.map(grant => ({
          ...grant,
          grantDate: grant.grantDate.toISOString()
        }))
      };
      const encoded = btoa(JSON.stringify(dataToShare));
      const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encoded}`;

      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Share URL copied to clipboard!');
      }).catch(() => {
        // Fallback - show the URL in a prompt
        prompt('Copy this URL to share your compensation data:', shareUrl);
      });
    } catch (error) {
      alert('Error creating share URL: ' + error);
    }
  };



  return (
    <div className="App">
      <Container fluid className="py-4">
        <Row>
          <Col>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div></div>
              <div className="text-center">
                <h1 className="mb-2">
                  <i className="bi bi-calculator me-2"></i>
                  Total Compensation Calculator
                </h1>
                <p className="text-muted mb-0">
                  Track your total compensation including base salary, bonus, and RSU vesting across multiple years
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={shareData}
                  title="Share your data via URL"
                >
                  <i className="bi bi-share me-1"></i>
                  Share
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={clearToDefault}
                  title="Clear all data and reset to defaults"
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Reset
                </button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Current Total Comp Banner */}
        {projections.length > 0 && (() => {
          // Find current year projection (index 4 since we start 4 years ago)
          const currentYearProjection = projections.find(p => p.year === currentYear) || projections[4];

          // Calculate bonus details for tooltip
          const currentBonusConfig = compensationData.bonusConfigs
            .filter(config => config.year <= currentYear)
            .sort((a, b) => b.year - a.year)[0] || { percentage: 15, performanceMultiplier: 1.0 };

          const bonusCalculation = `${currentYearProjection?.baseSalary.toLocaleString()} × ${currentBonusConfig.percentage}% × ${currentBonusConfig.performanceMultiplier}`;

          // Calculate RSU vesting details for tooltip
          const rsuVestingDetails = compensationData.rsuGrants.map(grant => {
            const grantYear = getYear(grant.grantDate);
            const yearsFromGrant = currentYear - grantYear;
            if (yearsFromGrant >= 0 && yearsFromGrant < grant.vestingPattern.schedule.length) {
              const vestingPercentage = grant.vestingPattern.schedule[yearsFromGrant];
              const sharesVesting = (grant.totalShares * vestingPercentage) / 100;
              const vestingValue = sharesVesting * compensationData.stockPrice;
              return `${grant.grantDate.getFullYear()}: ${sharesVesting.toFixed(0)} shares (${vestingPercentage}%) = ${(CURRENCIES.find(c => c.code === compensationData.rsuCurrency)?.symbol) || ''}${vestingValue.toLocaleString()}`;
            }
            return null;
          }).filter(Boolean).join('\n');

          return currentYearProjection ? (
            <Row className="mb-4">
              <Col>
                <div className="card bg-primary text-white">
                  <div className="card-body text-center py-4">
                    <h2 className="mb-2">
                      <i className="bi bi-trophy me-2"></i>
                      Current Year Total Compensation
                    </h2>
                    <h1 className="display-4 mb-2">
                      {(currentYearProjection && compensationData.baseCurrency &&
                        CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}
                      {currentYearProjection?.totalCompInBaseCurrency.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </h1>
                    <div className="row text-center">
                      <div className="col-md-3">
                        <h6 className="text-light">Base Salary</h6>
                        <h5>{(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.baseSalary.toLocaleString()}</h5>
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-light">Bonus</h6>
                        <h5
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedSummaryCard(expandedSummaryCard === 'bonus' ? null : 'bonus')}
                        >
                          {(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.bonus.toLocaleString()}
                          <i className={`bi bi-chevron-${expandedSummaryCard === 'bonus' ? 'up' : 'down'} ms-1`} style={{ fontSize: '0.8rem' }}></i>
                        </h5>
                        {expandedSummaryCard === 'bonus' && (
                          <div className="mt-2 p-2 bg-white bg-opacity-10 rounded">
                            <small className="text-light">
                              {bonusCalculation}
                            </small>
                          </div>
                        )}
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-light">RSU Vesting</h6>
                        <h5
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedSummaryCard(expandedSummaryCard === 'rsu' ? null : 'rsu')}
                        >
                          {(CURRENCIES.find(c => c.code === compensationData.rsuCurrency)?.symbol) || ''}{currentYearProjection?.rsuVest.toLocaleString()}
                          <i className={`bi bi-chevron-${expandedSummaryCard === 'rsu' ? 'up' : 'down'} ms-1`} style={{ fontSize: '0.8rem' }}></i>
                        </h5>
                        <div className="small text-light mt-1">
                          ({(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.rsuVestInBaseCurrency.toLocaleString()})
                        </div>
                        {expandedSummaryCard === 'rsu' && (
                          <div className="mt-2 p-2 bg-white bg-opacity-10 rounded">
                            <small className="text-light" style={{ whiteSpace: 'pre-line' }}>
                              {rsuVestingDetails || 'No RSU vesting this year'}
                            </small>
                          </div>
                        )}
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-light">Year</h6>
                        <h5>{currentYearProjection?.year}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          ) : null;
        })()}

        {/* Read-Only Mode Alert */}
        {isReadOnlyMode && (
          <Row className="mb-3">
            <Col>
              <Alert variant="info" className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-eye me-2"></i>
                  <strong>Viewing Shared Data</strong> - This is a read-only view. Your changes won't be saved.
                </div>
                <Button variant="outline-primary" size="sm" onClick={enableEditMode}>
                  <i className="bi bi-pencil me-1"></i>
                  Enable Editing
                </Button>
              </Alert>
            </Col>
          </Row>
        )}

        {/* Edit Warning Modal */}
        <Modal show={showEditWarning} onHide={() => setShowEditWarning(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Enable Editing Mode?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>You're currently viewing shared data in read-only mode.</p>
            <p>To make changes, you need to enable editing mode. This will:</p>
            <ul>
              <li>Overwrite your locally saved data with this shared data</li>
              <li>Allow you to make modifications</li>
              <li>Save your changes locally going forward</li>
            </ul>
            <p><strong>Continue?</strong></p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                console.log('Stay Read-Only clicked');
                setShowEditWarning(false);
              }}
            >
              Stay Read-Only
            </Button>
            <Button variant="primary" onClick={enableEditMode}>
              Enable Editing
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Configuration Section */}
        <Row className="mb-4">
          <Col lg={4} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-building me-2"></i>
                  Company & Currency
                </h5>
              </Card.Header>
              <Card.Body>
                <CompanySelector
                  value={compensationData.company}
                  onChange={(company) => updateCompensationData({ company })}
                />
                <hr />
                <CurrencySelector
                  baseCurrency={compensationData.baseCurrency}
                  rsuCurrency={compensationData.rsuCurrency}
                  onBaseCurrencyChange={(baseCurrency) => updateCompensationData({ baseCurrency })}
                  onRsuCurrencyChange={(rsuCurrency) => updateCompensationData({ rsuCurrency })}
                />
                <hr />
                <VestingScheduleSelector
                  vestingSchedule={compensationData.vestingSchedule || []}
                  onChange={(vestingSchedule) => updateCompensationData({ vestingSchedule })}
                />
                {compensationData.baseCurrency !== compensationData.rsuCurrency && (
                  <>
                    <hr />
                    <ExchangeRateDisplay
                      from={compensationData.rsuCurrency}
                      to={compensationData.baseCurrency}
                      rate={exchangeRate}
                      lastUpdated={lastUpdated}
                    />
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-cash-stack me-2"></i>
                  Salary & Stock Price
                </h5>
              </Card.Header>
              <Card.Body>
                <SalaryConfiguration
                  salaryConfigs={compensationData.salaryConfigs || []}
                  baseCurrency={compensationData.baseCurrency}
                  onChange={(salaryConfigs) => updateCompensationData({ salaryConfigs })}
                />
                <hr />
                <StockPriceInput
                  value={compensationData.stockPrice}
                  currency={compensationData.rsuCurrency}
                  company={compensationData.company}
                  onChange={(stockPrice) => updateCompensationData({ stockPrice })}
                />
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-percent me-2"></i>
                  Bonus Configuration
                </h5>
              </Card.Header>
              <Card.Body>
                <BonusConfiguration
                  bonusConfigs={compensationData.bonusConfigs}
                  company={compensationData.company}
                  onChange={(bonusConfigs) => updateCompensationData({ bonusConfigs })}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* RSU Management */}
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-graph-up me-2"></i>
                  RSU Grants Management
                </h5>
              </Card.Header>
              <Card.Body>
                <RSUManager
                  rsuGrants={compensationData.rsuGrants}
                  company={compensationData.company}
                  stockPrice={compensationData.stockPrice}
                  currency={compensationData.rsuCurrency}
                  baseCurrency={compensationData.baseCurrency}
                  exchangeRate={exchangeRate}
                  vestingSchedule={compensationData.vestingSchedule || []}
                  onChange={(rsuGrants) => updateCompensationData({ rsuGrants })}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Projections */}
        <Row>
          <Col lg={8} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart me-2"></i>
                  Total Compensation Projection
                </h5>
              </Card.Header>
              <Card.Body>
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Calculating projections...</p>
                  </div>
                ) : projections.length > 0 ? (
                  <ProjectionChart
                    projections={projections}
                    baseCurrency={compensationData.baseCurrency}
                  />
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-graph-up text-muted" style={{ fontSize: '3rem' }}></i>
                    <p className="text-muted mt-3">No projection data available.</p>
                    <p className="small text-muted">Configure your compensation details to see projections.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-table me-2"></i>
                  Yearly Breakdown
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <ProjectionTable
                  projections={projections}
                  baseCurrency={compensationData.baseCurrency}
                  rsuCurrency={compensationData.rsuCurrency}
                  rsuGrants={compensationData.rsuGrants}
                  stockPrice={compensationData.stockPrice}
                  company={compensationData.company}
                  vestingSchedule={compensationData.vestingSchedule || []}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Stock Price History */}
        {compensationData.rsuGrants.length > 0 && (
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">
                    <i className="bi bi-graph-up-arrow me-2"></i>
                    Stock Price History & Vesting Events
                  </h5>
                </Card.Header>
                <Card.Body>
                  <StockPriceChart
                    company={compensationData.company}
                    currency={compensationData.rsuCurrency}
                    rsuGrants={compensationData.rsuGrants}
                    vestingSchedule={compensationData.vestingSchedule || []}
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Footer */}
        <Row className="mt-5">
          <Col>
            <hr />
            <p className="text-center text-muted small">
              Total Compensation Calculator - Your data is stored locally in your browser
            </p>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
