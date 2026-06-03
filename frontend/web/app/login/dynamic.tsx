'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithGithub } from '../google-firebase/authentication';
import Image from 'next/image';
import Link from 'next/link';
import lucidLogoOnSurface from '../../public/master-logo-on-surface.svg';
import cassetteImage from '../../public/cassette.png';
import googleColor from '../../public/Google_Color.svg';
import githubBlack from '../../public/GitHub_Invertocat_Black.svg'

export default function DynamicLoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = async (signInMethod: () => Promise<any>, providerName: string) => {
        setError(null);

        try {
            await signInMethod();
            router.push('/');
        } catch (signInError) {
            console.error(`${providerName} sign-in failed:`, signInError);
            setError('Sign in failed. Please try again.');
        }
    };

    return (
        <div className="main-without-navbar bg-background relative grid lg:grid-cols-2 grid-cols-1 min-h-screen min-w-screen items-center justify-center overflow-hidden">
            <div className="relative z-20 mx-auto lg:block hidden">
                <Image
                    src={cassetteImage}
                    alt="Cassette with its reel removed, symbolising the deconstruction of music"
                    className="w-lg"
                    priority
                />
            </div>
            {/* Main Card */}
            <div className="glassmorphism-surface shadow-md not-lg:shadow-sm shadow-blue-950 relative z-20 mx-auto grid grid-cols-1 lg:w-8/12 md:w-10/12 min-h-10/12 w-full items-center justify-center">
                <div className="text-center flex flex-col items-center justify-center space-y-4">
                    <Link href="/">
                        <Image src={lucidLogoOnSurface} alt="LUCID Logo" className="mx-auto w-96" priority />
                    </Link>
                    <p className="text-lg text-on-surface-variant">
                        Sign in to deconstruct your music and unlock new insights
                    </p>
                </div>
                <div className="not-lg:block justify-center text-center hidden">
                    <Image
                        src={cassetteImage}
                        alt="Cassette with its reel removed, symbolising the deconstruction of music"
                        className="w-2/3 mx-auto my-auto"
                        priority
                    />
                </div>
                {/* Sign In Section */}
                <div className="h-10/12 flex flex-col justify-center items-center space-y-6">
                    <p className="text-md font-bold text-on-surface-variant mb-6">
                        Login to your account
                    </p>
                    <button
                        type="button"
                        onClick={() => handleSignIn(signInWithGoogle, 'Google')}
                        className="w-full md:w-auto px-8 py-3 bg-surface text-on-surface-variant rounded-lg hover:bg-surface-variant cursor-pointer flex items-center justify-center gap-3 shadow-md hover:shadow-xs"
                    >
                        <Image src={googleColor} alt="Google Logo" className="w-5 h-5" />
                        Sign in with Google
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSignIn(signInWithGithub, 'GitHub')}
                        className="w-full md:w-auto px-8 py-3 bg-surface text-on-surface-variant rounded-lg hover:bg-surface-variant cursor-pointer flex items-center justify-center gap-3 shadow-md hover:shadow-xs"
                    >
                        <Image src={githubBlack} alt="GitHub Logo" className="w-5 h-5" />
                        Sign in with GitHub
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
