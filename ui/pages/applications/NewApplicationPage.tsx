import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Package, Search, Check, ChevronLeft, ArrowRight,
  ShieldCheck, Info, Calculator, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssets, getProfiles, generateApplicationNumber, createApplication, manageApplication } from '../../lib/api';
import { calculateEMI as calcLocalEMI } from '../../lib/utils';
import { Button, Input, Select, Card, Badge, EmptyState, Spinner } from '../../components/ui';
import { EMICalculatorModal } from '../../components/EMICalculatorModal';
import { formatCurrency } from '../../lib/utils';
import type { Asset, EMIResult } from '../../types';

const STEPS = ['Select Asset', 'Finance Details', 'Review & Submit'];

const EMPLOYMENT_OPTIONS = [
  { value: 'Salaried', label: 'Salaried' },
  { value: 'Self-Employed', label: 'Self-Employed' },
  { value: 'Business', label: 'Business' },
];

interface AssetRow extends Omit<Asset, 'category'> {
  category: { name: string } | null;
}

export default function NewApplicationPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAssetId = searchParams.get('assetId');

  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetSearch, setAssetSearch] = useState('');

  // Form state
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [employmentType, setEmploymentType] = useState<string>('Salaried');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  // Retailer -> select customer to raise application for
  const [customers, setCustomers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [financeAmount, setFinanceAmount] = useState<number>(0);
  const [emiPreview, setEmiPreview] = useState<EMIResult | null>(null);
  const [showCalculationHint, setShowCalculationHint] = useState(false);

  // EMI Calculator Modal
  const [showEMIModal, setShowEMIModal] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- Fetch assets -----
  useEffect(() => {
    (async () => {
      setAssetsLoading(true);
      try {
        const data = await getAssets('AVAILABLE');
        setAssets((data as AssetRow[]) || []);
      } catch (err) {
        console.error('Error fetching assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    })();
  }, []);

  // ----- Pre-select asset from URL -----
  useEffect(() => {
    if (!presetAssetId || assets.length === 0) return;
    const found = assets.find((a) => a.id === presetAssetId);
    if (found) {
      setSelectedAsset(found);
      setStep(1);
      setTenureMonths(Math.min(12, found.max_tenure_months));
      setFinanceAmount(found.finance_min);
      setDownPayment(found.price - found.finance_min);
      setEmiPreview(null);
      setShowCalculationHint(true);
    }
  }, [presetAssetId, assets]);

  // ----- If user is a retailer, fetch associated customers -----
  useEffect(() => {
    if (!profile || profile.role !== 'RETAILER') return;
    (async () => {
      try {
        setCustomersLoading(true);
        const list = await getProfiles({ role: 'CUSTOMER' });
        setCustomers(list || []);
        // auto-select first customer if only one
        if (list && list.length === 1) setSelectedCustomerId(list[0].id);
      } catch (e) {
        console.error('Failed to load retailer customers', e);
      } finally {
        setCustomersLoading(false);
      }
    })();
  }, [profile]);

  const financeAmountComputed = useMemo(() => {
    if (!selectedAsset) return 0;
    return Math.max(0, selectedAsset.price - downPayment);
  }, [selectedAsset, downPayment]);

  // ----- Validation -----
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!selectedAsset) {
      errors.asset = 'Please select an asset';
      return errors;
    }
    if (downPayment < 0) errors.down_payment = 'Down payment cannot be negative';
    const fAmount = financeAmount || financeAmountComputed;
    if (fAmount < selectedAsset.finance_min) {
      errors.finance_amount = `Finance amount must be at least ${formatCurrency(
        selectedAsset.finance_min
      )}`;
    }
    if (fAmount > selectedAsset.finance_max) {
      errors.finance_amount = `Finance amount cannot exceed ${formatCurrency(
        selectedAsset.finance_max
      )}`;
    }
    if (fAmount <= 0) errors.finance_amount = 'Finance amount must be greater than zero';
    if (tenureMonths < 1) errors.tenure_months = 'Tenure must be at least 1 month';
    if (tenureMonths > selectedAsset.max_tenure_months) {
      errors.tenure_months = `Tenure cannot exceed ${selectedAsset.max_tenure_months} months`;
    }
    if (monthlyIncome <= 0) errors.monthly_income = 'Please enter your monthly income';
    if (profile?.role === 'RETAILER' && !selectedCustomerId) {
      errors.customer_required = 'Please select a customer to raise this application for';
    }
    return errors;
  }, [selectedAsset, downPayment, financeAmount, financeAmountComputed, tenureMonths, monthlyIncome, profile, selectedCustomerId]);

  const isStep2Valid = Object.keys(validationErrors).length === 0;

  // ----- Handle EMI modal confirmation -----
  const handleEMIConfirm = (fAmount: number, tenure: number, emiResult: EMIResult) => {
    setFinanceAmount(fAmount);
    setDownPayment(selectedAsset ? selectedAsset.price - fAmount : 0);
    setTenureMonths(tenure);
    setEmiPreview(emiResult);
  };

  const handleSelectAsset = (asset: AssetRow) => {
    setSelectedAsset(asset);
    setFinanceAmount(asset.finance_min);
    setDownPayment(asset.price - asset.finance_min);
    setTenureMonths(Math.min(12, asset.max_tenure_months));
    setEmiPreview(null);
    setShowCalculationHint(true);
    setStep(1);
  };

  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return assets;
    const q = assetSearch.trim().toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        (a.model || '').toLowerCase().includes(q)
    );
  }, [assets, assetSearch]);

  const handleSubmit = async () => {
    if (!profile || !selectedAsset || !isStep2Valid) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!emiPreview) {
        const principal = financeAmount || financeAmountComputed;
        const emi = calcLocalEMI(principal, selectedAsset.interest_rate, tenureMonths);
        const totalPayable = Math.round(emi * tenureMonths);
        const totalInterest = Math.round(totalPayable - principal);
        setEmiPreview({ emi: Math.round(emi), principal, totalPayable, totalInterest, schedule: [] });
      }

      // 1. Generate application number
      const appNumber = await generateApplicationNumber();

      const retailerId = profile.role === 'RETAILER' ? profile.id : null;
      const customerId = profile.role === 'RETAILER' ? (selectedCustomerId || profile.id) : profile.id;

      const emi = emiPreview?.emi ?? Math.round(calcLocalEMI(financeAmount || financeAmountComputed, selectedAsset.interest_rate, tenureMonths));
      const totalPayable = emiPreview?.totalPayable ?? Math.round((financeAmount || financeAmountComputed) * tenureMonths);

      const inserted = await createApplication({
        application_number: appNumber,
        customer_id: customerId,
        retailer_id: retailerId,
        asset_id: selectedAsset.id,
        asset_name: selectedAsset.name,
        asset_price: selectedAsset.price,
        finance_amount: financeAmount,
        down_payment: downPayment,
        interest_rate: selectedAsset.interest_rate,
        tenure_months: tenureMonths,
        monthly_emi: emi,
        total_payable: totalPayable,
        status: 'DRAFT',
        employment_type: employmentType,
        monthly_income: monthlyIncome,
      });

      if (!inserted) throw new Error('Failed to create application');

      try {
        await manageApplication({
          action: 'SUBMIT',
          applicationId: inserted.id,
        });
      } catch (submitErr) {
        // Submission failed but the draft was created — navigate to detail so the user can retry.
        console.error('Submit action failed:', submitErr);
        navigate(`/applications/${inserted.id}`, {
          state: { error: 'Application was saved as a draft but submission failed. Please retry from the detail page.' },
        });
        return;
      }

      navigate(`/applications/${inserted.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create application';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const canGoNext = step === 0 ? selectedAsset !== null : step === 1 ? isStep2Valid : true;

  // Advance handler: if EMI not computed yet, compute locally before moving to review
  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
      return;
    }

    if (step === 1) {
      // ensure validation passes
      if (!isStep2Valid) return;

      // if EMI preview already exists, just go next
      if (emiPreview) {
        setStep(2);
        return;
      }

      // compute EMI locally as fallback (no API call) and proceed
      try {
        const principal = financeAmount || financeAmountComputed;
        const emi = calcLocalEMI(principal, selectedAsset?.interest_rate ?? 0, tenureMonths);
        const totalPayable = Math.round(emi * tenureMonths);
        const totalInterest = Math.round(totalPayable - principal);
        setEmiPreview({ emi: Math.round(emi), principal, totalPayable, totalInterest, schedule: [] });
      } catch (e) {
        console.error('Local EMI calc failed', e);
      }

      setStep(2);
      return;
    }

    setStep((s) => Math.min(2, s + 1));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Finance Application</h1>
          <p className="text-sm text-slate-500 mt-1">
            Apply for asset financing in a few simple steps
          </p>
        </div>
        <Link to="/applications">
          <Button variant="ghost" size="sm">Cancel</Button>
        </Link>
      </div>

      {/* Progress indicator */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all ${
                    idx < step
                      ? 'bg-emerald-500 text-white'
                      : idx === step
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {idx < step ? <Check className="w-5 h-5" /> : idx + 1}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      idx <= step ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 sm:mx-4 rounded-full transition-all ${
                    idx < step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step content */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* STEP 1: Asset Selection */}
      {step === 0 && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search assets by name, brand, or model..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
              />
            </div>

            {assetsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-8 h-8" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <EmptyState
                icon={<Package className="w-7 h-7" />}
                title="No assets available"
                description="There are no assets available for financing at the moment. Please check back later."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {asset.image_url ? (
                            <img
                              src={asset.image_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{asset.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {asset.brand}{asset.model ? ` · ${asset.model}` : ''}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(asset.price)}
                            </span>
                            {asset.category && (
                              <Badge className="bg-slate-100 text-slate-600">
                                {asset.category.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Finance {formatCurrency(asset.finance_min)}–{formatCurrency(asset.finance_max)} · {asset.interest_rate}% p.a.
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* STEP 2: Finance Details */}
      {step === 1 && selectedAsset && (
        <Card className="p-8 text-center space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Calculate Your EMI</h2>
            <p className="text-slate-500 mt-2">
              Let's customize your financing terms for this asset
            </p>
          </div>

          {/* Asset summary */}
          <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="w-16 h-16 rounded-xl bg-white border border-blue-200 flex items-center justify-center overflow-hidden">
              {selectedAsset.image_url ? (
                <img
                  src={selectedAsset.image_url}
                  alt={selectedAsset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm text-slate-600">Selected Asset</p>
              <p className="text-lg font-semibold text-slate-900">{selectedAsset.name}</p>
              <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(selectedAsset.price)}</p>
            </div>
          </div>

          {/* Employment details for calculation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                <Select
                  label="Employment Type"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
                <Input
                  label="Monthly Income"
                  type="number"
                  min={0}
                  value={monthlyIncome || ''}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                  error={validationErrors.monthly_income}
                />
              </div>

              {profile?.role === 'RETAILER' && (
                <div className="max-w-md mx-auto mt-4">
                  <Select
                    label="Customer"
                    value={selectedCustomerId || ''}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">Select a customer...</option>
                    {customersLoading ? (
                      <option value="">Loading customers…</option>
                    ) : (
                      customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>
                      ))
                    )}
                  </Select>
                  {validationErrors.customer_required && (
                    <p className="text-xs text-red-600 mt-1">{validationErrors.customer_required}</p>
                  )}
                </div>
              )}

          <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Finance Amount"
                type="number"
                min={selectedAsset.finance_min}
                max={selectedAsset.finance_max}
                value={financeAmount}
                onChange={(e) => setFinanceAmount(Number(e.target.value))}
                error={validationErrors.finance_amount}
              />
              <Input
                label="Down Payment"
                type="number"
                min={0}
                max={selectedAsset.price - selectedAsset.finance_min}
                value={downPayment}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setDownPayment(value);
                  setFinanceAmount(Math.max(0, selectedAsset.price - value));
                }}
                error={validationErrors.down_payment}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Finance amount range</label>
              <div className="text-sm text-slate-500">
                {formatCurrency(selectedAsset.finance_min)} - {formatCurrency(selectedAsset.finance_max)}
              </div>
            </div>
          </div>

          {/* EMI Calculator Button */}
          <Button
            className="mx-auto mt-4"
            icon={<Calculator className="w-4 h-4" />}
            onClick={() => setShowEMIModal(true)}
            disabled={monthlyIncome <= 0}
          >
            Open EMI Calculator
          </Button>
          {showCalculationHint && !emiPreview && (
            <p className="text-sm text-slate-500 mt-3 max-w-2xl mx-auto">
              Enter your income and finance amount, then open the EMI calculator or press Next to compute a preview.
            </p>
          )}

          {/* EMI Modal */}
          {selectedAsset && (
            <EMICalculatorModal
              open={showEMIModal}
              onClose={() => setShowEMIModal(false)}
              assetPrice={selectedAsset.price}
              interestRate={selectedAsset.interest_rate}
              maxTenureMonths={selectedAsset.max_tenure_months}
              minTenureMonths={1}
              financeMin={selectedAsset.finance_min}
              financeMax={selectedAsset.finance_max}
              onConfirm={handleEMIConfirm}
            />
          )}

          {/* Show details after selection */}
          {emiPreview && financeAmount > 0 && (
            <div className="max-w-md mx-auto p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
              <p className="text-sm text-emerald-600 font-medium uppercase">Your EMI Details</p>
              <p className="text-4xl font-bold text-emerald-700 mt-3">{formatCurrency(emiPreview.emi)}/mo</p>
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-emerald-200">
                <div>
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Finance</p>
                  <p className="text-sm font-bold text-emerald-900 mt-1">{formatCurrency(financeAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Tenure</p>
                  <p className="text-sm font-bold text-emerald-900 mt-1">{tenureMonths}m</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Total</p>
                  <p className="text-sm font-bold text-emerald-900 mt-1">{formatCurrency(emiPreview.totalPayable)}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* STEP 3: Review & Submit */}
      {step === 2 && selectedAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Review Your Application</h2>
              <p className="text-sm text-slate-500">
                Please review all details before submitting. You won't be able to edit after submission.
              </p>

              {/* Asset */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selectedAsset.image_url ? (
                    <img
                      src={selectedAsset.image_url}
                      alt={selectedAsset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-7 h-7 text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{selectedAsset.name}</p>
                  <p className="text-xs text-slate-500">{selectedAsset.brand}{selectedAsset.model ? ` · ${selectedAsset.model}` : ''}</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    {formatCurrency(selectedAsset.price)}
                  </p>
                </div>
              </div>

              {/* Finance summary */}
              <div className="grid grid-cols-2 gap-4">
                <SummaryItem label="Down Payment" value={formatCurrency(downPayment)} />
                <SummaryItem label="Finance Amount" value={formatCurrency(financeAmount)} />
                <SummaryItem label="Interest Rate" value={`${selectedAsset.interest_rate}% p.a.`} />
                <SummaryItem label="Tenure" value={`${tenureMonths} months`} />
                <SummaryItem
                  label="Monthly EMI"
                  value={emiPreview ? formatCurrency(emiPreview.emi) : '—'}
                  highlight
                />
                <SummaryItem
                  label="Total Payable"
                  value={emiPreview ? formatCurrency(emiPreview.totalPayable) : '—'}
                  highlight
                />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Employment Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <SummaryItem label="Employment Type" value={employmentType} />
                <SummaryItem label="Monthly Income" value={formatCurrency(monthlyIncome)} />
              </div>
            </Card>
          </div>

          {/* Right column: EMI snapshot */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-semibold text-slate-900">Loan Summary</h3>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700 uppercase tracking-wide">Monthly EMI</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {emiPreview ? formatCurrency(emiPreview.emi) : '—'}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Principal</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrency(financeAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Total Interest</span>
                    <span className="text-sm font-medium text-slate-900">
                      {emiPreview ? formatCurrency(emiPreview.totalInterest) : '—'}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Total Payable</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {emiPreview ? formatCurrency(emiPreview.totalPayable) : '—'}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  By submitting, you confirm the provided details are accurate. Your application will be
                  reviewed by our finance team.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          icon={<ChevronLeft className="w-4 h-4" />}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>

        {step < 2 ? (
          <Button
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={handleNext}
            disabled={!canGoNext}
          >
            Next
          </Button>
        ) : (
          <Button
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!isStep2Valid}
          >
            Submit Application
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3.5 rounded-xl ${highlight ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
      <p className={`text-xs ${highlight ? 'text-slate-300' : 'text-slate-500'} uppercase tracking-wide`}>
        {label}
      </p>
      <p className={`text-sm font-semibold mt-1 ${highlight ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
