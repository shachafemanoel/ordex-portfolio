#!/usr/bin/env tsx

/**
 * Manual Migration Script for Render Production Environment
 * 
 * This script applies the production hardening migrations that failed during
 * automated deployment due to P1017 PgBouncer connection issues.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient({
  errorFormat: 'minimal',
  transactionOptions: {
    timeout: 60000, // 60 seconds for migration operations
    maxWait: 10000,
  }
});

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message || '');
      const isConnectionError = /Server has closed the connection|P1017|Connection terminated|ECONNRESET|timeout/i.test(msg);
      
      if (!isConnectionError || i === attempts - 1) {
        console.error(`❌ Attempt ${i + 1}/${attempts} failed:`, msg);
        throw e;
      }
      
      console.log(`⚠️  Attempt ${i + 1}/${attempts} failed with connection error, retrying...`);
      
      // PgBouncer connection cycling
      try {
        await prisma.$disconnect();
        await new Promise(r => setTimeout(r, 500));
      } catch {}
      
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 10000);
    }
  }
  throw new Error('unreachable');
}

async function applyProductionMigrations() {
  console.log('🚀 Starting manual production migration deployment...\n');

  // Test database connectivity first
  console.log('1️⃣ Testing database connectivity...');
  await withRetry(async () => {
    await prisma.$queryRaw`SELECT NOW() as timestamp`;
    console.log('✅ Database connected successfully');
  });

  // Apply production guardrails
  console.log('\n2️⃣ Applying production guardrails migration...');
  const guardrailsPath = join(__dirname, '../prisma/migrations/999_production_guardrails.sql');
  
  try {
    const guardrailsSql = readFileSync(guardrailsPath, 'utf-8');
    
    // Split by semicolon and filter out empty statements
    const statements = guardrailsSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      await withRetry(async () => {
        await prisma.$executeRawUnsafe(stmt);
      });
    }
    
    console.log('✅ Production guardrails applied successfully');
  } catch (error) {
    console.error('❌ Failed to apply production guardrails:', error);
    throw error;
  }

  // Verify migrations were applied
  console.log('\n3️⃣ Verifying migration application...');
  
  await withRetry(async () => {
    // Check for status machine trigger
    const triggers = await prisma.$queryRaw`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' 
        AND trigger_name = 'trg_order_status_guard'
    ` as any[];
    
    if (triggers.length > 0) {
      console.log('✅ Status machine trigger found');
    } else {
      console.log('⚠️  Status machine trigger not found');
    }

    // Check for money constraints
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND constraint_name LIKE 'chk_money%'
    ` as any[];
    
    console.log(`✅ Found ${constraints.length} money integrity constraints`);

    // Check for materialized views
    const views = await prisma.$queryRaw`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public'
    ` as any[];
    
    console.log(`✅ Found ${views.length} materialized views`);
  });

  console.log('\n🎉 Production migration deployment completed successfully!');
}

async function main() {
  try {
    await applyProductionMigrations();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration deployment failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(1);
});

if (require.main === module) {
  main();
}

export { applyProductionMigrations };