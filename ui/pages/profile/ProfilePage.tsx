import { useEffect, useState } from 'react';
import {
  Mail, Phone, Shield, Calendar, Edit3, KeyRound, Eye,
  EyeOff, CheckCircle2, AlertCircle, Users, FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, updatePassword, getProfileCount, getApplicationCount } from '../../lib/api';
import {
  Card, Badge, Button, Input, Spinner,
} from '../../components/ui';
import { Modal } from '../../components/Modal';
import { formatDate, roleColors } from '../../lib/utils';
import type { UserStatus } from '../../types';

const userStatusColors: Record<UserStatus, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inactive' },
  SUSPENDED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspended' },
};

interface Toast {
  type: 'success' | 'error';
  message: string;
}

interface SystemStats {
  totalUsers: number;
  totalApplications: number;
}

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileToast, setProfileToast] = useState<Toast | null>(null);
  const [passwordToast, setPasswordToast] = useState<Toast | null>(null);

  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  // Fetch system stats for SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const [totalUsers, totalApplications] = await Promise.all([
          getProfileCount(),
          getApplicationCount(),
        ]);
        if (cancelled) return;
        setSystemStats({ totalUsers, totalApplications });
      } catch (err) {
        console.error('Error fetching system stats:', err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!profileToast && !passwordToast) return;
    const t = setTimeout(() => {
      setProfileToast(null);
      setPasswordToast(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [profileToast, passwordToast]);

  const openEditModal = () => {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setProfileToast(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    if (!editName.trim()) {
      setProfileToast({ type: 'error', message: 'Name cannot be empty.' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(profile.id, {
        full_name: editName.trim(),
        phone: editPhone.trim() || null,
      });

      await refreshProfile();
      setProfileToast({ type: 'success', message: 'Profile updated successfully.' });
      setEditOpen(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileToast({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordToast(null);
    if (!newPassword) {
      setPasswordToast({ type: 'error', message: 'Please enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordToast({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordToast({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(newPassword);

      setProfileToast(null);
      setPasswordToast({ type: 'success', message: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Error changing password:', err);
      const msg = err instanceof Error ? err.message : 'Failed to change password. Please try again.';
      setPasswordToast({ type: 'error', message: msg });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const rc = roleColors[profile.role];
  const sc = userStatusColors[profile.status];
  const initials = profile.full_name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || profile.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          View and manage your account information and security settings
        </p>
      </div>

      {/* Profile toast */}
      {profileToast && (
        <ToastBanner toast={profileToast} onDismiss={() => setProfileToast(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-2">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                  {initials}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 truncate">{profile.full_name}</h2>
                    <p className="text-sm text-slate-500 truncate">{profile.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={openEditModal}
                  >
                    Edit Profile
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  <Badge className={`${rc.bg} ${rc.text}`}>{rc.label}</Badge>
                  <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-slate-100">
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.phone || '—'} />
                  <InfoRow icon={<Shield className="w-4 h-4" />} label="Role" value={rc.label} />
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Member since"
                    value={formatDate(profile.created_at)}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column: system info for super admin */}
        <div className="space-y-6">
          {isSuperAdmin && (
            <Card className="p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">System Info</h2>
                  <p className="text-xs text-slate-500">Quick platform stats</p>
                </div>
              </div>

              {statsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : systemStats ? (
                <div className="space-y-3">
                  <SystemStatRow
                    icon={<Users className="w-4 h-4" />}
                    label="Total Users"
                    value={systemStats.totalUsers}
                  />
                  <SystemStatRow
                    icon={<FileText className="w-4 h-4" />}
                    label="Total Applications"
                    value={systemStats.totalApplications}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Unable to load stats.</p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Change password */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500">Keep your account secure with a strong password</p>
          </div>
        </div>

        {passwordToast && (
          <div className="mb-5">
            <ToastBanner toast={passwordToast} onDismiss={() => setPasswordToast(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Current password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Enter your new password below to update your account.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">New password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 max-w-2xl">
          <Button
            onClick={handleChangePassword}
            loading={savingPassword}
            icon={<KeyRound className="w-4 h-4" />}
          >
            Update Password
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordToast(null);
            }}
            disabled={savingPassword}
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Edit profile modal */}
      <Modal
        open={editOpen}
        onClose={() => !savingProfile && setEditOpen(false)}
        title="Edit Profile"
        size="sm"
      >
        <div className="space-y-5">
          <Input
            label="Full name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Enter your full name"
          />
          <Input
            label="Phone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="Enter your phone number"
          />

          {profileToast && (
            <ToastBanner toast={profileToast} onDismiss={() => setProfileToast(null)} />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingProfile}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} loading={savingProfile}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function SystemStatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-500 shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-900">{value}</span>
    </div>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
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
        onClick={onDismiss}
        className="text-current opacity-60 hover:opacity-100 transition-opacity"
      >
        Dismiss
      </button>
    </div>
  );
}
