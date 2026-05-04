'use client';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import UserMenu from './user-menu';
import Image from 'next/image';
import lucidLogoOnPrimary from '../../public/master-logo-on-primary.svg';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide navbar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="navbar glassmorphism-primary">
      <span>
        <Image src={lucidLogoOnPrimary} alt="LUCID Logo" className="w-40 hover:cursor-pointer" loading="eager" onClick={() => router.push('/')} />
      </span>
      <UserMenu />
    </nav>
  );
}