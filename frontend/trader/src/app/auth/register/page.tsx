'use client';

/**
 * Sign-up page (PowerTradeFX) — thin wrapper around the shared
 * FullScreenSignup card. ProfileCompleteGate prompts for first/last
 * name + phone + country the first time the new user hits the dashboard,
 * so we only collect email + password here.
 */

import { FullScreenSignup } from '@/components/ui/full-screen-signup';

export default function RegisterPage() {
  return <FullScreenSignup mode="signup" />;
}
