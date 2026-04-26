'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChangedListener } from '../google-firebase/authentication';
import { User } from 'firebase/auth';
import UserMenu from './user-menu';
import Image from 'next/image';
import lucidLogoOnPrimary from '../../public/master-logo-on-primary.svg';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((currentUser) => {
      setUser(currentUser)
    });

    return () => {
      unsubscribe()
    };
  }, [])

  // Hide navbar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="navbar glassmorphism-primary">
      {user ? (
        <>
          <span className="text-on-primary">Welcome, {user.displayName}</span>
        </>
      ) : (
        <span>
          <Image src={lucidLogoOnPrimary} alt="LUCID Logo" className="w-40" />
        </span>
      )}
      <UserMenu user={user} />
    </nav>
  );
}