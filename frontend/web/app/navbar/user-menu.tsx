'use client';
import { signInWithGoogle, signOutUser } from "../google-firebase/authentication";
import { User } from "firebase/auth";

interface SignInProps {
  user: User | null;
}

export default function UserMenu({ user }: SignInProps) {
  return (user ?
    (
      <button
        onClick={signOutUser}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Sign Out
      </button>
    ) :
    (
      <button
        onClick={signInWithGoogle}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Sign In with Google
      </button>
    ))
}