import { redirect } from 'next/navigation';

/** Pure redirect — the instant-navigation validator cannot see through NEXT_REDIRECT. */
export const instant = false;

export default function Home() {
  redirect('/dashboard');
}
