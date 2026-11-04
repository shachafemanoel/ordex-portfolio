#!/bin/bash

set -e

echo "🔍 Production Deployment Validation Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
VALIDATION_PASSED=true
WARNINGS=()
ERRORS=()

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    WARNINGS+=("$1")
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS+=("$1")
    VALIDATION_PASSED=false
}

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# 1. Environment Variables Validation
echo "1. Validating Environment Variables"
echo "-----------------------------------"

# Core environment variables
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL is not set"
else
    log_success "DATABASE_URL is configured"
fi

if [ -z "$NODE_ENV" ]; then
    log_warning "NODE_ENV is not set, defaulting to production"
else
    log_success "NODE_ENV is set to: $NODE_ENV"
fi

if [ "$NODE_ENV" = "production" ]; then
    # Production-specific validations
    if [ -z "$ENCRYPTION_KEY" ]; then
        log_error "ENCRYPTION_KEY is required for production"
    elif [ ${#ENCRYPTION_KEY} -lt 32 ]; then
        log_error "ENCRYPTION_KEY must be at least 32 characters"
    else
        log_success "ENCRYPTION_KEY is properly configured"
    fi

    # WooCommerce configuration
    if [ -n "$WOOCOMMERCE_STORE_URL" ] && [ -n "$WOOCOMMERCE_KEY" ] && [ -n "$WOOCOMMERCE_PASSWORD" ]; then
        log_success "WooCommerce credentials are configured"
    else
        log_warning "WooCommerce credentials are not fully configured"
    fi

    # Optional services
    if [ -n "$REDIS_URL" ]; then
        log_success "Redis URL is configured"
    else
        log_warning "Redis is not configured - caching will be limited"
    fi
fi

echo ""

# 2. Database Connectivity
echo "2. Validating Database Connectivity"
echo "----------------------------------"

if [ -n "$DATABASE_URL" ]; then
    if command -v npx >/dev/null 2>&1; then
        # Prisma reads datasource URL from DATABASE_URL env (no --url flag on db execute)
        if npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
            log_success "Database connection successful"
        else
            log_error "Cannot connect to database"
        fi
    else
        log_warning "npx not available, skipping database connectivity test"
    fi
else
    log_error "Cannot test database connectivity - DATABASE_URL not set"
fi

echo ""

# 3. Application Files Validation
echo "3. Validating Application Files"
echo "------------------------------"

# Check for critical files
CRITICAL_FILES=(
    "package.json"
    "next.config.js"
    "prisma/schema.prisma"
    "Dockerfile"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
    else
        log_error "$file is missing"
    fi
done

# Check for build artifacts
if [ -d ".next" ]; then
    log_success ".next build directory exists"
else
    log_warning ".next build directory not found - build may be needed"
fi

echo ""

# 4. Dependencies Validation
echo "4. Validating Dependencies"
echo "-------------------------"

if [ -f "package.json" ] && [ -d "node_modules" ]; then
    # Check if node_modules is populated
    if [ "$(find node_modules -mindepth 1 -maxdepth 1 | wc -l)" -gt 0 ]; then
        log_success "node_modules is populated"
    else
        log_error "node_modules is empty - npm install required"
    fi
else
    log_error "Package.json or node_modules missing"
fi

echo ""

# 5. Prisma Client Validation
echo "5. Validating Prisma Setup"
echo "-------------------------"

if [ -f "prisma/schema.prisma" ]; then
    if command -v npx >/dev/null 2>&1; then
        if npx prisma validate --schema=prisma/schema.prisma 2>/dev/null; then
            log_success "Prisma schema is valid"
        else
            log_error "Prisma schema validation failed"
        fi
        
        # Check if Prisma client is generated
        if [ -d "node_modules/@prisma/client" ]; then
            log_success "Prisma client is generated"
        else
            log_warning "Prisma client not found - generation may be needed"
        fi
    else
        log_warning "npx not available, skipping Prisma validation"
    fi
else
    log_error "prisma/schema.prisma not found"
fi

echo ""

# 6. Health Endpoints Validation (if app is running)
echo "6. Validating Health Endpoints"
echo "-----------------------------"

PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"

# Check if the application is running
if curl -f -s "$BASE_URL/api/health/simple" >/dev/null 2>&1; then
    log_success "Application is running and responsive"
    
    # Test specific endpoints
    if curl -f -s "$BASE_URL/api/health/readiness" >/dev/null 2>&1; then
        log_success "Readiness endpoint is working"
    else
        log_error "Readiness endpoint is not responding"
    fi
    
    if curl -f -s "$BASE_URL/api/health/liveness" >/dev/null 2>&1; then
        log_success "Liveness endpoint is working"
    else
        log_error "Liveness endpoint is not responding"
    fi
else
    log_warning "Application is not running - skipping health endpoint tests"
fi

echo ""

# 7. Security Validation
echo "7. Security Validation"
echo "---------------------"

# Check for sensitive files that shouldn't be in production
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    ".git"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if [ -e "$file" ]; then
        log_warning "Sensitive file/directory found: $file"
    else
        log_success "No sensitive file: $file"
    fi
done

echo ""

# 8. Summary
echo "8. Validation Summary"
echo "-------------------"

if [ $VALIDATION_PASSED = true ]; then
    log_success "All critical validations passed!"
else
    log_error "Some critical validations failed!"
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Warnings:${NC}"
    for warning in "${WARNINGS[@]}"; do
        echo -e "${YELLOW}  - $warning${NC}"
    done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Errors:${NC}"
    for error in "${ERRORS[@]}"; do
        echo -e "${RED}  - $error${NC}"
    done
fi

echo ""
echo "Deployment validation completed."

# Exit with appropriate code
if [ $VALIDATION_PASSED = true ]; then
    exit 0
else
    exit 1
fi
