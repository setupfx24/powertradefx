'use client';

import {
  BadgeCheck,
  Brain,
  Briefcase,
  Cpu,
  Gauge,
  Gift,
  Headphones,
  Lock,
  MonitorSmartphone,
  Network,
  ShieldCheck,
  ShieldPlus,
  TrendingDown,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { FeatureGrid, Section, SectionHeading, type FeatureItem } from '@/marketing/components';
import { WHY_US } from '../data';
import { BRAND_NAME } from '@/lib/brand';

const iconMap: Record<string, LucideIcon> = {
  ShieldCheck, ShieldPlus, Zap, TrendingDown, Headphones, Network, Gift, Lock, Brain, Gauge,
  BadgeCheck, Cpu, MonitorSmartphone, Briefcase, Users, Wallet,
};

const items: FeatureItem[] = WHY_US.map(({ icon, title, body }) => ({
  icon: iconMap[icon] ?? ShieldCheck,
  title,
  body,
}));

export function Pourquoi() {
  return (
    <Section id="why-choose" raised>
      <SectionHeading
        kicker={`Why choose ${BRAND_NAME}`}
        title="Why traders choose us"
        lead="Flexible leverage, an instant demo, orders that keep working after you close the browser, and funding by crypto or local banking -- the things that matter day to day."
      />
      <div style={{ marginTop: 'var(--mk-space-7)' }}>
        <FeatureGrid items={items} columns={3} />
      </div>
    </Section>
  );
}
