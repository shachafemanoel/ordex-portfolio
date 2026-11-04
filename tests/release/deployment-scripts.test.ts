import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('release migration failure propagation', () => {
  it.each(['scripts/render-predeploy.sh', 'scripts/docker-migrate.sh'])('%s stops on a failed migration without resolving or retrying it', (script) => {
    const directory = mkdtempSync(join(tmpdir(), 'retzef-release-test-'));
    directories.push(directory);
    const calls = join(directory, 'calls');
    const node = join(directory, 'node');
    writeFileSync(node, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\nexit 43\n');
    chmodSync(node, 0o700);
    const result = spawnSync('/bin/bash', [script], { env: { PATH: `${directory}:/usr/bin:/bin`, DATABASE_URL: 'postgresql://synthetic@localhost/test', CALLS: calls }, encoding: 'utf8' });
    expect(result.status).toBe(43);
    expect(readFileSync(calls, 'utf8').trim().split('\n')).toEqual(['./node_modules/prisma/build/index.js migrate deploy']);
  });
});

describe('production runtime validation', () => {
  const environment = {
    NODE_ENV: 'production',
    TENANT_ENFORCEMENT: 'true',
    DATABASE_URL: 'postgresql://secret-canary@localhost/test',
    AUTH_JWT_SECRET: 'synthetic-auth-secret-at-least-thirty-two-characters',
    ENCRYPTION_KEY: '01'.repeat(32),
    APP_URL: 'https://retzef.example',
  };
  it('accepts a complete configuration without printing credential values', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-env.js'], { env: environment, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain('secret-canary');
    expect(result.stdout + result.stderr).not.toContain(environment.AUTH_JWT_SECRET);
  });
  it('rejects disabled business isolation in production', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-env.js'], { env: { ...environment, TENANT_ENFORCEMENT: 'false' }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TENANT_ENFORCEMENT');
  });
  it.each(['AUTH_FALLBACK_ENABLED', 'DEMO_MODE', 'AUTO_SEED_DEMO_DATA', 'SKIP_DB_ON_BUILD', 'DOCKER_BUILD', 'SKIP_ENV_VALIDATION'])('rejects %s in production', (flag) => {
    const result = spawnSync(process.execPath, ['scripts/validate-env.js'], { env: { ...environment, [flag]: 'true' }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(flag);
  });
});
