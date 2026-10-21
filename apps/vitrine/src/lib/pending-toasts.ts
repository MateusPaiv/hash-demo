/**
 * Tracks which persistent "awaiting webhook" toasts this tab created, so the
 * resolver can claim them exactly once — even after navigating away and back
 * (component state dies on unmount; this registry is module-scoped and lives
 * as long as the tab).
 */
const active = new Set<string>();

export const pendingToasts = {
  register(id: string): void {
    active.add(id);
  },
  /** Claim a toast for resolution. Returns true exactly once per registered id. */
  take(id: string): boolean {
    return active.delete(id);
  },
};
