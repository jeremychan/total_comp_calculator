import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Row, Col, Card, Alert, Modal, Button, Form, Toast, ToastContainer, Collapse } from 'react-bootstrap';
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

        // Keep URL params for read-only mode detection
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
  const [expandedSummaryCard, setExpandedSummaryCard] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showCopyToast, setShowCopyToast] = useState(false);

  // Collapsible sections state - default to collapsed on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [configOpen, setConfigOpen] = useState(!isMobile);
  const [compensationOpen, setCompensationOpen] = useState(!isMobile);
  const [stockHistoryOpen, setStockHistoryOpen] = useState(!isMobile);

  const currentYear = getYear(new Date());
  // Removed projectionYears - now using fixed range

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save to localStorage whenever data changes (but not when viewing shared data)
  useEffect(() => {
    if (!isReadOnlyMode) {
      localStorage.setItem('compensation-data', JSON.stringify(compensationData));
    }
  }, [compensationData, isReadOnlyMode]);

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
  }, [currentYear]);



  const clearToDefault = () => {
    if (window.confirm('Are you sure you want to clear all data and reset to defaults?')) {
      localStorage.removeItem('compensation-data');
      setCompensationData(compensationCalculator.createSampleData());
      setProjections([]);
      setExchangeRate(1);
      setLastUpdated(null);
      setIsReadOnlyMode(false); // Exit read-only mode
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
      const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`;
      setShareUrl(url);
      setShowShareModal(true);
    } catch (error) {
      alert('Error creating share URL: ' + error);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowCopyToast(true);
    }).catch(() => {
      // Fallback - select the text
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowCopyToast(true);
    });
  };



  return (
    <div className="App">
      <Container fluid className="py-4">


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
            <Row className="mb-3">
              <Col>
                <div className="card border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                  <div className="card-body py-3">
                    <div className="position-relative mb-3">
                      <div className="text-center">
                        <h5 className="mb-0 text-dark">
                          <i className="bi bi-trophy me-2 text-warning"></i>
                          Total Compensation {currentYearProjection?.year}
                        </h5>
                      </div>
                      <div className="position-absolute top-0 end-0 d-flex gap-2">
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
                    <div className="text-center mb-3">
                      <h2 className="text-primary fw-bold mb-0">
                        {(currentYearProjection && compensationData.baseCurrency &&
                          CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}
                        {currentYearProjection?.totalCompInBaseCurrency.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </h2>
                    </div>
                    <div className="row text-center">
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Base Salary</div>
                        <div className="fw-bold">{(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.baseSalary.toLocaleString()}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Bonus</div>
                        <div className="fw-bold">{(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.bonus.toLocaleString()}</div>
                        <div className="small text-muted mt-1">
                          {bonusCalculation}
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">RSU Vesting</div>
                        <div
                          className="fw-bold"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedSummaryCard(expandedSummaryCard === 'rsu' ? null : 'rsu')}
                        >
                          {(CURRENCIES.find(c => c.code === compensationData.rsuCurrency)?.symbol) || ''}{currentYearProjection?.rsuVest.toLocaleString()}
                          <i className={`bi bi-chevron-${expandedSummaryCard === 'rsu' ? 'up' : 'down'} ms-1`} style={{ fontSize: '0.8rem' }}></i>
                        </div>
                        <div className="small text-muted mt-1">
                          ({(CURRENCIES.find(c => c.code === compensationData.baseCurrency)?.symbol) || ''}{currentYearProjection?.rsuVestInBaseCurrency.toLocaleString()})
                        </div>
                        {expandedSummaryCard === 'rsu' && (
                          <div className="mt-2 p-2 bg-light rounded border">
                            <small className="text-muted" style={{ whiteSpace: 'pre-line' }}>
                              {rsuVestingDetails || 'No RSU vesting this year'}
                            </small>
                          </div>
                        )}
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Currency</div>
                        <div className="fw-bold">{compensationData.baseCurrency}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          ) : null;
        })()}

        {/* Shared Data Banner */}
        {isReadOnlyMode && (
          <Row className="mb-3">
            <Col>
              <Alert variant="warning" className="d-flex justify-content-between align-items-center mb-0">
                <div>
                  <i className="bi bi-share me-2"></i>
                  <strong>Viewing Shared Data</strong> - Changes you make won't be saved to your local storage.
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-dark" size="sm" onClick={() => {
                    const currentUrl = window.location.href;
                    navigator.clipboard.writeText(currentUrl).then(() => {
                      setShowCopyToast(true);
                    }).catch(() => {
                      setShowCopyToast(true);
                    });
                  }}>
                    <i className="bi bi-clipboard me-1"></i>
                    Copy URL
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => {
                    // Clear URL params and reload with local data
                    window.history.replaceState({}, document.title, window.location.pathname);
                    window.location.reload();
                  }}>
                    <i className="bi bi-x-circle me-1"></i>
                    Exit Shared Mode
                  </Button>
                </div>
              </Alert>
            </Col>
          </Row>
        )}



        {/* Share Modal */}
        <Modal show={showShareModal} onHide={() => setShowShareModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Share Your Compensation Data</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Share this URL with others to let them view your compensation calculation:</p>
            <div className="d-flex">
              <Form.Control
                type="text"
                value={shareUrl}
                readOnly
                className="me-2"
                style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <Button variant="outline-primary" onClick={copyShareUrl}>
                <i className="bi bi-clipboard me-1"></i>
                Copy
              </Button>
            </div>
            <div className="mt-3">
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                The shared data will be read-only for viewers. They can enable editing to modify their own copy.
              </small>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowShareModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Configuration Section */}
        <Row className="mb-3">
          <Col>
            <div className="card border-0 shadow-sm">
              <div
                className="card-header bg-light border-0 py-2 cursor-pointer"
                onClick={() => setConfigOpen(!configOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-gear me-2"></i>
                    Configuration
                  </h6>
                  <i className={`bi bi-chevron-${configOpen ? 'up' : 'down'}`}></i>
                </div>
              </div>
              <Collapse in={configOpen}>
                <div className="card-body">
                  <Row className="mb-4">
                    <Col lg={4} className="mb-3">
                      <Card>
                        <Card.Header>
                          <h6 className="mb-0">
                            <i className="bi bi-building me-2"></i>
                            Company & Currency
                          </h6>
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
                          <h6 className="mb-0">
                            <i className="bi bi-cash-stack me-2"></i>
                            Salary & Stock Price
                          </h6>
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
                          <h6 className="mb-0">
                            <i className="bi bi-percent me-2"></i>
                            Bonus Configuration
                          </h6>
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
                  <Row>
                    <Col>
                      <Card>
                        <Card.Header>
                          <h6 className="mb-0">
                            <i className="bi bi-graph-up me-2"></i>
                            RSU Grants Management
                          </h6>
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
                </div>
              </Collapse>
            </div>
          </Col>
        </Row>

        {/* Total Compensation Section */}
        <Row className="mb-3">
          <Col>
            <div className="card border-0 shadow-sm">
              <div
                className="card-header bg-light border-0 py-2 cursor-pointer"
                onClick={() => setCompensationOpen(!compensationOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-bar-chart me-2"></i>
                    Total Compensation
                  </h6>
                  <i className={`bi bi-chevron-${compensationOpen ? 'up' : 'down'}`}></i>
                </div>
              </div>
              <Collapse in={compensationOpen}>
                <div className="card-body">
                  <Row>
                    <Col lg={8} className="mb-3">
                      <Card>
                        <Card.Header>
                          <h6 className="mb-0">
                            <i className="bi bi-graph-up me-2"></i>
                            Projection Chart
                          </h6>
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
                          <h6 className="mb-0">
                            <i className="bi bi-table me-2"></i>
                            Yearly Breakdown
                          </h6>
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
                </div>
              </Collapse>
            </div>
          </Col>
        </Row>

        {/* Stock Price History Section */}
        {compensationData.rsuGrants.length > 0 && (
          <Row className="mb-3">
            <Col>
              <div className="card border-0 shadow-sm">
                <div
                  className="card-header bg-light border-0 py-2 cursor-pointer"
                  onClick={() => setStockHistoryOpen(!stockHistoryOpen)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold">
                      <i className="bi bi-graph-up-arrow me-2"></i>
                      Stock Price History
                    </h6>
                    <i className={`bi bi-chevron-${stockHistoryOpen ? 'up' : 'down'}`}></i>
                  </div>
                </div>
                <Collapse in={stockHistoryOpen}>
                  <div className="card-body">
                    <StockPriceChart
                      company={compensationData.company}
                      currency={compensationData.rsuCurrency}
                      rsuGrants={compensationData.rsuGrants}
                      vestingSchedule={compensationData.vestingSchedule || []}
                    />
                  </div>
                </Collapse>
              </div>
            </Col>
          </Row>
        )}

        {/* Footer */}
        <Row className="mt-5">
          <Col>
            <hr />
            <p className="text-center text-muted small">
              TC Calculator - Your data is stored locally in your browser
            </p>
          </Col>
        </Row>
      </Container>

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        <Toast
          show={showCopyToast}
          onClose={() => setShowCopyToast(false)}
          delay={3000}
          autohide
          bg="success"
        >
          <Toast.Header>
            <i className="bi bi-check-circle-fill text-success me-2"></i>
            <strong className="me-auto">Success</strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            Share URL copied to clipboard!
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

export default App;
