import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, FileText, IndianRupee, TrendingUp, Percent,
  Package, Layers,
} from 'lucide-react';
import { getApplications, getPayments, getEmiSchedules } from '../../lib/api';
import {
  Card, EmptyState, Spinner, Select,
} from '../../components/ui';
import {
  formatCurrency, statusColors,
} from '../../lib/utils';
import type {
  FinanceApplication, ApplicationStatus, Payment, EMISchedule,
} from '../../types';

type DateRange = 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL';

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'MONTH', label: 'This Month' },
  { value: 'QUARTER', label: 'Last 3 Months' },
  { value: 'YEAR', label: 'This Year' },
  { value: 'ALL', label: 'All Time' },
];

function rangeStartDate(range: DateRange): Date | null {
  if (range === 'ALL') return null;
  const now = new Date();
  if (range === 'MONTH') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === 'QUARTER') {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  // YEAR
  return new Date(now.getFullYear(), 0, 1);
}

interface AssetCount {
  name: string;
  count: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('QUARTER');

  const [applications, setApplications] = useState<FinanceApplication[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [emiSchedules, setEmiSchedules] = useState<EMISchedule[]>([]);
  const [topAssets, setTopAssets] = useState<AssetCount[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [appsData, paymentsData, emiData] = await Promise.all([
          getApplications(),
          getPayments(),
          getEmiSchedules(),
        ]);

        if (cancelled) return;

        setApplications(appsData);
        setPayments(paymentsData);
        setEmiSchedules(emiData);

        const assetMap: Record<string, number> = {};
        for (const app of appsData) {
          const name = app.asset_name || 'Unspecified';
          assetMap[name] = (assetMap[name] || 0) + 1;
        }
        const top = Object.entries(assetMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopAssets(top);
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Apply date range filtering on created_at for applications & payments
  const startDate = rangeStartDate(range);

  const filteredApps = useMemo(() => {
    if (!startDate) return applications;
    return applications.filter((a) => new Date(a.created_at) >= startDate!);
  }, [applications, startDate]);

  const filteredPayments = useMemo(() => {
    if (!startDate) return payments;
    return payments.filter((p) => new Date(p.created_at) >= startDate!);
  }, [payments, startDate]);

  const stats = useMemo(() => {
    const totalApplications = filteredApps.length;
    const totalDisbursed = filteredApps
      .filter((a) => a.status === 'DISBURSED' || a.status === 'CLOSED')
      .reduce((sum, a) => sum + (a.finance_amount || 0), 0);
    const totalEmiCollected = filteredPayments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const decided = filteredApps.filter(
      (a) => a.status === 'APPROVED' || a.status === 'REJECTED' ||
             a.status === 'DISBURSED' || a.status === 'CLOSED'
    );
    const approved = filteredApps.filter(
      (a) => a.status === 'APPROVED' || a.status === 'DISBURSED' || a.status === 'CLOSED'
    );
    const approvalRate = decided.length > 0
      ? Math.round((approved.length / decided.length) * 100)
      : 0;

    return { totalApplications, totalDisbursed, totalEmiCollected, approvalRate };
  }, [filteredApps, filteredPayments]);

  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const app of filteredApps) {
      dist[app.status] = (dist[app.status] || 0) + 1;
    }
    const total = filteredApps.length || 1;
    return Object.entries(dist)
      .map(([status, count]) => ({
        status: status as ApplicationStatus,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredApps]);

  const totalReceivable = useMemo(() => {
    return emiSchedules
      .filter((e) => e.status === 'PENDING' || e.status === 'OVERDUE')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [emiSchedules]);

  const maxStatusCount = useMemo(
    () => Math.max(1, ...statusDistribution.map((s) => s.count)),
    [statusDistribution]
  );

  const maxAssetCount = useMemo(
    () => Math.max(1, ...topAssets.map((a) => a.count)),
    [topAssets]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Platform-wide performance and portfolio insights
          </p>
        </div>
        <div className="sm:w-48">
          <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<FileText className="w-5 h-5" />}
          label="Total Applications"
          value={stats.totalApplications.toString()}
          accent="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={<IndianRupee className="w-5 h-5" />}
          label="Total Disbursed"
          value={formatCurrency(stats.totalDisbursed)}
          accent="bg-teal-50 text-teal-600"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="EMI Collected"
          value={formatCurrency(stats.totalEmiCollected)}
          accent="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          icon={<Percent className="w-5 h-5" />}
          label="Approval Rate"
          value={`${stats.approvalRate}%`}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Application Status Distribution
              </h2>
              <p className="text-xs text-slate-500">
                {stats.totalApplications} applications in selected period
              </p>
            </div>
          </div>

          {statusDistribution.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No application data for this period.
            </div>
          ) : (
            <div className="space-y-3.5">
              {statusDistribution.map((s) => {
                const sc = statusColors[s.status];
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{sc.label}</span>
                      <span className="text-xs text-slate-500">
                        {s.count} <span className="text-slate-300">·</span> {s.percent}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${sc.bg.replace('100', '400')}`}
                        style={{ width: `${(s.count / maxStatusCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top assets */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Top Assets by Applications
              </h2>
              <p className="text-xs text-slate-500">Most financed assets (all time)</p>
            </div>
          </div>

          {topAssets.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No asset data available yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {topAssets.map((asset, idx) => (
                <div key={asset.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{asset.name}</span>
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                      {asset.count} {asset.count === 1 ? 'app' : 'apps'}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 transition-all duration-500"
                      style={{ width: `${(asset.count / maxAssetCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Outstanding receivables */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Layers className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Outstanding Receivables</h2>
            <p className="text-xs text-slate-500">Pending &amp; overdue EMI installments</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ReceivableTile
            label="Pending EMI"
            amount={emiSchedules.filter((e) => e.status === 'PENDING').reduce((s, e) => s + e.amount, 0)}
            tone="bg-amber-50 text-amber-700 border-amber-100"
          />
          <ReceivableTile
            label="Overdue EMI"
            amount={emiSchedules.filter((e) => e.status === 'OVERDUE').reduce((s, e) => s + e.amount, 0)}
            tone="bg-red-50 text-red-700 border-red-100"
          />
          <ReceivableTile
            label="Total Receivable"
            amount={totalReceivable}
            tone="bg-slate-900 text-white border-slate-900"
          />
        </div>
      </Card>

      {/* Empty state if absolutely no data */}
      {stats.totalApplications === 0 && topAssets.length === 0 && (
        <Card className="p-6">
          <EmptyState
            icon={<BarChart3 className="w-7 h-7" />}
            title="No data for this period"
            description="There are no applications or payments in the selected date range. Try expanding the range."
          />
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 truncate">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ReceivableTile({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-4 ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-bold mt-1.5">{formatCurrency(amount)}</p>
    </div>
  );
}
