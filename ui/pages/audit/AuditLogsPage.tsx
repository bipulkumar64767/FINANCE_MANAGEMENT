import { useEffect, useMemo, useState } from 'react';
import {
  History, Search, ChevronDown, ChevronRight, Mail,
  Activity, Box,
} from 'lucide-react';
import { getAuditLogs } from '../../lib/api';
import {
  Card, Badge, EmptyState, Spinner, Select,
} from '../../components/ui';
import { formatDateTime, roleColors } from '../../lib/utils';
import type { AuditLog, UserRole } from '../../types';

type DateRange = 'TODAY' | '7D' | '30D' | 'ALL';

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 days' },
  { value: '30D', label: 'Last 30 days' },
  { value: 'ALL', label: 'All time' },
];

function rangeStartDate(range: DateRange): Date | null {
  if (range === 'ALL') return null;
  const now = new Date();
  if (range === 'TODAY') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = range === '7D' ? 7 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>('7D');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getAuditLogs();
        if (!cancelled) setLogs(data);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startDate = rangeStartDate(range);
    return logs.filter((log) => {
      if (startDate) {
        if (new Date(log.created_at) < startDate) return false;
      }
      if (q) {
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesEmail = (log.user_email || '').toLowerCase().includes(q);
        const matchesEntity = (log.entity_type || '').toLowerCase().includes(q);
        if (!matchesAction && !matchesEmail && !matchesEntity) return false;
      }
      return true;
    });
  }, [logs, search, range]);

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
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            System activity trail — track actions performed across the platform
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm self-start">
          <History className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, email, or entity..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
          />
        </div>
        <div className="sm:w-48">
          <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Logs table */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<History className="w-7 h-7" />}
            title={search || range !== 'ALL' ? 'No matching log entries' : 'No audit logs yet'}
            description={
              search || range !== 'ALL'
                ? 'Adjust your search or date range to find entries.'
                : 'System actions will be recorded here as they happen.'
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                  <th className="px-5 py-3.5 font-semibold text-slate-600 w-8"></th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">User</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Action</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600">Entity</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => {
                  const isOpen = expandedId === log.id;
                  const role = log.user_role as UserRole | null;
                  const rc = role && roleColors[role] ? roleColors[role] : null;
                  return (
                    <FragmentRow
                      key={log.id}
                      isOpen={isOpen}
                      onToggle={() => setExpandedId(isOpen ? null : log.id)}
                      log={log}
                      rc={rc}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FragmentRow({
  isOpen,
  onToggle,
  log,
  rc,
}: {
  isOpen: boolean;
  onToggle: () => void;
  log: AuditLog;
  rc: { bg: string; text: string; label: string } | null;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
      >
        <td className="px-5 py-4 text-slate-400">
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
          {formatDateTime(log.created_at)}
        </td>
        <td className="px-5 py-4">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{log.user_email || 'System'}</span>
            </p>
            {rc && (
              <span className="mt-1 inline-flex">
                <Badge className={`${rc.bg} ${rc.text}`}>{rc.label}</Badge>
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <Activity className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            {log.action}
          </span>
        </td>
        <td className="px-5 py-4 text-slate-600">
          {log.entity_type ? (
            <span className="inline-flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-slate-400" />
              {log.entity_type}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className="px-5 py-4 text-right">
          <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
            {isOpen ? 'Hide' : 'View'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/50">
          <td colSpan={6} className="px-5 py-5">
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-6 border border-slate-200 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Log ID */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">ID</p>
                  <p className="text-sm font-mono text-slate-900 mt-2 break-all">{log.id}</p>
                </div>

                {/* User ID */}
                {log.user_id && (
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">User ID</p>
                    <p className="text-sm font-mono text-slate-900 mt-2 break-all">{log.user_id}</p>
                  </div>
                )}

                {/* Action */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 bg-blue-50">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Action</p>
                  <p className="text-sm font-semibold text-blue-900 mt-2">{log.action}</p>
                </div>

                {/* Entity Type */}
                {log.entity_type && (
                  <div className="bg-white rounded-lg p-4 border border-purple-200 bg-purple-50">
                    <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Entity Type</p>
                    <p className="text-sm font-semibold text-purple-900 mt-2">{log.entity_type}</p>
                  </div>
                )}

                {/* Entity ID */}
                {log.entity_id && (
                  <div className="bg-white rounded-lg p-4 border border-emerald-200 bg-emerald-50">
                    <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Entity ID</p>
                    <p className="text-sm font-mono text-emerald-900 mt-2 break-all">{log.entity_id}</p>
                  </div>
                )}

                {/* IP Address */}
                {log.ip_address && (
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">IP Address</p>
                    <p className="text-sm font-mono text-slate-900 mt-2">{log.ip_address}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Timestamp</p>
                  <p className="text-sm text-slate-900 mt-2">{formatDateTime(log.created_at)}</p>
                </div>
              </div>

              {/* Details object (if present) */}
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Additional Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(log.details).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-600 font-medium">{key}</p>
                        <p className="text-sm text-slate-900 mt-1 font-mono break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
