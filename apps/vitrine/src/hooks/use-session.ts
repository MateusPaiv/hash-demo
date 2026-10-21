'use client';

import { useEffect, useState } from 'react';
import { getSessionUser, subscribeDB, type MockUser } from '@/lib/mock/store';

/**
 * Reads the mock session and re-reads it whenever it changes.
 * (Swap target: supabase.auth.getSession() + onAuthStateChange.)
 */
export function useSession(): { user: MockUser | null; loading: boolean } {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const read = () => {
      setUser(getSessionUser());
      setLoading(false);
    };
    read();
    return subscribeDB((table) => {
      if (table === 'session') read();
    });
  }, []);

  return { user, loading };
}
