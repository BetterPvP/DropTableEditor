import { notFound } from 'next/navigation';
import { tuningBySlug } from '@/lib/tuning/registry';
import { listTuningRows } from '@/lib/db/repositories/tuning';
import { TuningEditor } from '@/components/tuning/tuning-editor';

export default async function TuningPage({ params }: { params: { table: string } }) {
  const def = tuningBySlug(params.table);
  if (!def) notFound();

  const rows = await listTuningRows(def.table, def.keyColumn);

  return (
    <TuningEditor
      slug={def.slug}
      label={def.label}
      description={def.description}
      keyColumn={def.keyColumn}
      sample={def.sample}
      rows={rows.map((r) => ({ key: r.key, definition: r.definition }))}
    />
  );
}
