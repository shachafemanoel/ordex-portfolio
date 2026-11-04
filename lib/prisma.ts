// Compatibility imports must use the real runtime database client.
export * from '@/lib/db';
export { prisma as default } from '@/lib/db';
