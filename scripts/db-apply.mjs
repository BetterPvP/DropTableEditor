// Applies db/sql/*.sql (in filename order) to DATABASE_URL.
// Idempotent: every statement uses IF NOT EXISTS. Dev convenience only —
// production schema ownership belongs to the game's Flyway migrations.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(here, '..', 'db', 'sql');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const files = readdirSync(sqlDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(sqlDir, file), 'utf8');
    process.stdout.write(`Applying ${file} … `);
    await client.query(sql);
    console.log('ok');
  }
  console.log(`\nApplied ${files.length} file(s).`);
} catch (err) {
  console.error('\nFailed to apply schema:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
