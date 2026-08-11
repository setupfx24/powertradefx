'use client';

/**
 * Standalone Transaction History was consolidated into the Funds page
 * (Funds → Transaction History tab). This route now just redirects
 * there so old links / bookmarks don't 404.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/wallet?tab=history');
  }, [router]);
  return null;
}
