'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import LoadingOverlay from './LoadingOverlay';

const PUBLIC_ROUTES = ['/', '/login'];

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();
    const pathname = usePathname();

    if (loading && !PUBLIC_ROUTES.includes(pathname)) {
        return <LoadingOverlay />;
    }

    return <>{children}</>;
}
