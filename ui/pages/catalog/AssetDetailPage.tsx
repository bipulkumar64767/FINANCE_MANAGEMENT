import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, Percent, Wallet, Calendar, ImageOff,
  Calculator, ChevronDown, ChevronUp, BadgeIndianRupee, FileText,
} from 'lucide-react';
import { getAsset, calculateEmi } from '../../lib/api';
import { Card, Badge, Button, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency } from '../../lib/utils';
import type { Asset, EMIResult } from '../../types';

const MIN_TENURE = 6;
const SCHEDULE_PREVIEW_ROWS = 6;

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // EMI calculator state
  const [financeAmount, setFinanceAmount] = useState<number>(0);
  const [tenureMonths, setTenureMonths] = useState<number>(MIN_TENURE);
  const [emiResult, setEmiResult] = useState<EMIResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [showAllSchedule, setShowAllSchedule] = useState(false);

  const fetchAsset = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const fetched = await getAsset(id);
      if (!fetched) {
        setNotFound(true);
        return;
      }

      setAsset(fetched);
      setFinanceAmount(fetched.price);
      setTenureMonths(Math.min(MIN_TENURE, fetched.max_tenure_months));
    } catch (err) {
      console.error('Error fetching asset:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  const calculate = useCallback(async () => {
    if (!asset || !financeAmount || !tenureMonths) return;
    setCalculating(true);
    setCalcError(null);
    try {
      const result = await calculateEmi(financeAmount, asset.interest_rate, tenureMonths);
      setEmiResult(result);
      setShowAllSchedule(false);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Failed to calculate EMI');
      setEmiResult(null);
    } finally {
      setCalculating(false);
    }
  }, [asset, financeAmount, tenureMonths]);

  // Recalculate when inputs change
  useEffect(() => {
    if (asset && financeAmount && tenureMonths) {
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeAmount, tenureMonths, asset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (notFound || !asset) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <EmptyState
            icon={<Package className="w-7 h-7" />}
            title="Asset not found"
            description="The asset you're looking for doesn't exist or may have been removed."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate('/catalog')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to catalog
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const financeMin = asset.finance_min ?? asset.price;
  const financeMax = asset.finance_max ?? asset.price;
  const maxTenure = asset.max_tenure_months;
  const schedule = emiResult?.schedule ?? [];
  const visibleSchedule = showAllSchedule ? schedule : schedule.slice(0, SCHEDULE_PREVIEW_ROWS);
  const hiddenCount = schedule.length - SCHEDULE_PREVIEW_ROWS;

  const amountError =
    financeAmount < financeMin
      ? `Minimum finance amount is ${formatCurrency(financeMin)}`
      : financeAmount > financeMax
        ? `Maximum finance amount is ${formatCurrency(financeMax)}`
        : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/catalog"
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to catalog
      </Link>

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-slate-100">
            {asset.image_url ? (
              <img
                src={asset.image_url}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <ImageOff className="w-12 h-12 mb-2" />
                <span className="text-sm">No image available</span>
              </div>
            )}
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            {asset.category && (
              <Badge className="bg-blue-50 text-blue-700 px-2.5 py-1">
                {asset.category.name}
              </Badge>
            )}
            <Badge className="bg-emerald-50 text-emerald-700 px-2.5 py-1">
              Available
            </Badge>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{asset.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {asset.brand}
            {asset.model ? ` · ${asset.model}` : ''}
          </p>

          {asset.description && (
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              {asset.description}
            </p>
          )}

          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <StatTile
              icon={<BadgeIndianRupee className="w-4 h-4" />}
              label="Price"
              value={formatCurrency(asset.price)}
            />
            <StatTile
              icon={<Percent className="w-4 h-4" />}
              label="Interest rate"
              value={`${asset.interest_rate}% p.a.`}
            />
            <StatTile
              icon={<Wallet className="w-4 h-4" />}
              label="Finance range"
              value={`${formatCurrency(financeMin)} – ${formatCurrency(financeMax)}`}
            />
            <StatTile
              icon={<Calendar className="w-4 h-4" />}
              label="Max tenure"
              value={`${maxTenure} months`}
            />
          </div>

          <div className="mt-auto pt-6">
            <Button
              size="lg"
              className="w-full"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => navigate(`/applications/new?assetId=${asset.id}`)}
            >
              Apply for Finance
            </Button>
          </div>
        </Card>
      </div>

      {/* EMI Calculator */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">EMI Calculator</h2>
            <p className="text-xs text-slate-500">Estimate your monthly installment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-5">
            {/* Finance amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Finance amount</label>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(financeAmount)}
                </span>
              </div>
              <input
                type="range"
                min={financeMin}
                max={financeMax}
                step={1000}
                value={financeAmount}
                onChange={(e) => setFinanceAmount(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
                <span>{formatCurrency(financeMin)}</span>
                <span>{formatCurrency(financeMax)}</span>
              </div>
              {amountError && (
                <p className="text-xs text-red-600 mt-2">{amountError}</p>
              )}
            </div>

            {/* Tenure */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Tenure</label>
                <span className="text-sm font-semibold text-slate-900">
                  {tenureMonths} months
                </span>
              </div>
              <input
                type="range"
                min={MIN_TENURE}
                max={maxTenure}
                step={1}
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
                <span>{MIN_TENURE} months</span>
                <span>{maxTenure} months</span>
              </div>
            </div>

            {/* Applied rate */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50">
              <span className="text-sm text-slate-600">Interest rate applied</span>
              <span className="text-sm font-semibold text-slate-900">
                {asset.interest_rate}% p.a.
              </span>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {calculating ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="w-7 h-7" />
              </div>
            ) : calcError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-700">{calcError}</p>
              </div>
            ) : emiResult ? (
              <>
                {/* Headline EMI */}
                <div className="p-5 rounded-2xl bg-slate-900 text-white">
                  <p className="text-xs text-slate-300 uppercase tracking-wide">
                    Monthly EMI
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(emiResult.emi)}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    for {tenureMonths} months
                  </p>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500">Principal</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCurrency(emiResult.principal)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500">Total interest</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCurrency(emiResult.totalInterest)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 col-span-2 bg-slate-50">
                    <p className="text-xs text-slate-500">Total payable</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {formatCurrency(emiResult.totalPayable)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                Adjust the sliders to calculate your EMI
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Amortization schedule */}
      {emiResult && emiResult.schedule.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Amortization Schedule</h2>
            <span className="text-xs text-slate-500">
              {schedule.length} installments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-2.5 pr-4 font-medium">#</th>
                  <th className="py-2.5 pr-4 font-medium">Due date</th>
                  <th className="py-2.5 pr-4 font-medium text-right">EMI</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Principal</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Interest</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSchedule.map((row) => (
                  <tr key={row.installmentNumber} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {row.installmentNumber}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {new Date(row.dueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-900 font-medium">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">
                      {formatCurrency(row.principal)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">
                      {formatCurrency(row.interest)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {visibleSchedule.length > 0 && (
                  <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="py-2.5 pr-4" colSpan={2}>Total</td>
                    <td className="py-2.5 pr-4 text-right">
                      {formatCurrency(
                        visibleSchedule.reduce((s, r) => s + r.amount, 0)
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {formatCurrency(
                        visibleSchedule.reduce((s, r) => s + r.principal, 0)
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {formatCurrency(
                        visibleSchedule.reduce((s, r) => s + r.interest, 0)
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-400">—</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllSchedule((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showAllSchedule ? (
                <>
                  Show less <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show all {schedule.length} installments
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-200">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
