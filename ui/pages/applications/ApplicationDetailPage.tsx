import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Package, User, Briefcase, CreditCard, Calendar,
  FileText, CheckSquare, FolderOpen, Clock,
  CheckCircle2, XCircle, Banknote, AlertCircle, Download, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getApplication, getEmiSchedule, getApprovals, getApplicationDocuments, manageApplication,
} from '../../lib/api';
import { Button, Badge, Card, Spinner, EmptyState, Textarea } from '../../components/ui';
import { Modal } from '../../components/Modal';
import {
  formatCurrency, formatDate, formatDateTime, formatFileSize,
  statusColors, emiStatusColors, documentTypeLabels,
} from '../../lib/utils';
import type {
  FinanceApplication, EMISchedule, Approval, Document, ApprovalAction,
} from '../../types';

type Tab = 'overview' | 'emi' | 'approvals' | 'documents';

interface ApplicationDetail extends Omit<FinanceApplication, 'customer' | 'retailer' | 'asset'> {
  customer: { full_name: string; email: string; phone: string | null } | null;
  retailer: { full_name: string } | null;
  asset: {
    name: string;
    brand: string;
    model: string | null;
    description: string | null;
    price: number;
    image_url: string | null;
  } | null;
}

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'emi', label: 'EMI Schedule', icon: Calendar },
  { key: 'approvals', label: 'History', icon: CheckSquare },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
];

