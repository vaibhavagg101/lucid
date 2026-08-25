'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithGithub } from '../google-firebase/authentication';
import Image from 'next/image';
import Link from 'next/link';
import lucidLogoOnPrimary from '../../public/master-logo-on-primary.svg';
import lucidLogoOnSurface from '../../public/master-logo-on-surface.svg';
import cassetteImage from '../../public/cassette.png';
import googleColor from '../../public/Google_Color.svg';
import githubBlack from '../../public/GitHub_Invertocat_Black.svg'

// Rainbow sheen clipped to the cassette's own silhouette via a mask image
const cassetteShineStyle: React.CSSProperties = {
    backgroundImage:
        'repeating-linear-gradient(105deg, #ff4d4d 0%, #ff9d4d 8%, #ffe94d 16%, #4dff88 24%, #4dd9ff 32%, #4d6bff 40%, #b34dff 48%, #ff4d4d 56%)',
    WebkitMaskImage: `url(${cassetteImage.src})`,
    maskImage: `url(${cassetteImage.src})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
};

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
        <div className="main-without-navbar bg-background dark:bg-linear-to-b dark:from-primary-variant dark:to-black relative min-w-full min-h-dvh grid lg:grid-cols-2 grid-cols-1 items-center justify-center overflow-hidden">
            <div className="relative z-20 mx-auto justify-self-center lg:block hidden">
                <Image
                    src={cassetteImage}
                    alt="Cassette with its reel removed, symbolising the deconstruction of music"
                    className="w-lg"
                    priority
                />
                <div aria-hidden className="absolute inset-0 mix-blend-screen opacity-[0.09] pointer-events-none" style={cassetteShineStyle} />
            </div>
            {/* Main Card */}
            <div className="border border-outline/30 bg-surface backdrop-blur-xl rounded-4xl shadow-2xl shadow-black/50 dark:border-white/15 dark:bg-white/5 relative z-20 mx-auto grid grid-cols-1 lg:w-8/12 md:w-10/12 min-h-10/12 w-full items-center justify-center p-8">
                <div className="text-center flex flex-col items-center justify-center space-y-4">
                    <Link href="/">
                        <Image src={lucidLogoOnSurface} alt="LUCID Logo" className="mx-auto w-96 dark:hidden" priority />
                        <Image src={lucidLogoOnPrimary} alt="LUCID Logo" className="mx-auto w-96 hidden dark:block" priority />
                    </Link>
                    <p className="text-lg text-on-surface-variant">
                        Sign in to deconstruct your music and unlock new insights
                    </p>
                </div>
                <div className="not-lg:block justify-center text-center hidden">
                    <div className="relative inline-block">
                        <Image
                            src={cassetteImage}
                            alt="Cassette with its reel removed, symbolising the deconstruction of music"
                            className="w-2/3 mx-auto my-auto"
                            priority
                        />
                        <div aria-hidden className="absolute inset-0 mix-blend-screen opacity-[0.09] pointer-events-none" style={cassetteShineStyle} />
                    </div>
                </div>
                {/* Sign In Section */}
                <div className="h-10/12 flex flex-col justify-center items-center space-y-6">
                    <p className="text-xs font-semibold tracking-[0.2em] uppercase text-on-surface-variant dark:text-white/50 mb-6">
                        Login to your account
                    </p>
                    <button
                        type="button"
                        onClick={() => handleSignIn(signInWithGoogle, 'Google')}
                        className="w-full md:w-auto px-8 py-3 border border-outline/30 bg-surface-variant text-on-surface rounded-lg hover:bg-surface cursor-pointer flex items-center justify-center gap-3 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    >
                        <Image src={googleColor} alt="Google Logo" className="w-5 h-5" />
                        Sign in with Google
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSignIn(signInWithGithub, 'GitHub')}
                        className="w-full md:w-auto px-8 py-3 border border-outline/30 bg-surface-variant text-on-surface rounded-lg hover:bg-surface cursor-pointer flex items-center justify-center gap-3 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    >
                        <Image src={githubBlack} alt="GitHub Logo" className="w-5 h-5 dark:invert" />
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
