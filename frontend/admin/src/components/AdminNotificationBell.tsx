'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string | null;
}

interface ListResponse {
  items: AdminNotification[];
  unread_count: number;
}

const POLL_INTERVAL_MS = 30_000;

/** Bell icon + dropdown for admin in-app notifications.
 *
 * Polls /api/v1/admin/notifications every 30 s. Mark-as-read fires on
 * dropdown open so the badge clears without forcing the admin to click
 * every row. Individual rows can still be marked manually via the check
 * button (useful when admin only wants to clear a few). */
export default function AdminNotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  // Anchor for the portal — the dropdown lives on document.body so it
  // escapes the admin layout's overflow:hidden stacking context. We
  // position it under the bell with this rect, recomputed on open + on
  // scroll/resize so it stays glued to the icon.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const recomputeAnchor = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
  };

  useLayoutEffect(() => {
    if (!open) return;
    recomputeAnchor();
    const onChange = () => recomputeAnchor();
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [open]);

  const fetchNotifications = async () => {
    try {
      const res = await adminApi.get<ListResponse>('/notifications', { limit: '15' });
      setItems(res?.items ?? []);
      setUnread(res?.unread_count ?? 0);
    } catch {
      /* silent — bell stays at whatever last state */
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const t = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Click-outside to close. The dropdown is portaled to document.body
  // (so it can float above the admin layout's stacking context), which
  // means the bell wrapper does NOT contain it — we need to check both
  // the bell ref AND the portal ref so clicks inside the dropdown don't
  // close it.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await adminApi.post(`/notifications/${id}/read`, {});
      setItems((cur) => cur.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      /* swallow */
    }
  };

  const markAllRead = async () => {
    try {
      await adminApi.post('/notifications/read-all', {});
      setItems((cur) => cur.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      /* swallow */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md hover:bg-bg-hover transition-fast text-text-secondary hover:text-text-primary"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && anchor && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', top: anchor.top, right: anchor.right, zIndex: 2147483600 }}
          className="w-[360px] max-h-[480px] flex flex-col rounded-lg border border-border-primary bg-bg-card shadow-dropdown overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
            <span className="text-xs font-semibold text-text-primary">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] font-semibold text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-text-tertiary">
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-border-primary/60">
                {items.map((n) => {
                  const Row: React.ElementType = n.action_url ? Link : 'div';
                  // We want the same visual treatment whether or not the
                  // row is wrapped in a Link, so coerce both branches to
                  // accept the same props.
                  const rowProps = n.action_url
                    ? { href: n.action_url, onClick: () => setOpen(false) }
                    : {};
                  return (
                    <li key={n.id} className={cn('flex items-start gap-2 px-3 py-2.5 hover:bg-bg-hover', !n.is_read && 'bg-accent/[0.06]')}>
                      <Row {...rowProps} className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-text-primary truncate">{n.title}</div>
                        <div className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">{n.message}</div>
                        {n.created_at && (
                          <div className="text-[10px] text-text-tertiary mt-0.5">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        )}
                      </Row>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => void markRead(n.id)}
                          className="shrink-0 p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-tertiary"
                          aria-label="Mark read"
                          title="Mark read"
                        >
                          <Check size={12} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
