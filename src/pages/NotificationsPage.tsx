import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  module: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPage({ onUnreadChange }: { onUnreadChange: (n: number) => void }) {
  const { addToast } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/api/notifications');
      setItems(res.notifications);
      onUnreadChange(res.notifications.filter((n) => !n.isRead).length);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load notifications', message: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await load();
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">Notifications & Workflow Alerts</h1>
          <p className="text-sm text-slate-600">Document indexing updates, campaign approvals, and governance alerts.</p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {loading ? (
          <div className="p-6 h-32 animate-pulse" />
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No notifications at this time.</p>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-70' : 'bg-[#249B91]/5'}`}>
              <div>
                <div className="text-xs text-slate-500">
                  {n.module} · {new Date(n.createdAt).toLocaleString()}
                </div>
                <div className="text-sm font-semibold text-[#173650] mt-0.5">{n.title}</div>
                <p className="text-xs text-slate-700 mt-1">{n.message}</p>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-xs text-[#173650] hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
