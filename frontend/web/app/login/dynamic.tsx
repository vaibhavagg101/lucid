'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import lucidLogoOnSurface from '../../public/master-logo-on-surface.svg';
import { signInWithGoogle } from '../google-firebase/authentication';

export default function DynamicLoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setError(null);

        try {
            await signInWithGoogle();
            router.push('/');
        } catch (signInError) {
            console.error('Google sign-in failed:', signInError);
            setError('Sign in failed. Please try again.');
        }
    };

    return (
        <div className="main-without-navbar login-page-bg min-h-screen w-full items-center justify-center flex">
            <div className="glassmorphism-surface grid grid-cols-1 min-w-10/12 min-h-full items-center justify-center">
                <div className="text-center">
                    <Image src={lucidLogoOnSurface} alt="LUCID Logo" className="mx-auto w-96 hover:cursor-pointer" onClick={() => router.push('/')} />
                    <p className="text-lg text-on-surface-variant">
                        Sign in to deconstruct your music and unlock new insights
                    </p>
                </div>
                {/* Sign In Section */}
                <div className="h-96 flex flex-col justify-center items-center md:space-y-4">
                    <div>
                        <p className="text-md md:text-xl font-bold text-on-surface-variant mb-3">
                            Login to your account
                        </p>
                    </div>
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full md:w-auto px-8 py-3 bg-surface text-on-surface-variant rounded-lg hover:bg-surface-variant cursor-pointer transition-colors duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" className="w-5 h-5" />
                        Sign in with Google
                    </button>

                    {error ? (
                        <p className="mt-3 text-sm text-error text-center md:text-left" role="alert" aria-live="polite">
                            {error}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
