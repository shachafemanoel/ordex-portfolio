import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { hashPassword } from '../lib/auth/hash';
import { closeDatabaseConnection, withIdentityDatabase } from '../lib/db';
import { invitationCredentials } from '../lib/tenancy/invitations';

// Operator shell access is the authority for these commands. No HTTP endpoint exposes them.
async function main() {
  if (process.env.TENANT_ENFORCEMENT !== 'true') throw new Error('Tenant enforcement is required');
  const [command, ...args] = process.argv.slice(2);
  if (command === 'create') {
    const [name, email, output] = z
      .tuple([z.string().trim().min(1).max(120), z.string().email(), z.string().min(1)])
      .parse(args);
    const tenantId = randomUUID();
    const invitation = invitationCredentials();
    const url = new URL('/invite', process.env.APP_URL || '');
    url.hash = invitation.token;
    // Reserve a private output file before committing any database changes.
    await writeFile(
      output,
      JSON.stringify({ tenantId, inviteUrl: url.href, expiresAt: invitation.expiresAt }),
      { flag: 'wx', mode: 0o600 }
    );
    await withIdentityDatabase(async (db) => {
      await db.tenant.create({ data: { id: tenantId, name } });
      await db.tenantInvitation.create({
        data: {
          tenantId,
          email: email.toLowerCase(),
          role: 'ADMIN',
          tokenHash: invitation.tokenHash,
          expiresAt: invitation.expiresAt,
        },
      });
      await db.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await db.storeConfiguration.create({
        data: {
          id: tenantId.replaceAll('-', ''),
          tenantId,
          storeName: name,
          autoPurchaseOrder: false,
          taxRatePercent: 0,
        },
      });
    });
    console.log('Business created. One-time invitation saved to the private output file.');
  } else if (command === 'recover') {
    const [email] = z.tuple([z.string().email()]).parse(args);
    const password = z.string().min(12).max(128).parse(process.env.RECOVERY_PASSWORD);
    const passwordHash = await hashPassword(password);
    await withIdentityDatabase((db) =>
      db.user.update({
        where: { email: email.toLowerCase() },
        data: { password: passwordHash, sessionVersion: { increment: 1 }, isActive: true },
      })
    );
    console.log('Global account recovered. Existing sessions revoked; memberships unchanged.');
  } else {
    throw new Error(
      'Usage: tenant-operator.ts create <business name> <admin email> <private output path> | recover <email> (RECOVERY_PASSWORD required)'
    );
  }
}
main()
  .catch(() => {
    console.error(
      'Operator command failed. Check arguments, runtime configuration and database permissions; credentials are not logged.'
    );
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());
