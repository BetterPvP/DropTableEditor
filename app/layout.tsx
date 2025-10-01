import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { Providers } from '@/components/providers';
import { AppHeader } from '@/components/navigation/app-header';
import { SideNav } from '@/components/navigation/side-nav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BetterPvP Admin Console',
  description: 'Modern administration console for BetterPvP Clans loot tables and tools.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const environment = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppHeader environment={environment as 'development' | 'staging' | 'production'} />
            <div className="flex flex-1">
              <SideNav />
              <main className="flex-1 overflow-y-auto px-6 py-8">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-16">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
