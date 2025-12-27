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
                        
                        // Helper to safely convert args to string
                        const safeStringify = (arg) => {
                            try {
                                if (typeof arg === 'string') return arg;
                                if (typeof arg === 'object' && arg !== null) {
                                    // Handle circular refs
                                    const seen = new WeakSet();
                                    return JSON.stringify(arg, (key, value) => {
                                        if (typeof value === 'object' && value !== null) {
                                            if (seen.has(value)) return '[Circular]';
                                            seen.add(value);
                                        }
                                        return value;
                                    });
                                }
                                return String(arg);
                            } catch (e) {
                                return '';
                            }
                        };

                        console.error = function(...args) {
                            // Convert all args to a searchable string
                            const allArgs = args.map(safeStringify).join(' ');

                            // Filter conditions
                            if (
                                allArgs.includes('bis_skin_checked') ||
                                allArgs.includes('bis_skin_checked="1"') ||
                                allArgs.includes('A tree hydrated but some attributes') ||
                                allArgs.includes('hydration') && allArgs.includes('mismatch') ||
                                allArgs.includes('Warning: Prop') && allArgs.includes('did not match')
                            ) {
                                return;
                            }
                            
                            originalError.apply(console, args);
                        };
                    })();
                `
            }}
        />
    );
}
