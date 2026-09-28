'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationListener';
import { useAuthStore } from '@/stores/authStore';
import DashboardShell from '@/components/layout/DashboardShell';
import { Button, Card, PageHeader } from '@/components/ui';

export default function MorePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const initials = user
    ? (
        user.first_name?.[0] && user.last_name?.[0]
          ? `${user.first_name[0]}${user.last_name[0]}`
          : user.first_name?.[0] || user.email?.[0] || 'U'
      ).toUpperCase()
    : 'U';

  const menuItems = [
    { label: 'Social / Copy Trading', href: '/social', icon: '🫂' },
    { label: 'Business / IB', href: '/business', icon: '💼' },
    { label: 'Support & Help', href: '/support', icon: '🎧' },
  ];

  return (
    <DashboardShell mainClassName="p-0">
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full space-y-4 md:space-y-5 animate-fade-in">
        <PageHeader title="More" className="mb-0" />

        {/* Profile Card */}
        <Card className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-full border border-border-primary bg-bg-tertiary flex items-center justify-center text-lg font-bold text-text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0] : 'Trader'}
              </p>
              <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
          </div>

          <Link
            href="/profile"
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-border-primary bg-bg-tertiary px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-hover hover:border-border-strong"
          >
            Manage
          </Link>
        </Card>

        {/* Centralized Actions */}
        <Card className="flex flex-col items-center justify-center gap-3">
          <span className="text-xxs font-semibold uppercase tracking-[0.1em] text-text-secondary">Notifications</span>
          <div className="transform scale-110">
            <NotificationBell />
          </div>
        </Card>

        {/* Navigation Links */}
        <Card padding="none" className="overflow-hidden divide-y divide-border-secondary">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-4 hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium text-text-primary">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden />
            </Link>
          ))}
        </Card>

        {/* Logout */}
        <Button
          variant="danger"
          size="lg"
          fullWidth
          onClick={handleLogout}
          leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
        >
          Logout
        </Button>
      </div>
    </DashboardShell>
  );
}
