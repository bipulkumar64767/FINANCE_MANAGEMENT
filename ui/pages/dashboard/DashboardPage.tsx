import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, Store, Package, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Wallet, Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardStats, getApplications, getNotifications } from '../../lib/api';
import { Card, Spinner, Badge } from '../../components/ui';
import { formatCurrency, formatDate, statusColors, roleColors } from '../../lib/utils';
import type { DashboardStats, FinanceApplication, Notification } from '../../types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
}

function StatCard({ icon, label, value, trend, color }: StatCardProps) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentApps, setRecentApps] = useState<FinanceApplication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      try {
        const data = await getDashboardStats();
        setStats(data.stats);

        const apps = await getApplications({ limit: 5 });
        setRecentApps(apps as FinanceApplication[] || []);

        const notifs = await getNotifications();
        setNotifications((notifs as Notification[]).slice(0, 5) || []);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!profile || !stats) return null;

  const role = profile.role;
  const roleColor = roleColors[role];
  const statusData = stats.applicationsByStatus || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's what's happening in your finance dashboard
          </p>
        </div>
        <Badge className={`${roleColor.bg} ${roleColor.text} px-3 py-1`}>
          {roleColor.label}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
          <>
            <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} label="Total Applications" value={stats.totalApplications || 0} color="bg-blue-50" />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending Approvals" value={stats.pendingApprovals || 0} color="bg-amber-50" />
            <StatCard icon={<Users className="w-5 h-5 text-teal-600" />} label="Customers" value={stats.totalCustomers || 0} color="bg-teal-50" />
            <StatCard icon={<Store className="w-5 h-5 text-purple-600" />} label="Retailers" value={stats.totalRetailers || 0} color="bg-purple-50" />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} label="Total Disbursed" value={formatCurrency(stats.totalDisbursed || 0)} color="bg-emerald-50" />
            <StatCard icon={<Wallet className="w-5 h-5 text-orange-600" />} label="Total Receivable" value={formatCurrency(stats.totalReceivable || 0)} color="bg-orange-50" />
            <StatCard icon={<Package className="w-5 h-5 text-slate-600" />} label="Assets in Catalog" value={stats.totalAssets || 0} color="bg-slate-100" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} label="Approved" value={statusData.APPROVED || 0} color="bg-green-50" />
          </>
        )}

        {role === 'RETAILER' && (
          <>
            <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} label="Total Applications" value={stats.totalApplications || 0} color="bg-blue-50" />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending Approvals" value={stats.pendingApprovals || 0} color="bg-amber-50" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} label="Approved" value={stats.approvedApplications || 0} color="bg-emerald-50" />
            <StatCard icon={<Users className="w-5 h-5 text-teal-600" />} label="Customers" value={stats.totalCustomers || 0} color="bg-teal-50" />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-slate-600" />} label="Total Finance" value={formatCurrency(stats.totalFinanceAmount || 0)} color="bg-slate-100" />
          </>
        )}

        {role === 'CUSTOMER' && (
          <>
            <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} label="Total Applications" value={stats.totalApplications || 0} color="bg-blue-50" />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending" value={stats.pendingApplications || 0} color="bg-amber-50" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} label="Active Loans" value={stats.activeLoans || 0} color="bg-emerald-50" />
            <StatCard icon={<Wallet className="w-5 h-5 text-teal-600" />} label="Total Borrowed" value={formatCurrency(stats.totalBorrowed || 0)} color="bg-teal-50" />
            <StatCard icon={<Calendar className="w-5 h-5 text-orange-600" />} label="Monthly EMI" value={formatCurrency(stats.monthlyEMI || 0)} color="bg-orange-50" />
            {stats.nextEMIDue && (
              <StatCard icon={<AlertCircle className="w-5 h-5 text-red-600" />} label="Next EMI Due" value={formatCurrency(stats.nextEMIDue.amount)} trend={`Due ${formatDate(stats.nextEMIDue.dueDate)}`} color="bg-red-50" />
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent applications */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Applications</h2>
            <Link to="/applications" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No applications yet</p>
          ) : (
            <div className="space-y-3">
              {recentApps.map(app => {
                const sc = statusColors[app.status];
                return (
                  <Link
                    key={app.id}
                    to={`/applications/${app.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{app.asset_name}</p>
                        <p className="text-xs text-slate-500">{app.application_number} · {formatCurrency(app.finance_amount)}</p>
                      </div>
                    </div>
                    <Badge className={`${sc.bg} ${sc.text} flex-shrink-0`}>{sc.label}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent notifications */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            <Link to="/notifications" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No notifications</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl ${notif.read ? 'bg-slate-50' : 'bg-blue-50 border border-blue-100'}`}
                >
                  <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Application status breakdown */}
      {statusData && Object.keys(statusData).length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Applications by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(statusData).map(([status, count]) => {
              const sc = statusColors[status as keyof typeof statusColors] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
              return (
                <div key={status} className="text-center p-3 rounded-xl border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{count}</p>
                  <Badge className={`${sc.bg} ${sc.text} mt-1`}>{sc.label}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
