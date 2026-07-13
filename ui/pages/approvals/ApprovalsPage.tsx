import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Clock, FileText, CheckCircle2, XCircle, ListFilter,
  User, ArrowRight, Inbox,
} from 'lucide-react';
import { getApplications } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, statusColors } from '../../lib/utils';
import type { FinanceApplication, Asset } from '../../types';

interface ApprovalApplication extends Omit<FinanceApplication, 'customer' | 'asset'> {
  customer: { full_name: string; email: string; phone: string | null } | null;
  asset: Asset | null;
}

type TabKey = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ALL';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'SUBMITTED', label: 'Pending Review', icon: <Clock className="w-4 h-4" /> },
  { key: 'UNDER_REVIEW', label: 'Under Review', icon: <FileText className="w-4 h-4" /> },
  { key: 'APPROVED', label: 'Approved', icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'REJECTED', label: 'Rejected', icon: <XCircle className="w-4 h-4" /> },
  { key: 'ALL', label: 'All', icon: <ListFilter className="w-4 h-4" /> },
];

export default function ApprovalsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<ApprovalApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('SUBMITTED');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getApplications({
          statuses: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
        });
        if (!cancelled) setApplications((data as ApprovalApplication[]) || []);
      } catch (err) {
        console.error('Error fetching approval queue:', err);
        if (!cancelled) setError('Failed to load the approval queue. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      ALL: applications.length,
    };
    for (const app of applications) {
      if (app.status in base) {
        base[app.status as TabKey] += 1;
      }
    }
    return base;
  }, [applications]);

  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return applications;
    return applications.filter((app) => app.status === activeTab);
  }, [applications, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const awaiting = counts.SUBMITTED + counts.UNDER_REVIEW;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approval Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and take action on finance applications
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm self-start">
          <CheckSquare className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {awaiting} awaiting action
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Application list */}
      {!error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="w-8 h-8" />}
            title="No applications here"
            description="There are no applications matching this filter. Switch tabs or check back later."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((app) => {
            const sc = statusColors[app.status];
            const assetName = app.asset_name || app.asset?.name || 'N/A';
            return (
              <Link key={app.id} to={`/applications/${app.id}`} className="group block">
                <Card className="p-5 h-full hover:shadow-md hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-medium text-slate-500">
                          {app.application_number}
                        </span>
                        <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 truncate">
                        {assetName}
                      </h3>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {app.customer?.full_name || 'Unknown customer'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {app.customer?.email || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Finance Amount</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(app.finance_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Monthly EMI</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(app.monthly_emi)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Submitted</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(app.submitted_at || app.created_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
