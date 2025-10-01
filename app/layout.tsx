import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TransparencyProvider } from "@/components/providers/transparency-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProviderContext } from "@/components/ui/use-toast";

const font = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BetterPvP Admin Console",
  description: "Modern loot table tools for BetterPvP Clans.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider>
          <TransparencyProvider>
            <QueryProvider>
              <ToastProviderContext>{children}</ToastProviderContext>
            </QueryProvider>
          </TransparencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
