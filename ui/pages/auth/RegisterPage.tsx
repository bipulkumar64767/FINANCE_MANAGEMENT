import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createProfile } from '../../lib/api';
import { Button } from '../../components/ui';
import type { UserRole } from '../../types';

export default function RegisterPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const allowedRoles: { value: UserRole; label: string; description: string }[] =
    profile?.role === 'SUPER_ADMIN'
      ? [
          { value: 'CUSTOMER', label: 'Customer', description: 'Apply for asset financing' },
          { value: 'RETAILER', label: 'Retailer', description: 'Submit applications for customers' },
          { value: 'ADMIN', label: 'Admin', description: 'Approve applications, manage catalog' },
        ]
      : profile?.role === 'ADMIN'
      ? [
          { value: 'CUSTOMER', label: 'Customer', description: 'Apply for asset financing' },
          { value: 'RETAILER', label: 'Retailer', description: 'Submit applications for customers' },
        ]
      : [
          { value: 'CUSTOMER', label: 'Customer', description: 'Apply for asset financing' },
        ];
  const isRetailer = profile?.role === 'RETAILER';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = await createProfile(
        email,
        password || undefined,
        fullName,
        phone || undefined,
        role
      );
      const defaultPasswordMessage = password ? '' : ' A default password has been assigned.';
      setSuccess(`User ${data.full_name} has been created successfully.${defaultPasswordMessage}`);
      setEmail('');
      setPhone('');
      setPassword('');
      setFullName('');
      setRole('CUSTOMER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isRetailer ? 'Register a new customer' : 'Create a new user'}
              </h1>
              <p className="text-sm text-slate-500">
                {isRetailer
                  ? 'Register customer accounts from your retailer portal.'
                  : 'Create a user for the AssetFinance platform.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isRetailer && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {allowedRoles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                        role === r.value
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                      <p className="text-xs text-slate-500">{r.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 90000 00000"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave blank for a default password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                />
              </div>
              <p className="text-xs text-slate-500">If you leave this blank, a default password will be assigned.</p>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {isRetailer || role === 'CUSTOMER' ? 'Create Customer' : 'Create User'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
