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
import HydrationOverlayFix from '@/components/HydrationOverlayFix';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`} suppressHydrationWarning>
        <HydrationOverlayFix />
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
