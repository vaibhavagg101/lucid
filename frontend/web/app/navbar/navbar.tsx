'use client';

import { usePathname } from 'next/navigation';
import UserMenu from './user-menu';
import Link from 'next/link';
import Image from 'next/image';
import lucidLogoOnPrimary from '../../public/master-logo-on-primary.svg';

export default function Navbar() {
  const pathname = usePathname();

  // Hide navbar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="navbar glassmorphism-primary z-40 mt-1.5">
      <Link href="/">
        <Image src={lucidLogoOnPrimary} alt="LUCID Logo" className="w-40" priority />
      </Link>
      <UserMenu />
    </nav>
  );
}