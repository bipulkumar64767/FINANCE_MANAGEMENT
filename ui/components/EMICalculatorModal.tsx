import { useState, useEffect, useMemo } from 'react';
import {
  X, TrendingUp, Wallet, Calendar, AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { calculateEmi } from '../lib/api';
import type { EMIResult } from '../types';

interface EMICalculatorModalProps {
  open: boolean;
  onClose: () => void;
  assetPrice: number;
  interestRate: number;
  maxTenureMonths: number;
  minTenureMonths?: number;
  financeMin: number;
  financeMax: number;
  onConfirm: (financeAmount: number, tenureMonths: number, emiDetails: EMIResult) => void;
}

export function EMICalculatorModal({
  open,
  onClose,
  assetPrice,
  interestRate,
  maxTenureMonths,
  minTenureMonths = 1,
  financeMin,
  financeMax,
  onConfirm,
}: EMICalculatorModalProps) {
  const [financeAmount, setFinanceAmount] = useState<number>(financeMin);
  const [downPayment, setDownPayment] = useState<number>(assetPrice - financeMin);
  const [tenureMonths, setTenureMonths] = useState<number>(Math.min(24, maxTenureMonths));
  const [emiResult, setEmiResult] = useState<EMIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch EMI on amount/tenure change
  useEffect(() => {
    if (financeAmount <= 0 || tenureMonths <= 0) {
      setEmiResult(null);
      return;
    }

    const fetchEMI = async () => {
      setLoading(true);
      try {
        const result = await calculateEmi(financeAmount, interestRate, tenureMonths);
        setEmiResult(result);
        setError(null);
      } catch (err) {
        console.error('EMI calculation error:', err);
        setError('Failed to calculate EMI');
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchEMI, 300);
    return () => clearTimeout(t);
  }, [financeAmount, tenureMonths, interestRate]);

  // Update finance amount when down payment changes
  const handleDownPaymentChange = (value: number) => {
    const newDownPayment = value;
    const newFinance = assetPrice - newDownPayment;
    if (newFinance >= financeMin && newFinance <= financeMax) {
      setDownPayment(newDownPayment);
      setFinanceAmount(newFinance);
    }
  };

  // Update down payment when finance amount changes
  const handleFinanceAmountChange = (value: number) => {
    if (value >= financeMin && value <= financeMax) {
      setFinanceAmount(value);
      setDownPayment(assetPrice - value);
    }
  };

  const handleConfirm = () => {
    if (!emiResult || financeAmount <= 0 || tenureMonths <= 0) return;
    onConfirm(financeAmount, tenureMonths, emiResult);
    onClose();
  };

  const isValid = financeAmount >= financeMin && financeAmount <= financeMax && tenureMonths >= minTenureMonths && tenureMonths <= maxTenureMonths;
  const downPaymentPercent = ((downPayment / assetPrice) * 100).toFixed(1);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm sm:max-w-lg bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">EMI Calculator</h2>
              <p className="text-xs sm:text-sm text-blue-100 truncate">Adjust amount & tenure to see your payment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Main content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Asset info card */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200">
            <p className="text-xs sm:text-sm text-slate-600 mb-1">Asset Price</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(assetPrice)}</p>
          </div>

          {/* Two column layout - stacked on mobile */}
          <div className="grid grid-cols-1 gap-4">
            {/* Finance Amount */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                  <Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Finance Amount</span>
                </label>
                <input
                  type="range"
                  min={financeMin}
                  max={financeMax}
                  step={1000}
                  value={financeAmount}
                  onChange={(e) => handleFinanceAmountChange(Number(e.target.value))}
                  className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5 sm:p-3 border border-blue-200">
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{formatCurrency(financeAmount)}</p>
                <p className="text-xs text-blue-600 mt-1">min: {formatCurrency(financeMin)} • max: {formatCurrency(financeMax)}</p>
              </div>
            </div>

            {/* Down Payment */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                  <Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">Down Payment ({downPaymentPercent}%)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={assetPrice - financeMin}
                  step={1000}
                  value={downPayment}
                  onChange={(e) => handleDownPaymentChange(Number(e.target.value))}
                  className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
              <div className="bg-emerald-50 rounded-lg p-2.5 sm:p-3 border border-emerald-200">
                <p className="text-lg sm:text-2xl font-bold text-emerald-700">{formatCurrency(downPayment)}</p>
                <p className="text-xs text-emerald-600 mt-1">Payment upfront</p>
              </div>
            </div>
          </div>

          {/* Tenure Months */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
              <Calendar className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-purple-600 flex-shrink-0" />
              <span className="truncate">Loan Duration</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={minTenureMonths}
                max={maxTenureMonths}
                step={1}
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                className="flex-1 h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="bg-purple-50 rounded-lg px-3 sm:px-4 py-2 border border-purple-200 min-w-fit text-center">
                <p className="text-base sm:text-lg font-bold text-purple-700">{tenureMonths}m</p>
                <p className="text-xs text-purple-600">{minTenureMonths}-{maxTenureMonths}m</p>
              </div>
            </div>
          </div>

          {/* EMI Result Card */}
          {emiResult && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 sm:p-5 border-2 border-dashed border-amber-300 shadow-lg">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">Monthly EMI Payment</p>
                  <p className="text-2xl sm:text-4xl font-bold text-orange-600 mt-1">{formatCurrency(emiResult.emi as number)}</p>
                </div>
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 text-orange-600" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-amber-200">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Interest Rate</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{interestRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Total Interest</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{formatCurrency(emiResult.totalInterest as number)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Total Payable</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{formatCurrency(emiResult.totalPayable as number)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-red-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Validation info */}
          {!isValid && (
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-yellow-700">
                Ensure finance amount is within range and tenure is {minTenureMonths}-{maxTenureMonths} months
              </p>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="flex gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-900 text-sm sm:text-base font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white text-sm sm:text-base font-medium transition-all disabled:cursor-not-allowed"
          >
            {loading ? 'Calculating...' : 'Apply & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
