'use client';
import { useRouter } from "next/navigation";
import { signOutUser } from "../google-firebase/authentication";
import { User } from "firebase/auth";
import { useState } from "react";

interface SignInProps {
  user: User | null;
}

export default function UserMenu({ user }: SignInProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (user ?
    (
      <div className="relative">
        <div className="hidden md:flex gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-on-primary px-4 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition"
          >
            Dashboard
          </button>
          <button
            onClick={signOutUser}
            className="text-on-primary px-4 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition"
          >
            Logout
          </button>
        </div>
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-on-primary px-2 py-2 rounded-2xl hover:bg-primary-variant cursor-pointer transition flex items-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-surface rounded-2xl shadow-lg py-2 z-10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard");
                }}
                className="block w-full text-left px-4 py-2 text-on-surface active:bg-surface-variant transition"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOutUser();
                }}
                className="block w-full text-left px-4 py-2 text-on-surface active:bg-surface-variant transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    ) :
    (
      <button
        onClick={() => router.push("/login")}
        className="bg-surface text-on-secondary px-4 py-2 rounded-2xl hover:bg-surface-variant cursor-pointer transition"
      >
        Login
      </button>
    ))
}