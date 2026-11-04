import bcrypt from 'bcryptjs';

const DEFAULT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('Password must be at most 72 UTF-8 bytes');

  const rounds = Number.isNaN(Number(process.env.BCRYPT_ROUNDS))
    ? DEFAULT_ROUNDS
    : Math.max(10, Number(process.env.BCRYPT_ROUNDS));

  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification failed', error);
    return false;
  }
}
