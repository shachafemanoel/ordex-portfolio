#!/usr/bin/env node

/**
 * Setup validation script
 * Checks if the critical fixes are working properly
 */

console.log('🔍 Validating OMS Architecture Fixes...\n');

// 1. Check if Prisma is properly installed
try {
  const { PrismaClient } = require('@prisma/client');
  console.log('✅ Prisma Client - Available');
} catch (error) {
  console.log('❌ Prisma Client - Not available');
  console.error('Error:', error.message);
}

// 2. Check if JWT libraries are installed
try {
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  console.log('✅ JWT & Bcrypt Libraries - Available');
} catch (error) {
  console.log('❌ JWT & Bcrypt Libraries - Not available');
  console.error('Error:', error.message);
}

// 3. Check environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length === 0) {
  console.log('✅ Environment Variables - All required variables present');
} else {
  console.log('⚠️  Environment Variables - Missing variables:', missingEnvVars);
  console.log('   You may need to create a .env file with these variables');
}

// 4. Check if files exist
const fs = require('fs');
const path = require('path');

const criticalFiles = [
  'prisma/schema.prisma',
  'lib/auth.ts',
  'lib/db.ts',
  'app/api/auth/login/route.ts'
];

const missingFiles = criticalFiles.filter(file => {
  try {
    return !fs.existsSync(path.join(process.cwd(), file));
  } catch {
    return true;
  }
});

if (missingFiles.length === 0) {
  console.log('✅ Critical Files - All files present');
} else {
  console.log('❌ Critical Files - Missing files:', missingFiles);
}

// 5. Try to import our new modules
try {
  const auth = require('@/lib/auth');
  console.log('✅ Auth Module - Importable');
} catch (error) {
  console.log('❌ Auth Module - Import failed');
  console.error('Error:', error.message);
}

console.log('\n🎉 Setup validation complete!');
console.log('\nNext steps:');
console.log('1. Set up your DATABASE_URL in .env file');
console.log('2. Run: npx prisma migrate deploy (in production) or npx prisma db push (in development)');
console.log('3. Test the authentication endpoints');
console.log('4. Start the application with: npm run dev');