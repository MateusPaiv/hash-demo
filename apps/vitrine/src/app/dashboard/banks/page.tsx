import { BanksView } from './banks-view';

/**
 * cacheComponents (Next 16): this segment opts out of instant-navigation
 * validation. The view evaluates zod schemas at module scope, which the dev
 * validator can't statically prove "instant". `instant` is a server-only
 * segment config, hence this thin server shell around the client view.
 */
export const instant = false;

export default function BanksPage() {
  return <BanksView />;
}
