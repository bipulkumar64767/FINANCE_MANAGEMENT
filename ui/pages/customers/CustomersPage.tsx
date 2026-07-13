import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Phone, Mail, Calendar, FileText,
  IndianRupee, Eye, UserCircle, Plus,
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

interface CustomerWithStats extends Profile {
  applicationsCount: number;
  totalBorrowed: number;
}

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, FinanceApplication[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CustomerWithStats | null>(null);
  const [modalApps, setModalApps] = useState<FinanceApplication[]>([]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        let customerIds: string[] = [];
        let appsByCustomer: Record<string, FinanceApplication[]> = {};

        if (profile.role === 'RETAILER') {
          const appsList = await getApplications({ retailer_id: profile.id });
          appsByCustomer = appsList.reduce((acc, app) => {
            (acc[app.customer_id] ||= []).push(app);
            return acc;
          }, {} as Record<string, FinanceApplication[]>);
        }

        const profileList = await getProfiles({ role: 'CUSTOMER' });
        const filteredProfiles = profileList;

        if (profile.role !== 'RETAILER') {
          const ids = filteredProfiles.map((p) => p.id);
          if (ids.length > 0) {
            const appsList = await getApplications();
            appsByCustomer = appsList.reduce((acc, app) => {
              if (ids.includes(app.customer_id)) {
                (acc[app.customer_id] ||= []).push(app);
              }
              return acc;
            }, {} as Record<string, FinanceApplication[]>);
          }
        }

        const withStats: CustomerWithStats[] = filteredProfiles.map((p) => {
          const apps = appsByCustomer[p.id] || [];
          const totalBorrowed = apps.reduce((sum, a) => sum + a.finance_amount, 0);
          return { ...p, applicationsCount: apps.length, totalBorrowed };
        });

        if (!cancelled) {
          setCustomers(withStats);
          setAppsMap(appsByCustomer);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
        if (!cancelled) setError('Failed to load customers. Please try again.');
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
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openCustomer = (customer: CustomerWithStats) => {
    setSelected(customer);
    setModalApps(appsMap[customer.id] || []);
  };

  const navigate = useNavigate();

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
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">
            {profile?.role === 'RETAILER'
              ? 'Customers who have applied through your store or were onboarded by you.'
              : 'Manage and review all registered customers'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(profile?.role === 'RETAILER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
            <Button
              variant="secondary"
              className="inline-flex items-center gap-2"
              onClick={() => navigate('/register')}
            >
              <Plus className="w-4 h-4" />
              Add customer
            </Button>
          )}
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm self-start">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
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

      {/* Table */}
      {!error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={search ? 'No matching customers' : 'No customers yet'}
            description={
              search
                ? 'Try a different name or email address.'
                : 'Customers will appear here once they register.'
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Customer</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Contact</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">Applications</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">Total Borrowed</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Joined</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((customer) => {
                  const sc = userStatusColors[customer.status];
                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => openCustomer(customer)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
                            {customer.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{customer.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {customer.phone || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-900">
                        {customer.applicationsCount}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-900">
                        {formatCurrency(customer.totalBorrowed)}
                      </td>
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(customer.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCustomer(customer);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Customer detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Customer Details"
        size="lg"
      >
        {selected && (
          <div className="space-y-6">
            {/* Profile summary */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-8 h-8 text-slate-500" />
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

            {/* Quick stats */}
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
                  <IndianRupee className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Borrowed</span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(selected.totalBorrowed)}
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
                  No applications on record
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
