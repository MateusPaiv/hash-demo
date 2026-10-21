'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeTable } from '@/lib/mock/realtime';
import type { MockTable } from '@/lib/mock/store';

/**
 * Runs `query` on mount and re-runs it whenever the underlying table changes
 * — the mock equivalent of a Supabase Realtime subscription driving a refetch.
 */
export function useRealtimeQuery<T>(
  table: MockTable,
  query: () => Promise<T>,
): { data: T | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => subscribeTable(table, () => setTick((t) => t + 1)), [table]);

  useEffect(() => {
    let cancelled = false;
    queryRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [table, tick]);

  return { data, loading, refetch: () => setTick((t) => t + 1) };
}