const ACTION_LABELS: Record<ApprovalAction, string> = {
  SUBMIT: 'Submitted',
  REVIEW: 'Reviewed',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  DISBURSE: 'Disbursed',
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const location = useLocation();
  const navError = (location.state as { error?: string } | null)?.error ?? null;

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [emiSchedule, setEmiSchedule] = useState<EMISchedule[]>([]);
  const [emiLoading, setEmiLoading] = useState(false);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // ----- Fetch application -----
  const fetchApplication = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getApplication(id);
      setApplication(data as ApplicationDetail | null);
    } catch (err) {
      console.error('Error fetching application:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  // ----- Fetch tab data -----
  const fetchEMISchedule = useCallback(async () => {
    if (!id) return;
    setEmiLoading(true);
    try {
      const data = await getEmiSchedule(id);
      setEmiSchedule((data as EMISchedule[]) || []);
    } catch (err) {
      console.error('Error fetching EMI schedule:', err);
    } finally {
      setEmiLoading(false);
    }
  }, [id]);

  const fetchApprovals = useCallback(async () => {
    if (!id) return;
    setApprovalsLoading(true);
    try {
      const data = await getApprovals(id);
      setApprovals((data as Approval[]) || []);
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setApprovalsLoading(false);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    setDocumentsLoading(true);
    try {
      const data = await getApplicationDocuments(id);
      setDocuments((data as Document[]) || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setDocumentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!application) return;
    if (activeTab === 'emi' && (application.status === 'APPROVED' || application.status === 'DISBURSED')) {
      fetchEMISchedule();
    } else if (activeTab === 'approvals') {
      fetchApprovals();
    } else if (activeTab === 'documents') {
      fetchDocuments();
    }
  }, [activeTab, application, fetchEMISchedule, fetchApprovals, fetchDocuments]);

  // ----- Action handlers -----
  const handleAction = async (action: ApprovalAction, comments?: string) => {
    if (!id) return;
    setActionError(null);
    setActionLoading(action);
    try {
      await manageApplication({
        action,
        applicationId: id,
        comments,
        rejectionReason: action === 'REJECT' ? comments : undefined,
      });
      await fetchApplication();
      if (activeTab === 'approvals') fetchApprovals();
      if (action === 'REJECT') setShowRejectModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) return;
    handleAction('REJECT', rejectionReason.trim());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-7 h-7" />}
            title="Application not found"
            description="The application you're looking for doesn't exist or you don't have access to it."
            action={
              <Link to="/applications">
                <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Applications
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN';
  const sc = statusColors[application.status];
  const assetName = application.asset_name || application.asset?.name || '—';

  // Action visibility based on status + role
  const canReview = isAdmin && application.status === 'SUBMITTED';
  const canApprove = isAdmin && application.status === 'UNDER_REVIEW';
  const canReject = isAdmin && application.status === 'UNDER_REVIEW';
  const canDisburse = isAdmin && application.status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* Top nav */}
      <Link
        to="/applications"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Applications
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {application.asset?.image_url ? (
              <img
                src={application.asset.image_url}
                alt={assetName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-7 h-7 text-slate-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{application.application_number}</h1>
              <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">{assetName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Created {formatDateTime(application.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Notification banner from navigation state */}
      {navError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{navError}</p>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{actionError}</p>
        </div>
      )}

      {/* Action buttons */}
      {isAdmin && (canReview || canApprove || canReject || canDisburse) && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>Admin actions available for this application</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canReview && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<CheckSquare className="w-4 h-4" />}
                  loading={actionLoading === 'REVIEW'}
                  onClick={() => handleAction('REVIEW')}
                >
                  Start Review
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  loading={actionLoading === 'APPROVE'}
                  onClick={() => handleAction('APPROVE')}
                >
                  Approve
                </Button>
              )}
              {canReject && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  loading={actionLoading === 'REJECT'}
                  onClick={() => {
                    setRejectionReason('');
                    setShowRejectModal(true);
                  }}
                >
                  Reject
                </Button>
              )}
              {canDisburse && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Banknote className="w-4 h-4" />}
                  loading={actionLoading === 'DISBURSE'}
                  onClick={() => handleAction('DISBURSE')}
                >
                  Disburse Loan
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                active
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Asset details */}
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Asset Details</h2>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {application.asset?.image_url ? (
                    <img
                      src={application.asset.image_url}
                      alt={assetName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-9 h-9 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{assetName}</p>
                  {application.asset && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {application.asset.brand}
                      {application.asset.model ? ` · ${application.asset.model}` : ''}
                    </p>
                  )}
                  {application.asset?.description && (
                    <p className="text-sm text-slate-600 mt-2">{application.asset.description}</p>
                  )}
                  <p className="text-lg font-semibold text-slate-900 mt-2">
                    {formatCurrency(application.asset_price)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Finance summary */}
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Finance Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <SummaryRow label="Asset Price" value={formatCurrency(application.asset_price)} />
                <SummaryRow label="Down Payment" value={formatCurrency(application.down_payment)} />
                <SummaryRow label="Finance Amount" value={formatCurrency(application.finance_amount)} />
                <SummaryRow label="Interest Rate" value={`${application.interest_rate}% p.a.`} />
                <SummaryRow label="Tenure" value={`${application.tenure_months} months`} />
                <SummaryRow label="Monthly EMI" value={formatCurrency(application.monthly_emi)} highlight />
                <SummaryRow label="Total Payable" value={formatCurrency(application.total_payable)} highlight />
                <SummaryRow label="Total Interest" value={formatCurrency(Math.max(0, application.total_payable - application.finance_amount))} />
              </div>

              {/* Status timeline dates */}
              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
                <SummaryRow label="Submitted" value={formatDate(application.submitted_at)} />
                <SummaryRow label="Approved" value={formatDate(application.approved_at)} />
                <SummaryRow label="Disbursed" value={formatDate(application.disbursed_at)} />
              </div>

              {application.rejection_reason && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-800 mt-1">{application.rejection_reason}</p>
                </div>
              )}
            </Card>

            {/* Employment info */}
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Employment Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <SummaryRow
                  label="Employment Type"
                  value={application.employment_type || '—'}
                />
                <SummaryRow
                  label="Monthly Income"
                  value={application.monthly_income ? formatCurrency(application.monthly_income) : '—'}
                />
              </div>
            </Card>
          </div>

          {/* Right column: customer & retailer */}
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-semibold text-slate-900">Customer</h3>
              </div>
              {application.customer ? (
                <div className="space-y-3">
                  <SummaryRow label="Name" value={application.customer.full_name} />
                  <SummaryRow label="Email" value={application.customer.email} />
                  <SummaryRow label="Phone" value={application.customer.phone || '—'} />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No customer linked</p>
              )}
            </Card>

            {application.retailer && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-5 h-5 text-slate-600" />
                  <h3 className="text-base font-semibold text-slate-900">Retailer</h3>
                </div>
                <SummaryRow label="Name" value={application.retailer.full_name} />
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-semibold text-slate-900">Payment Snapshot</h3>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 text-white">
                <p className="text-xs text-slate-300 uppercase tracking-wide">Monthly EMI</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(application.monthly_emi)}</p>
              </div>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Tenure</span>
                  <span className="text-sm font-medium text-slate-900">
                    {application.tenure_months} months
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total Payable</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(application.total_payable)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* EMI SCHEDULE */}
      {activeTab === 'emi' && (
        <Card className="overflow-hidden">
          {application.status !== 'APPROVED' && application.status !== 'DISBURSED' ? (
            <EmptyState
              icon={<Calendar className="w-7 h-7" />}
              title="EMI schedule not available"
              description="The EMI schedule is generated once the application is approved and disbursed."
            />
          ) : emiLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-8 h-8" />
            </div>
          ) : emiSchedule.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-7 h-7" />}
              title="No EMI schedule found"
              description="The EMI schedule hasn't been generated yet for this application."
            />
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-b border-slate-200 bg-slate-50/50">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Total Installments</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{emiSchedule.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly EMI</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {formatCurrency(application.monthly_emi)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Paid</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">
                    {emiSchedule.filter((e) => e.status === 'PAID').length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">
                    {emiSchedule.filter((e) => e.status === 'PENDING').length}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Due Date</th>
                      <th className="px-5 py-3 text-right">EMI</th>
                      <th className="px-5 py-3 text-right">Principal</th>
                      <th className="px-5 py-3 text-right">Interest</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emiSchedule.map((emi) => {
                      const esc = emiStatusColors[emi.status];
                      return (
                        <tr key={emi.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                            {emi.installment_number}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">
                            {formatDate(emi.due_date)}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-medium text-slate-900 text-right">
                            {formatCurrency(emi.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 text-right">
                            {formatCurrency(emi.principal)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 text-right">
                            {formatCurrency(emi.interest)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 text-right">
                            {formatCurrency(emi.balance)}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge className={`${esc.bg} ${esc.text}`}>{esc.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* APPROVALS / HISTORY */}
      {activeTab === 'approvals' && (
        <Card className="p-5">
          {approvalsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-8 h-8" />
            </div>
          ) : approvals.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-7 h-7" />}
              title="No history yet"
              description="Approval actions and status changes will appear here once the application is submitted."
            />
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-slate-200" />
              <div className="space-y-6">
                {approvals.map((approval, idx) => {
                  const action = approval.action;
                  const iconColor = getActionColor(action);
                  const Icon = getActionIcon(action);
                  const isLast = idx === approvals.length - 1;
                  return (
                    <div key={approval.id} className="relative flex gap-4">
                      <div
                        className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor.bg}`}
                      >
                        <Icon className={`w-4 h-4 ${iconColor.text}`} />
                      </div>
                      <div className={`flex-1 ${isLast ? '' : 'pb-2'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">
                            {ACTION_LABELS[action]}
                          </p>
                          {approval.new_status && (
                            <Badge
                              className={`${statusColors[approval.new_status as keyof typeof statusColors]?.bg || 'bg-slate-100'} ${statusColors[approval.new_status as keyof typeof statusColors]?.text || 'text-slate-700'}`}
                            >
                              {statusColors[approval.new_status as keyof typeof statusColors]?.label || approval.new_status}
                            </Badge>
                          )}
                        </div>
                        {approval.approver_name && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            by {approval.approver_name}
                          </p>
                        )}
                        {approval.comments && (
                          <p className="text-sm text-slate-600 mt-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            {approval.comments}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(approval.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* DOCUMENTS */}
      {activeTab === 'documents' && (
        <Card className="p-5">
          {documentsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-8 h-8" />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="w-7 h-7" />}
              title="No documents uploaded"
              description="Documents related to this application will appear here once uploaded."
            />
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {documentTypeLabels[doc.document_type] || doc.document_type} · {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                  <DocumentStatusBadge status={doc.status} />
                  {doc.storage_url && (
                    <a
                      href={doc.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="View document"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Rejection modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Application"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Please provide a reason for rejecting this application. The customer will be notified.
            </p>
          </div>
          <Textarea
            label="Rejection Reason"
            rows={4}
            placeholder="Enter the reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            error={rejectionReason.trim() === '' ? 'Reason is required' : undefined}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<XCircle className="w-4 h-4" />}
              loading={actionLoading === 'REJECT'}
              disabled={!rejectionReason.trim()}
              onClick={handleRejectSubmit}
            >
              Reject Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl ${highlight ? 'bg-slate-50' : ''}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-slate-900' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

function getActionColor(action: ApprovalAction): { bg: string; text: string } {
  switch (action) {
    case 'SUBMIT':
      return { bg: 'bg-blue-100', text: 'text-blue-600' };
    case 'REVIEW':
      return { bg: 'bg-amber-100', text: 'text-amber-600' };
    case 'APPROVE':
      return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
    case 'REJECT':
      return { bg: 'bg-red-100', text: 'text-red-600' };
    case 'DISBURSE':
      return { bg: 'bg-teal-100', text: 'text-teal-600' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600' };
  }
}

function getActionIcon(action: ApprovalAction): typeof CheckCircle2 {
  switch (action) {
    case 'SUBMIT':
      return FileText;
    case 'REVIEW':
      return CheckSquare;
    case 'APPROVE':
      return CheckCircle2;
    case 'REJECT':
      return XCircle;
    case 'DISBURSE':
      return Banknote;
    default:
      return Clock;
  }
}

function DocumentStatusBadge({ status }: { status: Document['status'] }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    UPLOADED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Uploaded' },
    VERIFIED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  };
  const s = map[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  return <Badge className={`${s.bg} ${s.text}`}>{s.label}</Badge>;
}
