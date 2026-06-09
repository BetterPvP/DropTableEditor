import { notFound } from 'next/navigation';
import { tuningBySlug } from '@/lib/tuning/registry';
import { listTuningRows } from '@/lib/db/repositories/tuning';
import { PurityDistributionEditor } from '@/components/tuning/distribution-editor';
import { ReforgeBiasEditor } from '@/components/tuning/reforge-bias-editor';
import { RuneSlotEditor } from '@/components/tuning/runeslot-editor';

export default async function TuningPage({ params }: { params: { table: string } }) {
  const def = tuningBySlug(params.table);
  if (!def) notFound();

  const rows = (await listTuningRows(def.table, def.keyColumn)).map((r) => ({ key: r.key, definition: r.definition }));

  switch (def.slug) {
    case 'purity-distributions':
      return <PurityDistributionEditor slug={def.slug} rows={rows} />;
    case 'purity-reforge-bias':
      return <ReforgeBiasEditor slug={def.slug} rows={rows} />;
    case 'purity-rune-slots':
      return <RuneSlotEditor slug={def.slug} rows={rows} />;
    default:
      notFound();
  }
}
