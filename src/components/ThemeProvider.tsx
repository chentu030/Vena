'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import React, { useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <NextThemesProvider
            attribute="data-theme"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange={false} // Enable smooth transitions
        >
            {children}
        </NextThemesProvider>
    );
}
