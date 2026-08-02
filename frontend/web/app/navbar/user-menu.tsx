'use client';
import { useRouter } from "next/navigation";
import { signOutUser } from "../google-firebase/authentication";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/auth-context";
import type { User } from "firebase/auth";

// Generate initials from name
function getInitial(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}

// Avatar generation using profile photo or initials
function Avatar({ user, sizeClass }: { user: User; sizeClass: string }) {
  const label = user.displayName ?? user.email ?? "Profile";
  if (user.photoURL) {
    return (
      // Plain <img> rather than next/image
      <img
        src={user.photoURL}
        alt={label}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-secondary text-on-secondary flex items-center justify-center font-semibold`}
      aria-label={label}
    >
      {getInitial(user.displayName ?? user.email)}
    </div>
  );
}

export default function UserMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!desktopOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (desktopRef.current && !desktopRef.current.contains(event.target as Node)) {
        setDesktopOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [desktopOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="bg-primary-variant/75 text-on-primary px-4 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition"
      >
        <p className="hidden not-md:block">Login</p>
        <p className="hidden md:block">Login to Get Started</p>
      </button>
    );
  }

  const displayName = user.displayName ?? user.email ?? "User";

  const navigateTo = (path: string) => {
    setMobileOpen(false);
    setDesktopOpen(false);
    router.push(path);
  };

  const handleLogout = () => {
    setMobileOpen(false);
    setDesktopOpen(false);
    signOutUser();
  };

  return (
    <>
      <div ref={desktopRef} className="justify-center items-center relative md:flex not-md:hidden gap-6">
        {/* Workspace button */}
        <div>
          <button
            onClick={() => navigateTo("/workspace")}
            className="px-3 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition text-on-primary">
            Workspace
          </button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-on-primary opacity-30" aria-hidden="true" />

        {/* Profile button */}
        <div className="w-60 relative">
          <button
            onClick={() => setDesktopOpen((open) => !open)}
            className="flex items-center gap-3 px-2 py-1 rounded-2xl hover:bg-primary-variant cursor-pointer transition text-on-primary"
            aria-haspopup="menu"
            aria-expanded={desktopOpen}
          >
            <Avatar user={user} sizeClass="w-9 h-9" />
            <span className="max-w-48 truncate">{displayName}</span>
            <svg
              className={`w-4 h-4 transition-transform ${desktopOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Pop Up Menu Desktop */}
          {desktopOpen && (
            <div
              className="flex glassmorphism-primary text-on-primary absolute w-full rounded-b-2xl text-center justify-center shadow-lg py-2 z-50"
              role="menu"
            >
              <button
                onClick={handleLogout}
                className="block rounded-2xl w-10/12 text-center justify-center px-4 py-2 hover:bg-primary-variant cursor-pointer transition"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-on-primary px-2 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition flex items-center"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && createPortal(
        <div
          className="fixed inset-0 z-100 flex items-center justify-center backdrop-blur-md bg-on-background/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="glassmorphism-primary text-on-primary relative w-[85%] max-w-sm rounded-3xl p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-primary-variant cursor-pointer transition"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mt-2 mb-6 pr-8">
              <Avatar user={user} sizeClass="w-12 h-12" />
              <span className="text-lg font-semibold truncate">{displayName}</span>
            </div>

            <nav className="flex flex-col gap-1">
              <button
                onClick={() => navigateTo('/')}
                className="text-left px-4 py-3 rounded-2xl hover:bg-primary-variant active:bg-primary-variant cursor-pointer transition"
              >
                Home
              </button>
              <button
                onClick={() => navigateTo('/workspace')}
                className="text-left px-4 py-3 rounded-2xl hover:bg-primary-variant active:bg-primary-variant cursor-pointer transition"
              >
                Workspace
              </button>
              <button
                onClick={handleLogout}
                className="text-left px-4 py-3 rounded-2xl hover:bg-primary-variant active:bg-primary-variant cursor-pointer transition"
              >
                Logout
              </button>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
