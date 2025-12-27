'use client';

if (typeof window !== 'undefined') {
    // Suppress specific console errors and warnings related to hydration

    const originalError = console.error;
    console.error = (...args: any[]) => {
        const errorStr = args.map(a => String(a)).join(' ');
        if (
            errorStr.includes('bis_skin_checked') ||
            errorStr.includes('Hydration') ||
            errorStr.includes('hydrated') ||
            errorStr.includes('hydrating') ||
            errorStr.includes('mismatch') ||
            (errorStr.includes('Prop') && errorStr.includes('did not match')) ||
            errorStr.includes('valid HTML nesting') ||
            errorStr.includes('A tree hydrated but some attributes')
        ) {
            return;
        }
        originalError.apply(console, args);
    };

    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
        const warnStr = args.map(a => String(a)).join(' ');
        if (
            warnStr.includes('bis_skin_checked') ||
            warnStr.includes('Hydration') ||
            warnStr.includes('hydrated') ||
            warnStr.includes('hydrating')
        ) {
            return;
        }
        originalWarn.apply(console, args);
    };
}
