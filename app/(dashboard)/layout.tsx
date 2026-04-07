import { AppHeader } from '@/components/navigation/app-header';
import { SideNav } from '@/components/navigation/side-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const environment = (process.env.NEXT_PUBLIC_APP_ENV ?? 'development') as
    | 'development'
    | 'staging'
    | 'production';

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader environment={environment} />
      <div className="flex flex-1">
        <SideNav />
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-16">{children}</div>
        </main>
      </div>
    </div>
  );
}
