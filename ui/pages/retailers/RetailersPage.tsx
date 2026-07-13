import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store, Search, Phone, Mail, FileText, IndianRupee,
  Eye, Building2, TrendingUp, Calendar, Plus,
} from 'lucide-react';
import { getProfiles, getApplications } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, EmptyState, Spinner, Input, Button } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { formatCurrency, formatDate, statusColors } from '../../lib/utils';
import type { Profile, FinanceApplication, UserStatus } from '../../types';

const userStatusColors: Record<UserStatus, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inactive' },
  SUSPENDED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspended' },
};

interface RetailerWithStats extends Profile {
  applicationsCount: number;
  totalFinanceAmount: number;
}

export default function RetailersPage() {
  const { profile } = useAuth();
  const [retailers, setRetailers] = useState<RetailerWithStats[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, FinanceApplication[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<RetailerWithStats | null>(null);
  const [modalApps, setModalApps] = useState<FinanceApplication[]>([]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const retailerList = await getProfiles({ role: 'RETAILER' });

        let appsByRetailer: Record<string, FinanceApplication[]> = {};
        const ids = retailerList.map((r) => r.id);
        if (ids.length > 0) {
          const appsList = await getApplications();
          appsByRetailer = appsList.reduce((acc, app) => {
            if (app.retailer_id) (acc[app.retailer_id] ||= []).push(app);
            return acc;
          }, {} as Record<string, FinanceApplication[]>);
        }

        const withStats: RetailerWithStats[] = retailerList.map((r) => {
          const apps = appsByRetailer[r.id] || [];
          const totalFinanceAmount = apps.reduce((sum, a) => sum + a.finance_amount, 0);
          return { ...r, applicationsCount: apps.length, totalFinanceAmount };
        });

        if (!cancelled) {
          setRetailers(withStats);
          setAppsMap(appsByRetailer);
        }
      } catch (err) {
        console.error('Error fetching retailers:', err);
        if (!cancelled) setError('Failed to load retailers. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return retailers;
    return retailers.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [retailers, search]);

  const openRetailer = (retailer: RetailerWithStats) => {
    setSelected(retailer);
    setModalApps(appsMap[retailer.id] || []);
  };

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Retailers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage retail partners and monitor their performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') && (
            <Link to="/retailers/onboard">
              <Button icon={<Plus className="w-4 h-4" />} size="sm">
                Onboard Retailer
              </Button>
            </Link>
          )}
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Store className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {retailers.length} {retailers.length === 1 ? 'retailer' : 'retailers'}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
        <Input
          className="pl-10"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Retailer grid */}
      {!error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Store className="w-8 h-8" />}
            title={search ? 'No matching retailers' : 'No retailers yet'}
            description={
              search
                ? 'Try a different name or email address.'
                : 'Retail partners will appear here once they register.'
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((retailer) => {
            const sc = userStatusColors[retailer.status];
            return (
              <Card
                key={retailer.id}
                className="p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
              >
                <div onClick={() => openRetailer(retailer)} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {retailer.full_name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{retailer.email}</p>
                      </div>
                    </div>
                    <Badge className={`${sc.bg} ${sc.text} flex-shrink-0`}>{sc.label}</Badge>
                  </div>

                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {retailer.phone || '—'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-xs">Applications</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {retailer.applicationsCount}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                        <IndianRupee className="w-3.5 h-3.5" />
                        <span className="text-xs">Total Finance</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(retailer.totalFinanceAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => openRetailer(retailer)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Retailer detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Retailer Details"
        size="lg"
      >
        {selected && (
          <div className="space-y-6">
            {/* Profile summary */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-8 h-8 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{selected.full_name}</h3>
                  <Badge className={`${userStatusColors[selected.status].bg} ${userStatusColors[selected.status].text}`}>
                    {userStatusColors[selected.status].label}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <p className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {selected.email}
                  </p>
                  <p className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {selected.phone || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Joined {formatDate(selected.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-medium">Applications</span>
                </div>
                <p className="text-xl font-bold text-slate-900">{selected.applicationsCount}</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Finance</span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(selected.totalFinanceAmount)}
                </p>
              </div>
            </div>

            {/* Applications list */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">
                Applications ({modalApps.length})
              </h4>
              {modalApps.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center rounded-xl border border-dashed border-slate-200">
                  No applications submitted through this retailer yet
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {modalApps.map((app) => {
                    const sc = statusColors[app.status];
                    return (
                      <div
                        key={app.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-white"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {app.asset_name || app.application_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            {app.application_number} · {formatDate(app.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(app.finance_amount)}
                          </span>
                          <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
