import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Store, Mail, Lock, User, Phone, AlertCircle, ArrowLeft, Check, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createProfile } from '../../lib/api';
import { Button, Input, Card } from '../../components/ui';

export default function OnboardRetailerPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Only admins can onboard retailers
  if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-600">Only admins can onboard retailers. Please contact your administrator.</p>
          <Link to="/dashboard">
            <Button className="w-full">Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!fullName.trim()) {
      setError('Please enter the retailer contact person\'s name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a phone number');
      return;
    }
    if (!businessName.trim()) {
      setError('Please enter the business name');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const data = await createProfile(email, password, fullName, phone, 'RETAILER');

      setSuccess(`Retailer account created successfully!`);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setBusinessName('');
      setStep(0);

      // Navigate to retailers page after 2 seconds
      setTimeout(() => {
        navigate('/retailers');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create retailer account.');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Retailer Info', 'Account Details', 'Review & Create'];

  const isStep0Valid = businessName.trim().length > 0 && fullName.trim().length > 0 && phone.trim().length > 0;
  const isStep1Valid = email.trim().length > 0 && password.length >= 8;
  const canSubmit = isStep0Valid && isStep1Valid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/retailers"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Retailers
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Onboard New Retailer</h1>
              <p className="text-sm text-slate-600 mt-1">Register a new retail partner to the platform</p>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <Card className="p-4 mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            {STEPS.map((label, idx) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 sm:gap-3 flex-1">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${
                      idx < step
                        ? 'bg-emerald-500 text-white'
                        : idx === step
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {idx < step ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : idx + 1}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-xs sm:text-sm font-medium ${idx <= step ? 'text-slate-900' : 'text-slate-500'}`}>
                      {label}
                    </p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 rounded-full ${idx < step ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Form */}
        <Card className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* STEP 0: Retailer Info */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Retailer Information</h3>
                  <p className="text-sm text-slate-600 mb-6">Enter the basic details of the retail business</p>
                </div>

                <Input
                  label="Business Name"
                  placeholder="e.g., ABC Electronics"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />

                <Input
                  label="Contact Person Name"
                  placeholder="Full name of the business owner or manager"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="Business contact number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            )}

            {/* STEP 1: Account Details */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Account Credentials</h3>
                  <p className="text-sm text-slate-600 mb-6">Set up login credentials for the retailer account</p>
                </div>

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="business@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters' : ''}
                  required
                />

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                  <p className="font-medium mb-2">Password Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>At least 8 characters long</li>
                    <li>Should include uppercase and lowercase letters</li>
                    <li>Should include numbers or special characters</li>
                  </ul>
                </div>
              </div>
            )}

            {/* STEP 2: Review & Create */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Review Details</h3>
                  <p className="text-sm text-slate-600 mb-6">Verify all information before creating the account</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Business Name</p>
                    <p className="text-base font-semibold text-slate-900 mt-2">{businessName}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Contact Person</p>
                    <p className="text-base font-semibold text-slate-900 mt-2">{fullName}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Phone</p>
                    <p className="text-base font-semibold text-slate-900 mt-2">{phone}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Email</p>
                    <p className="text-base font-semibold text-slate-900 mt-2 truncate">{email}</p>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-700">
                  <p className="font-medium">Ready to create?</p>
                  <p className="text-xs mt-1">Click the "Create Account" button to register this retailer with the platform.</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0 || loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              {step < 2 ? (
                <Button
                  onClick={() => {
                    if (step === 0 && isStep0Valid) setStep(1);
                    else if (step === 1 && isStep1Valid) setStep(2);
                  }}
                  disabled={step === 0 ? !isStep0Valid : !isStep1Valid}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || loading}
                  loading={loading}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
