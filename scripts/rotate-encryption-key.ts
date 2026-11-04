/**
 * Re-encrypt data protected by ENCRYPTION_KEY (lib/crypto.ts, AES-256-GCM).
 *
 * Context: Railway env-var incident, Oct 2026. The old ENCRYPTION_KEY must be
 * treated as exposed, so everything encrypted with it is re-encrypted with a new key.
 *
 * What is encrypted with ENCRYPTION_KEY today (git grep encryptSecret/decryptSecret):
 *   - workspace_google_integrations.refresh_token_{cipher,iv,tag}  (Google OAuth refresh token)
 *   - workspace_google_integrations.access_token_{cipher,iv,tag}   (short-lived access token, nullable)
 *
 * Env:
 *   DATABASE_URL          target database
 *   ENCRYPTION_KEY_OLD    current key (falls back to ENCRYPTION_KEY)
 *   ENCRYPTION_KEY_NEW    new key (64-char hex or base64 of 32 bytes)
 *
 * Usage:
 *   npx tsx scripts/rotate-encryption-key.ts            # dry run: decrypt-only check, no writes
 *   npx tsx scripts/rotate-encryption-key.ts --apply    # re-encrypt in a single transaction
 *
 * DO NOT RUN without explicit approval. Back up the table first.
 * Never logs plaintext or key material; only row ids and counts.
 *
 * Alternative (simpler, also recommended because the Google client secret is being
 * rotated anyway): delete the rows and reconnect Google Workspace from the admin UI.
 * Refresh tokens issued to the old OAuth client should be revoked regardless.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Same parsing rules as getKey() in lib/crypto.ts.
function parseKey(raw: string | undefined, name: string): Buffer {
  if (!raw) throw new Error(`Missing ${name}`);
  const buf = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes (hex or base64)`);
  return buf;
}

function decrypt(key: Buffer, cipher: Uint8Array, iv: Uint8Array, tag: Uint8Array): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  return Buffer.concat([decipher.update(Buffer.from(cipher)), decipher.final()]);
}

function encrypt(key: Buffer, plain: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const cipher = Buffer.concat([c.update(plain), c.final()]);
  return { cipher, iv, tag: c.getAuthTag() };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const oldKey = parseKey(process.env.ENCRYPTION_KEY_OLD ?? process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY_OLD');
  const newKey = parseKey(process.env.ENCRYPTION_KEY_NEW, 'ENCRYPTION_KEY_NEW');
  if (oldKey.equals(newKey)) throw new Error('ENCRYPTION_KEY_NEW must differ from the old key');
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.workspaceGoogleIntegration.findMany();
    console.log(`workspace_google_integrations rows: ${rows.length}`);

    const updates: Array<{ id: string; data: Record<string, Buffer | null> }> = [];
    let failures = 0;

    for (const row of rows) {
      try {
        const refreshPlain = decrypt(oldKey, row.refreshTokenCipher, row.refreshTokenIv, row.refreshTokenTag);
        const r = encrypt(newKey, refreshPlain);
        const data: Record<string, Buffer | null> = {
          refreshTokenCipher: r.cipher,
          refreshTokenIv: r.iv,
          refreshTokenTag: r.tag,
        };

        if (row.accessTokenCipher && row.accessTokenIv && row.accessTokenTag) {
          try {
            const accessPlain = decrypt(oldKey, row.accessTokenCipher, row.accessTokenIv, row.accessTokenTag);
            const a = encrypt(newKey, accessPlain);
            data.accessTokenCipher = a.cipher;
            data.accessTokenIv = a.iv;
            data.accessTokenTag = a.tag;
          } catch {
            // Access tokens are short-lived; drop it and let the app refresh.
            data.accessTokenCipher = null;
            data.accessTokenIv = null;
            data.accessTokenTag = null;
          }
        }

        // Round-trip check with the new key before writing anything.
        decrypt(newKey, r.cipher, r.iv, r.tag);
        updates.push({ id: row.id, data });
        console.log(`  ok   row ${row.id} (store ${row.storeId})`);
      } catch {
        failures += 1;
        console.log(`  FAIL row ${row.id} (store ${row.storeId}): cannot decrypt with old key`);
      }
    }

    if (failures > 0) {
      console.log(`${failures} row(s) failed. Nothing written. Fix the old key or delete/reconnect those rows.`);
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log(`Dry run: ${updates.length} row(s) would be re-encrypted. Re-run with --apply.`);
      return;
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.workspaceGoogleIntegration.update({
          where: { id: u.id },
          data: u.data,
          select: { id: true },
        })
      )
    );
    console.log(`Re-encrypted ${updates.length} row(s). Now set ENCRYPTION_KEY to the new key and redeploy.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'rotate-encryption-key failed');
  process.exit(1);
});
