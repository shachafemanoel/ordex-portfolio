const fs = require('fs');
const path = require('path');

// Revoked-key check (Railway incident, Oct 2026).
// scripts/revoked-key-fingerprints.json holds only a short prefix and/or a truncated
// SHA-256 fingerprint of each revoked value - never the value itself.
// Record an old value before rotating it:
//   node --env-file=.env scripts/validate-env.js --fingerprint GEMINI_API_KEY TWILIO_AUTH_TOKEN
// Set STRICT_REVOKED_KEYS=1 to fail instead of warn.
const crypto = require('crypto');
const fingerprint = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const MIN_PREFIX_LENGTH = 10;

if (process.argv[2] === '--fingerprint') {
  process.argv.slice(3).forEach((key) => {
    const value = (process.env[key] || '').trim();
    console.log(value ? `${key} sha256:${fingerprint(value)}` : `${key} (not set)`);
  });
  process.exit(0);
}

// Colors
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

console.log(`${green}🔍 Validating runtime environment...${reset}`);

const REQUIRED_VARS = [
  'DATABASE_URL',
  'AUTH_JWT_SECRET',
];

const OPTIONAL_VARS = [
  'GEMINI_API_KEY',
  'MAPBOX',
  'NEXT_PUBLIC_MAPBOX_TOKEN'
];

let hasError = false;

// Check required
REQUIRED_VARS.forEach((key) => {
  if (!process.env[key] || process.env[key].trim() === '') {
    console.error(`${red}❌ Missing required environment variable: ${key}${reset}`);
    hasError = true;
  } else {
    // Basic validation
    if (key === 'DATABASE_URL' && !process.env[key].startsWith('postgres')) {
        console.error(`${red}❌ DATABASE_URL must be a PostgreSQL URL${reset}`);
        hasError = true;
    }
    if (key === 'AUTH_JWT_SECRET' && process.env[key].length < 32) {
        console.error(`${red}❌ AUTH_JWT_SECRET must contain at least 32 characters${reset}`);
        hasError = true;
    }
    console.log(`${green}✅ ${key} is present${reset}`);
  }
});

if (process.env.NODE_ENV === 'production') {
  if (process.env.TENANT_ENFORCEMENT !== 'true') {
    console.error(`${red}❌ TENANT_ENFORCEMENT=true is required in the production runtime${reset}`);
    hasError = true;
  }
  const enabled = (name) => /^(true|1|on|yes|enabled)$/i.test((process.env[name] || '').trim());
  for (const name of ['AUTH_FALLBACK_ENABLED', 'DEMO_MODE', 'NEXT_PUBLIC_DEMO_MODE', 'AUTO_SEED_DEMO_DATA', 'DOCKER_BUILD', 'SKIP_DB_ON_BUILD', 'SKIP_ENV_VALIDATION']) {
    if (enabled(name)) {
      console.error(`${red}❌ ${name} cannot be enabled in the production runtime${reset}`);
      hasError = true;
    }
  }
  const key = process.env.ENCRYPTION_KEY || '';
  const bytes = Buffer.from(key, /^[a-f0-9]{64}$/i.test(key) ? 'hex' : 'base64');
  if (bytes.length !== 32) {
    console.error(`${red}❌ ENCRYPTION_KEY must decode to 32 bytes${reset}`);
    hasError = true;
  }
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '');
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    console.error(`${red}❌ NEXT_PUBLIC_APP_URL or APP_URL must be a valid HTTPS URL${reset}`);
    hasError = true;
  }
}

// Check optional
OPTIONAL_VARS.forEach((key) => {
  if (!process.env[key]) {
    console.log(`${yellow}⚠️  Optional variable missing: ${key}${reset}`);
  } else {
    console.log(`${green}✅ ${key} is present${reset}`);
  }
});

let revoked = [];
const revokedPath = path.join(__dirname, 'revoked-key-fingerprints.json');
if (fs.existsSync(revokedPath)) {
  try {
    revoked = JSON.parse(fs.readFileSync(revokedPath, 'utf8')).revoked || [];
  } catch (err) {
    console.warn(`${yellow}⚠️  Could not parse ${path.basename(revokedPath)}: ${err.message}${reset}`);
  }
}

let revokedHits = 0;
revoked.forEach((entry) => {
  const value = (process.env[entry.var] || '').trim();
  if (!value) return;
  const prefixHit =
    typeof entry.prefix === 'string' &&
    entry.prefix.length >= MIN_PREFIX_LENGTH &&
    value.startsWith(entry.prefix);
  const hashHit = typeof entry.sha256 === 'string' && fingerprint(value) === entry.sha256;
  if (prefixHit || hashHit) {
    revokedHits += 1;
    console.warn(
      `${yellow}⚠️  ${entry.var} matches a revoked key (revoked ${entry.revokedAt || 'unknown date'}). Rotate it.${reset}`
    );
  }
});
if (revokedHits > 0 && (process.env.STRICT_REVOKED_KEYS === '1' || process.env.NODE_ENV === 'production')) {
  hasError = true;
}

if (hasError) {
  console.error(`${red}🚨 Environment validation failed (missing required or revoked variables).${reset}`);
  process.exit(1);
}

console.log(`${green}✨ Environment validation passed.${reset}`);
