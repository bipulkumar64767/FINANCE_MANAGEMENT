import { useEffect, useMemo, useState } from 'react';
import {
  UserCog, Search, Mail, Phone, Shield, CheckCircle2, AlertCircle,
  ShieldCheck, UserRound, Store, Crown, ChevronDown,
} from 'lucide-react';
import { getProfiles, updateProfile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, EmptyState, Spinner, Input, Select, Button } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { formatDateTime, roleColors } from '../../lib/utils';
import type { Profile, UserRole, UserStatus } from '../../types';

const userStatusColors: Record<UserStatus, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inactive' },
  SUSPENDED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspended' },
};

const STATUS_OPTIONS: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ReactNode }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', icon: <Crown className="w-4 h-4" /> },
  { value: 'ADMIN', label: 'Admin', icon: <ShieldCheck className="w-4 h-4" /> },
  { value: 'RETAILER', label: 'Retailer', icon: <Store className="w-4 h-4" /> },
  { value: 'CUSTOMER', label: 'Customer', icon: <UserRound className="w-4 h-4" /> },
];

type RoleFilter = 'ALL' | UserRole;

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SUPER_ADMIN', label: 'Super Admin' },
  { key: 'ADMIN', label: 'Admin' },
  { key: 'RETAILER', label: 'Retailer' },
  { key: 'CUSTOMER', label: 'Customer' },
];

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [toast, setToast] = useState<Toast | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [roleModalUser, setRoleModalUser] = useState<Profile | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole>('CUSTOMER');
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getProfiles();
        if (!cancelled) setUsers(data);
      } catch (err) {
        console.error('Error fetching users:', err);
        if (!cancelled) setToast({ type: 'error', message: 'Failed to load users.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const counts = useMemo(() => {
    const base: Record<RoleFilter, number> = {
      ALL: users.length,
      SUPER_ADMIN: 0,
      ADMIN: 0,
      RETAILER: 0,
      CUSTOMER: 0,
    };
    for (const u of users) base[u.role] = (base[u.role] || 0) + 1;
    return base;
  }, [users]);

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    setUpdatingId(userId);
    try {
      await updateProfile(userId, { status: newStatus });

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      setToast({ type: 'success', message: `Status updated to ${userStatusColors[newStatus].label}.` });
    } catch (err) {
      console.error('Error updating status:', err);
      setToast({ type: 'error', message: 'Failed to update status. Please try again.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const openRoleModal = (user: Profile) => {
    setRoleModalUser(user);
    setPendingRole(user.role);
  };

  const handleRoleSave = async () => {
    if (!roleModalUser) return;
    setSavingRole(true);
    try {
      await updateProfile(roleModalUser.id, { role: pendingRole });

      setUsers((prev) =>
        prev.map((u) => (u.id === roleModalUser.id ? { ...u, role: pendingRole } : u))
      );
      setToast({
        type: 'success',
        message: `${roleModalUser.full_name}'s role updated to ${roleColors[pendingRole].label}.`,
      });
      setRoleModalUser(null);
    } catch (err) {
      console.error('Error updating role:', err);
      setToast({ type: 'error', message: 'Failed to update role. Please try again.' });
    } finally {
      setSavingRole(false);
    }
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage user roles, statuses, and access across the platform
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm self-start">
          <UserCog className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {users.length} total {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <p className="flex-1">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map((tab) => {
          const active = roleFilter === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
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

      {/* Users table */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCog className="w-8 h-8" />}
            title={search || roleFilter !== 'ALL' ? 'No matching users' : 'No users yet'}
            description={
              search || roleFilter !== 'ALL'
                ? 'Adjust your search or role filter to find users.'
                : 'Registered users will appear here.'
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                  <th className="px-5 py-3.5 font-semibold text-slate-600">User</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Role</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Phone</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Joined</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => {
                  const rc = roleColors[user.role];
                  const sc = userStatusColors[user.status];
                  const isSelf = profile?.id === user.id;
                  const isUpdating = updatingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                              {user.full_name}
                              {isSelf && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={`${rc.bg} ${rc.text}`}>{rc.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {user.phone || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative inline-block">
                          <select
                            value={user.status}
                            disabled={isSelf || isUpdating}
                            onChange={(e) =>
                              handleStatusChange(user.id, e.target.value as UserStatus)
                            }
                            className={`appearance-none pl-2.5 pr-8 py-1.5 rounded-lg text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60 disabled:cursor-not-allowed ${sc.bg} ${sc.text} border-slate-200`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-white text-slate-900 font-medium">
                                {userStatusColors[s].label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          {isUpdating && (
                            <span className="ml-2 text-xs text-slate-400">Saving…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {formatDateTime(user.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openRoleModal(user)}
                          disabled={isSelf}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isSelf ? "You can't change your own role" : 'Change role'}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Change Role
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

      {/* Change role modal */}
      <Modal
        open={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title="Change User Role"
        size="sm"
      >
        {roleModalUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
                {roleModalUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{roleModalUser.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{roleModalUser.email}</p>
              </div>
            </div>

            <Select
              label="New role"
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            {pendingRole === 'SUPER_ADMIN' && (
              <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Super Admins have full platform access, including user management. Grant this role carefully.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRoleModalUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRoleSave}
                loading={savingRole}
                disabled={pendingRole === roleModalUser.role}
              >
                Save Role
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
