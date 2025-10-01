export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background/80 to-background/60 px-4 py-12">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-white/10 p-8 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
