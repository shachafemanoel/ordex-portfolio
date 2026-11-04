import { getBasePrismaClient } from '@/lib/db';

// Use the shared base client configuration from lib/db.ts
// This ensures we use the correct adapter configuration and build-safe logic (dummy URL during build)
export const prismaLite = getBasePrismaClient();
