import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Plus, Search, Package, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApplications } from '../../lib/api';
import { Button, Badge, Card, EmptyState, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, statusColors } from '../../lib/utils';
import type { FinanceApplication, ApplicationStatus } from '../../types';

type StatusFilter = 'ALL' | ApplicationStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'DISBURSED', label: 'Disbursed' },
];

interface ApplicationRow extends Omit<FinanceApplication, 'customer' | 'retailer' | 'asset'> {
  customer: { full_name: string; email: string } | null;
  retailer: { full_name: string } | null;
  asset: {
    name: string;
    brand: string;
    price: number;
    image_url: string | null;
  } | null;
}

export default function ApplicationsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      try {
        const data = await getApplications();
        setApplications((data as ApplicationRow[]) || []);
      } catch (err) {
        console.error('Error fetching applications:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesNumber = app.application_number.toLowerCase().includes(q);
        const matchesAsset = (app.asset_name || app.asset?.name || '')
          .toLowerCase()
          .includes(q);
        if (!matchesNumber && !matchesAsset) return false;
      }
      return true;
    });
  }, [applications, statusFilter, search]);

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN';
  const isRetailer = profile?.role === 'RETAILER';

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: applications.length };
    for (const app of applications) {
      counts[app.status] = (counts[app.status] || 0) + 1;
    }
    return counts;
  }, [applications]);

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
          <h1 className="text-2xl font-bold text-slate-900">Finance Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and track all finance applications
          </p>
        </div>
        <Link to="/applications/new">
          <Button icon={<Plus className="w-4 h-4" />}>New Application</Button>
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = statusCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by application number or asset name..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title={search || statusFilter !== 'ALL' ? 'No applications found' : 'No applications yet'}
            description={
              search || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first finance application.'
            }
            action={
              !search && statusFilter === 'ALL' ? (
                <Link to="/applications/new">
                  <Button icon={<Plus className="w-4 h-4" />}>New Application</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-3">Application</div>
            <div className="col-span-2">Asset</div>
            {(isAdmin || isRetailer) && <div className="col-span-2">Customer</div>}
            <div className="col-span-1 text-right">Finance</div>
            <div className="col-span-1 text-right">EMI / mo</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Created</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((app) => {
              const sc = statusColors[app.status];
              const assetName = app.asset_name || app.asset?.name || '—';
              const colSpan = isAdmin || isRetailer ? 'lg:grid-cols-12' : 'lg:grid-cols-11';
              return (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className={`group grid grid-cols-1 ${colSpan} gap-3 lg:gap-4 px-5 py-4 hover:bg-slate-50 transition-all`}
                >
                  {/* Application number */}
                  <div className="col-span-3 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {app.application_number}
                      </p>
                      <p className="text-xs text-slate-500 lg:hidden">{assetName}</p>
                    </div>
                  </div>

                  {/* Asset (desktop) */}
                  <div className="hidden lg:block col-span-2 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{assetName}</p>
                    {app.asset?.brand && (
                      <p className="text-xs text-slate-400 truncate">{app.asset.brand}</p>
                    )}
                  </div>

                  {/* Customer (admin/retailer only) */}
                  {(isAdmin || isRetailer) && (
                    <div className="hidden lg:block col-span-2 min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {app.customer?.full_name || '—'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{app.customer?.email}</p>
                    </div>
                  )}

                  {/* Finance amount */}
                  <div className="hidden lg:block col-span-1 text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrency(app.finance_amount)}
                    </p>
                  </div>

                  {/* Monthly EMI */}
                  <div className="hidden lg:block col-span-1 text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrency(app.monthly_emi)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="hidden lg:flex col-span-1 items-center">
                    <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                  </div>

                  {/* Created at */}
                  <div className="hidden lg:flex col-span-2 items-center justify-between">
                    <span className="text-sm text-slate-500">{formatDate(app.created_at)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>

                  {/* Mobile: status + created row */}
                  <div className="lg:hidden flex items-center justify-between pt-1">
                    <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{formatDate(app.created_at)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  {/* Mobile: amounts */}
                  <div className="lg:hidden flex items-center gap-4 pt-1">
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Finance</p>
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(app.finance_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">EMI / mo</p>
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(app.monthly_emi)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
