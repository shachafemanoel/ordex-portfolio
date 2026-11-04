import { createHash } from 'node:crypto';
import { closeSync, openSync, createReadStream, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function connectionEnvironment(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL connection required');
  return {
    PATH: process.env.PATH,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get('sslmode') || (['localhost', '127.0.0.1', '::1'].includes(url.hostname) ? 'disable' : 'verify-full'),
    PGCONNECT_TIMEOUT: '10',
  };
}

function run(command, args, environment, output = 'pipe') {
  const result = spawnSync(command, args, { env: environment, stdio: ['ignore', output, 'pipe'], encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed; no credentials or database output are printed`);
  return result.stdout;
}

try {
  const [operation, filename] = process.argv.slice(2);
  if (!filename || !['create', 'verify'].includes(operation)) throw new Error('Usage: node scripts/database-backup.mjs create|verify /absolute/path.dump');
  const file = resolve(filename);
  if (operation === 'create') {
    const environment = connectionEnvironment(process.env.BACKUP_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || '');
    const descriptor = openSync(file, 'wx', 0o600);
    try {
      run('pg_dump', ['--format=custom', '--no-owner', '--no-acl'], environment, descriptor);
    } catch (error) {
      unlinkSync(file);
      throw error;
    } finally { closeSync(descriptor); }
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    console.log(JSON.stringify({ file, sha256: hash.digest('hex'), createdAt: new Date().toISOString() }));
  } else {
    // Restore exercises never target a runtime DB or a non-local server.
    const environment = connectionEnvironment(process.env.RESTORE_TEST_DATABASE_URL || '');
    if (!['localhost', '127.0.0.1', '::1'].includes(environment.PGHOST) || !/^retzef_restore_[a-z0-9_]+$/.test(environment.PGDATABASE)) throw new Error('Restore verification requires a local disposable database named retzef_restore_*');
    const tableCount = run('psql', ['-X', '-At', '-c', "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')"], environment);
    if (Number(tableCount.trim()) !== 0) throw new Error('Restore verification refuses a non-empty database');
    run('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', environment.PGDATABASE, file], environment);
    console.log(JSON.stringify({ verified: true, database: environment.PGDATABASE, verifiedAt: new Date().toISOString() }));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup operation failed');
  process.exitCode = 1;
}
