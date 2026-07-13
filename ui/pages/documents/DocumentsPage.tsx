import { useEffect, useMemo, useState } from 'react';
import {
  FileText, Upload, Search, FileCheck2, FileX2, Clock,
  Download, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDocuments, getApplications, uploadDocument, getProfiles } from '../../lib/api';
import {
  Button, Badge, Card, EmptyState, Spinner, Input, Select,
} from '../../components/ui';
import { Modal } from '../../components/Modal';
import {
  formatFileSize, formatDate, formatDateTime, documentTypeLabels,
} from '../../lib/utils';
import type { Document, DocumentType, DocumentStatus } from '../../types';

type TypeFilter = 'ALL' | DocumentType;

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'KYC_AADHAAR', label: 'Aadhaar' },
  { key: 'KYC_PAN', label: 'PAN' },
  { key: 'INCOME_PROOF', label: 'Income Proof' },
  { key: 'ADDRESS_PROOF', label: 'Address Proof' },
  { key: 'BANK_STATEMENT', label: 'Bank Statement' },
  { key: 'PHOTO', label: 'Photograph' },
  { key: 'OTHER', label: 'Other' },
];

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = (
  Object.entries(documentTypeLabels) as [DocumentType, string][]
).map(([value, label]) => ({ value, label }));

const documentStatusStyles: Record<DocumentStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  UPLOADED: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Uploaded', icon: <Clock className="w-3 h-3" /> },
  VERIFIED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified', icon: <FileCheck2 className="w-3 h-3" /> },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: <FileX2 className="w-3 h-3" /> },
};

interface Toast {
  type: 'success' | 'error';
  message: string;
}

