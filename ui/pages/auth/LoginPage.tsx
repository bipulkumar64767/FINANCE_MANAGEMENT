import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fillDemo = async (demoEmail: string) => {
    setError('');
    setLoading(true);
    const { error } = await signIn(demoEmail, 'demo1234');
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(20,184,166,0.2) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-lg font-bold">AssetFinance</p>
              <p className="text-sm text-slate-400">Management System</p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Finance electronics the smart way
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              Manage asset financing, track applications, generate EMI schedules, and
              oversee approvals — all from one unified platform.
            </p>
            <div className="mt-8 space-y-3">
              {['Role-based access control', 'Automated EMI scheduling', 'Real-time approval workflow', 'Complete audit trail'].map(feature => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-slate-500">© 2026 AssetFinance. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <p className="text-lg font-bold text-slate-900">AssetFinance</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-slate-600 mb-4">
              Select a demo account to log in. The username and password fields have been removed from the main login page.
            </p>
            {[
              { email: 'admin@demo.com', label: 'Super Admin' },
              { email: 'manager@demo.com', label: 'Admin' },
              { email: 'retailer@demo.com', label: 'Retailer' },
              { email: 'customer@demo.com', label: 'Customer' },
            ].map((demo) => (
              <Button
                key={demo.email}
                onClick={() => fillDemo(demo.email)}
                loading={loading}
                className="w-full justify-between"
                size="lg"
              >
                <span>{demo.label}</span>
                <span className="text-xs text-slate-300">{demo.email}</span>
              </Button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-slate-900 hover:underline">
              Sign up
            </Link>
          </p>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-slate-900 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
