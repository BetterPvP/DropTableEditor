import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auth | BetterPvP Admin Console',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md py-16">{children}</div>;
}