interface DocumentRow extends Document {
  application: { application_number: string } | null;
}

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('KYC_AADHAAR');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [mimeType, setMimeType] = useState('');
  const [applicationId, setApplicationId] = useState('');

  const [availableApplications, setAvailableApplications] = useState<{ id: string; application_number: string }[]>([]);
  const [viewDoc, setViewDoc] = useState<DocumentRow | null>(null);

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN';
  const canUpload = profile?.role === 'CUSTOMER';

  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileRoleFilter, setProfileRoleFilter] = useState<'CUSTOMER' | 'RETAILER'>('CUSTOMER');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Load list of profiles for admin or retailer (to pick a customer)
        if (profile.role === 'RETAILER') {
          const list = await getProfiles({ role: 'CUSTOMER' });
          if (!cancelled) {
            setProfiles(list || []);
            if (list && list.length === 1) setSelectedProfileId(list[0].id);
          }
        } else if (isAdmin) {
          const list = await getProfiles({ role: profileRoleFilter });
          if (!cancelled) {
            setProfiles(list || []);
            // do not auto-select for admins
            setSelectedProfileId(null);
          }
        }

        // Fetch documents - if a specific profile is selected, request that customer's or retailer's documents
        const docs = await getDocuments(
          selectedProfileId
            ? profileRoleFilter === 'RETAILER'
              ? { retailer_id: selectedProfileId }
              : { customer_id: selectedProfileId }
            : undefined
        );
        if (!cancelled) setDocuments(docs as DocumentRow[]);
      } catch (err) {
        console.error('Error fetching documents:', err);
        if (!cancelled) setToast({ type: 'error', message: 'Failed to load documents.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, selectedProfileId, profileRoleFilter]);

  // Load customer's own applications for the upload modal
  useEffect(() => {
    if (!profile || profile.role !== 'CUSTOMER' || !uploadOpen) return;
    let cancelled = false;
    (async () => {
      const data = await getApplications({ customer_id: profile.id });
      if (!cancelled) {
        setAvailableApplications(
          data.map((app) => ({ id: app.id, application_number: app.application_number }))
        );
        setApplicationId(data[0]?.id || '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, uploadOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (typeFilter !== 'ALL' && doc.document_type !== typeFilter) return false;
      if (q) {
        const matchesName = doc.file_name.toLowerCase().includes(q);
        const matchesApp = doc.application?.application_number?.toLowerCase().includes(q);
        if (!matchesName && !matchesApp) return false;
      }
      return true;
    });
  }, [documents, typeFilter, search]);

  const counts = useMemo(() => {
    const base: Record<TypeFilter, number> = { ALL: documents.length } as Record<TypeFilter, number>;
    for (const doc of documents) {
      base[doc.document_type] = (base[doc.document_type] || 0) + 1;
    }
    return base;
  }, [documents]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileSize(file.size);
      setMimeType(file.type || 'application/octet-stream');
    }
  };

  const resetUploadForm = () => {
    setDocType('KYC_AADHAAR');
    setFileName('');
    setFileSize(0);
    setMimeType('');
    setApplicationId(availableApplications[0]?.id || '');
  };

  const handleUpload = async () => {
    if (!profile) return;
    if (!fileName.trim()) {
      setToast({ type: 'error', message: 'Please choose a file or enter a file name.' });
      return;
    }
    setUploading(true);
    try {
      const data = await uploadDocument({
        application_id: applicationId || null,
        document_type: docType,
        file_name: fileName.trim(),
        file_size: fileSize,
        mime_type: mimeType || 'application/octet-stream',
        object_key: 'mock-' + Date.now(),
      });

      if (data) {
        setDocuments((prev) => [data as DocumentRow, ...prev]);
      }
      setToast({ type: 'success', message: 'Document uploaded successfully.' });
      resetUploadForm();
      setUploadOpen(false);
    } catch (err) {
      console.error('Error uploading document:', err);
      setToast({ type: 'error', message: 'Failed to upload document. Please try again.' });
    } finally {
      setUploading(false);
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
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'All uploaded documents across the platform'
              : profile?.role === 'RETAILER'
                ? 'Documents for applications you handle'
                : 'Your uploaded documents and KYC files'}
          </p>
        </div>
        {canUpload && (
          <Button icon={<Upload className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        )}
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

      {/* Profile selector (admin: choose role + profile; retailer: customers) */}
      {(isAdmin || profile?.role === 'RETAILER') && (
        <div className="flex items-center gap-3 max-w-md">
          {isAdmin && (
            <Select value={profileRoleFilter} onChange={(e) => setProfileRoleFilter(e.target.value as 'CUSTOMER' | 'RETAILER')}>
              <option value="CUSTOMER">Customers</option>
              <option value="RETAILER">Retailers</option>
            </Select>
          )}

          <Select value={selectedProfileId || ''} onChange={(e) => setSelectedProfileId(e.target.value || null)}>
            <option value="">All {profileRoleFilter === 'RETAILER' ? 'retailers' : 'customers'}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
            ))}
          </Select>
        </div>
      )}

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TYPE_TABS.map((tab) => {
          const active = typeFilter === tab.key;
          const count = counts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by file name or application number..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
        />
      </div>

      {/* Documents grid */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title={search || typeFilter !== 'ALL' ? 'No documents found' : 'No documents yet'}
            description={
              search || typeFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : canUpload
                  ? 'Upload your first document to get started.'
                  : 'Uploaded documents will appear here.'
            }
            action={
              canUpload && !search && typeFilter === 'ALL' ? (
                <Button icon={<Upload className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
                  Upload Document
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const ss = documentStatusStyles[doc.status];
            return (
              <button
                key={doc.id}
                onClick={() => setViewDoc(doc)}
                className="group text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-slate-500" />
                  </div>
                  <Badge className={`${ss.bg} ${ss.text} gap-1`}>
                    {ss.icon}
                    {ss.label}
                  </Badge>
                </div>

                <p className="text-sm font-medium text-slate-900 truncate mb-1" title={doc.file_name}>
                  {doc.file_name}
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  {documentTypeLabels[doc.document_type]}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="text-slate-300">•</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>

                {doc.application?.application_number && (
                  <p className="mt-3 text-[11px] text-slate-400 truncate">
                    App: {doc.application.application_number}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        title="Upload Document"
        size="md"
      >
        <div className="space-y-5">
          {availableApplications.length > 0 ? (
            <Select
              label="Application (optional)"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              {availableApplications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.application_number}
                </option>
              ))}
              <option value="">— None —</option>
            </Select>
          ) : (
            <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              You have no applications yet. The document will be stored without a linked application.
            </p>
          )}

          <Select
            label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">File</label>
            <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer">
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm text-slate-600">
                {fileName ? fileName : 'Click to choose a file'}
              </span>
              <span className="text-xs text-slate-400">
                You can also type a file name manually below
              </span>
              <input type="file" className="hidden" onChange={handleFilePick} />
            </label>
          </div>

          <Input
            label="File name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="e.g. aadhaar_front.pdf"
          />

          {(fileSize > 0 || mimeType) && (
            <div className="flex items-center gap-4 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
              {fileSize > 0 && <span>Size: {formatFileSize(fileSize)}</span>}
              {mimeType && <span>Type: {mimeType}</span>}
            </div>
          )}

          <p className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            This is a demo upload — file metadata is saved to the database with a placeholder key.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} loading={uploading} icon={<Upload className="w-4 h-4" />}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document details modal */}
      <Modal
        open={!!viewDoc}
        onClose={() => setViewDoc(null)}
        title="Document Details"
        size="md"
      >
        {viewDoc && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 break-words">{viewDoc.file_name}</p>
                <p className="text-sm text-slate-500">{documentTypeLabels[viewDoc.document_type]}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Status">
                <Badge className={`${documentStatusStyles[viewDoc.status].bg} ${documentStatusStyles[viewDoc.status].text} gap-1`}>
                  {documentStatusStyles[viewDoc.status].icon}
                  {documentStatusStyles[viewDoc.status].label}
                </Badge>
              </DetailField>
              <DetailField label="File size">
                {formatFileSize(viewDoc.file_size)}
              </DetailField>
              <DetailField label="MIME type">{viewDoc.mime_type || '—'}</DetailField>
              <DetailField label="Uploaded on">{formatDate(viewDoc.created_at)}</DetailField>
              <DetailField label="Application">
                {viewDoc.application?.application_number || '—'}
              </DetailField>
              <DetailField label="Storage key">
                <span className="font-mono text-xs break-all">{viewDoc.object_key}</span>
              </DetailField>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Uploaded</p>
              <p className="text-sm text-slate-600">{formatDateTime(viewDoc.created_at)}</p>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" icon={<Download className="w-4 h-4" />} disabled>
                Download
              </Button>
              <Button onClick={() => setViewDoc(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
