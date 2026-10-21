import { ConvertView } from './convert-view';

/**
 * cacheComponents (Next 16): this segment opts out of instant-navigation
 * validation — the view is fully client-rendered off the mock store, so there
 * is no server data to prove "instant". `instant` is server-only, hence this
 * thin shell around the client view.
 */
export const instant = false;

export default function ConvertPage() {
  return <ConvertView />;
}
