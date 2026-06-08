// Dev convenience: insert a reusable invite code so you can sign up immediately.
// Not for production — invite codes there are issued deliberately.
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const INVITE_CODE = process.env.DEV_INVITE_CODE ?? 'DEV-1';

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  // Re-arm on every run so the dev invite is reusable across sign-ups.
  await client.query(
    `INSERT INTO invite_codes (code, role) VALUES ($1, 'admin')
     ON CONFLICT (code) DO UPDATE SET used_at = NULL, used_by = NULL`,
    [INVITE_CODE],
  );
  console.log(`Dev invite code ready: ${INVITE_CODE}  (use it on /auth/sign-up)`);
} catch (err) {
  console.error('Bootstrap failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
