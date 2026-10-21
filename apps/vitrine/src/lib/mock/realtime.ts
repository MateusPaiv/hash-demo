/**
 * Mock realtime hub — mimics the supabase-js channel API surface.
 *
 * When the real Cofre lands, `useRealtimeQuery` switches its subscription
 * to `supabase.channel(...).on('postgres_changes', ...)` and components
 * remain untouched.
 */
import { subscribeDB, type MockTable } from './store';

/** Subscribe to mutations of a single table. Returns an unsubscribe fn. */
export function subscribeTable(table: MockTable, callback: () => void): () => void {
  return subscribeDB((changed) => {
    if (changed === table) callback();
  });
}
