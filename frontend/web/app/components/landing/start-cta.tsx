'use client';

import Link from 'next/link';
import { useAuth } from '../../context/auth-context';

/** Sends signed-in visitors straight to their workspace instead of the login wall. */
export default function StartCta() {
  const { user } = useAuth();

  return (
    <Link
      href={user ? '/workspace' : '/login'}
      className="inline-flex w-full items-center justify-center rounded-full bg-tertiary px-7 py-3.5 sm:w-auto text-sm font-bold tracking-wide text-[#101736] transition hover:bg-[#ffd75c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tertiary"
    >
      {user ? 'Open your workspace' : 'Start a session'}
    </Link>
  );
}
