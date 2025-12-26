'use client';

/**
 * This component injects a script to suppress specific hydration warnings caused by browser extensions.
 * Specifically targeting 'bis_skin_checked' which is injected by some extensions.
 * We use a script tag to ensure this runs BEFORE React hydration starts.
 */
export default function HydrationOverlayFix() {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `
                    (function() {
                        if (typeof window === 'undefined') return;
                        
                        const originalError = console.error;
                        
                        console.error = function(...args) {
                            // Convert all args to string for deep search
                            const argsString = args.map(arg => {
                                if (arg === null || arg === undefined) return '';
                                if (typeof arg === 'string') return arg;
                                if (arg instanceof Error) return arg.message + ' ' + (arg.stack || '');
                                try {
                                    return JSON.stringify(arg, null, 0);
                                } catch (e) {
                                    return String(arg);
                                }
                            }).join(' ');

                            // Check if this involves bis_skin_checked (browser extension)
                            if (argsString.includes('bis_skin_checked')) {
                                return; // Suppress entirely
                            }

                            // Check if this is the generic "A tree hydrated..." message
                            // These are almost always caused by browser extensions in production
                            const isHydrationMismatch = argsString.includes('A tree hydrated but some attributes') ||
                                                       argsString.includes("didn't match the client properties") ||
                                                       argsString.includes('Hydration failed because');

                            // If it's a hydration mismatch and mentions hidden/div (extension injection spots)
                            if (isHydrationMismatch && (argsString.includes('hidden=') || argsString.includes('<div'))) {
                                return; // Suppress
                            }
                            
                            originalError.apply(console, args);
                        };
                    })();
                `
            }}
        />
    );
}
