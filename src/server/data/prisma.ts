// Re-export prisma from db.ts for backward compatibility
export { prisma } from '@/lib/db';
export default prisma;

// For backward compatibility, export prisma as prismaClient too
import { prisma } from '@/lib/db';
export const prismaClient = prisma;
