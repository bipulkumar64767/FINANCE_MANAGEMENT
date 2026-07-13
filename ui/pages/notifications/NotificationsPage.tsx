import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellOff, CheckCheck, Info, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import {
  Card, EmptyState, Spinner, Button,
} from '../../components/ui';
import { notificationColors, timeAgo, formatDateTime } from '../../lib/utils';
import type { Notification, NotificationType } from '../../types';

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

const FILTER_TABS: { key: ReadFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'READ', label: 'Read' },
];

const typeIcons: Record<NotificationType, React.ReactNode> = {
  INFO: <Info className="w-5 h-5" />,
  SUCCESS: <CheckCircle2 className="w-5 h-5" />,
  WARNING: <AlertTriangle className="w-5 h-5" />,
  ERROR: <XCircle className="w-5 h-5" />,
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReadFilter>('ALL');
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getNotifications();
        if (!cancelled) setNotifications(data);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === 'UNREAD') return notifications.filter((n) => !n.read);
    if (filter === 'READ') return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  const handleMarkRead = async (notif: Notification) => {
    if (notif.read) {
      // Already read — still navigate if there's a link
      if (notif.link) navigate(notif.link);
      return;
    }
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    try {
      await markNotificationRead(notif.id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: false } : n))
      );
    }
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || !profile) return;
    setMarkingAll(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('Error marking all as read:', err);
      // Revert
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: false } : n))
      );
    } finally {
      setMarkingAll(false);
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
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-semibold bg-red-500 text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stay updated on your application activity and alerts
          </p>
        </div>
        <Button
          variant="outline"
          icon={<CheckCheck className="w-4 h-4" />}
          onClick={handleMarkAllRead}
          loading={markingAll}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          const count =
            tab.key === 'ALL'
              ? notifications.length
              : tab.key === 'UNREAD'
                ? unreadCount
                : notifications.length - unreadCount;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
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

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={filter === 'UNREAD' ? <CheckCheck className="w-7 h-7" /> : <BellOff className="w-7 h-7" />}
            title={
              filter === 'UNREAD'
                ? 'You\'re all caught up'
                : filter === 'READ'
                  ? 'No read notifications'
                  : 'No notifications yet'
            }
            description={
              filter === 'UNREAD'
                ? 'There are no unread notifications to review.'
                : filter === 'READ'
                  ? 'You haven\'t read any notifications yet.'
                  : 'Notifications about your applications will appear here.'
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((notif) => {
              const nc = notificationColors[notif.type];
              return (
                <button
                  key={notif.id}
                  onClick={() => handleMarkRead(notif)}
                  className={`group w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors ${
                    !notif.read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${nc.bg} ${nc.text}`}>
                    {typeIcons[notif.type]}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {notif.title}
                      </p>
                      <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{notif.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400">{formatDateTime(notif.created_at)}</span>
                      {notif.link && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                          View <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread dot */}
                  <div className="flex-shrink-0 pt-1">
                    {notif.read ? (
                      <span className="block w-2 h-2 rounded-full bg-slate-200" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
