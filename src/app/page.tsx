'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user) {
                router.push('/dashboard');
            } else {
                router.push('/login');
            }
        }
    }, [user, loading, router]);

    return (
        <div className="h-screen flex items-center justify-center bg-background" suppressHydrationWarning>
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );
}
