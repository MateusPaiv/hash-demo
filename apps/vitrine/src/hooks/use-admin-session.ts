'use client';

import { useEffect, useState } from 'react';
import { isAdminSession, subscribeDB } from '@/lib/mock/store';

/** Backoffice session flag — separate from the client session on purpose. */
export function useAdminSession(): { authed: boolean; loading: boolean } {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const read = () => {
      setAuthed(isAdminSession());
      setLoading(false);
    };
    read();
    return subscribeDB((table) => {
      if (table === 'admin') read();
    });
  }, []);

  return { authed, loading };
}
