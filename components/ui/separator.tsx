export function Separator({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  if (orientation === 'vertical') {
    return <div className="mx-2 h-6 w-px bg-white/10" role="separator" aria-orientation="vertical" />;
  }
  return <div className="my-2 h-px w-full bg-white/10" role="separator" aria-orientation="horizontal" />;
}
