import '@/lib/suppress-hydration';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Venalium',
  description: 'AI-powered Research Assistant',
};

import { AuthProvider } from '@/lib/auth';
import { AnalysisProvider } from '@/context/AnalysisContext';
import ClientAnalysisWidget from '@/components/ClientAnalysisWidget';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function shouldSuppress(str) {
                  return str && (
                    str.includes('bis_skin_checked') ||
                    str.includes('Hydration') ||
                    str.includes('hydrated') ||
                    str.includes('hydrating') ||
                    str.includes('mismatch') ||
                    str.includes('match') ||
                    str.includes('server rendered') ||
                    str.includes('client properties')
                  );
                }
                
                var originalError = console.error;
                console.error = function() {
                  var str = Array.prototype.slice.call(arguments).map(function(a) { return String(a) }).join(' ');
                  if (shouldSuppress(str)) return;
                  originalError.apply(console, arguments);
                };
                
                var originalWarn = console.warn;
                console.warn = function() {
                  var str = Array.prototype.slice.call(arguments).map(function(a) { return String(a) }).join(' ');
                  if (shouldSuppress(str)) return;
                  originalWarn.apply(console, arguments);
                };
                
                // Also patch window.onerror for extra safety
                window.addEventListener('error', function(e) {
                  if (e.message && shouldSuppress(e.message)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return true;
                  }
                }, true);
              })();
            `,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <AnalysisProvider>
              {children}
              <ClientAnalysisWidget />
            </AnalysisProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
