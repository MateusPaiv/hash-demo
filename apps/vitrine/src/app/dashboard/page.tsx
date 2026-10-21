import { OverviewView } from './overview-view';

/**
 * cacheComponents (Next 16): this segment opts out of instant-navigation
 * validation — the overview is fully client-rendered off the mock store.
 * `instant` is a server-only segment config, hence the thin server shell.
 */
export const instant = false;

export default function DashboardPage() {
  return <OverviewView />;
}
