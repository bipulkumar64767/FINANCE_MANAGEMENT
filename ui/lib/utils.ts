import type {
  ApplicationStatus,
  EMIStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
  DocumentType,
} from '../types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const statusColors: Record<ApplicationStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' },
  UNDER_REVIEW: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Under Review' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  DISBURSED: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Disbursed' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Closed' },
};

export const emiStatusColors: Record<EMIStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelled' },
};

export const roleColors: Record<UserRole, { bg: string; text: string; label: string }> = {
  SUPER_ADMIN: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Super Admin' },
  ADMIN: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Admin' },
  RETAILER: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Retailer' },
  CUSTOMER: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Customer' },
};

export const notificationColors: Record<NotificationType, { bg: string; text: string }> = {
  INFO: { bg: 'bg-blue-50', text: 'text-blue-600' },
  SUCCESS: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-600' },
  ERROR: { bg: 'bg-red-50', text: 'text-red-600' },
};

export const paymentStatusColors: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  SUCCESS: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Success' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  REFUNDED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Refunded' },
};

export const documentTypeLabels: Record<DocumentType, string> = {
  KYC_AADHAAR: 'Aadhaar Card',
  KYC_PAN: 'PAN Card',
  INCOME_PROOF: 'Income Proof',
  ADDRESS_PROOF: 'Address Proof',
  PHOTO: 'Photograph',
  BANK_STATEMENT: 'Bank Statement',
  OTHER: 'Other',
};

export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
}
