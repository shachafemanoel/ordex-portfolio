import pg from 'pg';

// Run once using the migration owner's DIRECT_URL, before enabling tenant runtime.
const role = process.env.DATABASE_RUNTIME_ROLE || 'retzef_runtime';
const password = process.env.DATABASE_RUNTIME_PASSWORD || '';
if (!/^[a-z][a-z0-9_]{2,62}$/.test(role) || password.length < 32 || !process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL, a valid DATABASE_RUNTIME_ROLE and a 32+ character DATABASE_RUNTIME_PASSWORD are required');
}
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
try {
  await client.connect();
  await client.query('BEGIN');
  const owner = await client.query('SELECT current_user AS name');
  if (owner.rows[0].name === role) throw new Error('Runtime role must differ from migration owner');
  const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
  const command = await client.query(`SELECT format('${existing.rowCount ? 'ALTER' : 'CREATE'} ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS sql`, [role, password]);
  await client.query(command.rows[0].sql);
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${role}"`);
  await client.query('COMMIT');
  console.log('Runtime role provisioned. Configure DATABASE_URL with that role; keep DIRECT_URL migration-only. No credential values printed.');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Runtime role provisioning failed; no credential details logged.');
  process.exitCode = 1;
} finally {
  await client.end();
}
