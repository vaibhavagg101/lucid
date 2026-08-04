'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import LoadingOverlay from './LoadingOverlay';

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();
    const pathname = usePathname();

    if (loading && pathname !== '/login') {
        return <LoadingOverlay />;
    }

    return <>{children}</>;
}
