#!/bin/bash
# Post-Deployment Health Check Script
# Runs after a deployment to verify system health
# Exit codes: 0 = healthy, 1 = unhealthy

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 Post-Deployment Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
MAX_RETRIES=${MAX_RETRIES:-10}
RETRY_DELAY=${RETRY_DELAY:-5}
DEPLOYMENT_URL=${DEPLOYMENT_URL:-"localhost:3000"}

# Add protocol if not present
if [[ ! "$DEPLOYMENT_URL" =~ ^https?:// ]]; then
    if [[ "$DEPLOYMENT_URL" == "localhost"* ]]; then
        DEPLOYMENT_URL="http://$DEPLOYMENT_URL"
    else
        DEPLOYMENT_URL="https://$DEPLOYMENT_URL"
    fi
fi

echo "🌐 Target URL: $DEPLOYMENT_URL"
echo "🔄 Max retries: $MAX_RETRIES"
echo "⏱️  Retry delay: ${RETRY_DELAY}s"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check_endpoint() {
    local endpoint=$1
    local description=$2
    local expected_status=${3:-200}
    local retry_count=0

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Checking: $description${NC}"
    echo -e "${BLUE}Endpoint: $endpoint${NC}"
    echo ""

    while [ $retry_count -lt $MAX_RETRIES ]; do
        retry_count=$((retry_count + 1))
        echo "Attempt $retry_count/$MAX_RETRIES..."

        # Make request with timeout
        response=$(curl -s -w "\n%{http_code}" -m 10 "$DEPLOYMENT_URL$endpoint" 2>&1 || echo "000")

        # Extract status code (last line)
        status_code=$(echo "$response" | tail -n1)

        # Extract body (everything except last line)
        body=$(echo "$response" | sed '$d')

        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✅ Success! Status: $status_code${NC}"
            echo ""

            # Print relevant info from response
            if command -v jq &> /dev/null && echo "$body" | jq empty 2>/dev/null; then
                echo "Response:"
                echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
            else
                echo "Response (first 200 chars):"
                echo "$body" | head -c 200
            fi

            echo ""
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            return 0
        else
            echo -e "${YELLOW}⚠️  Status: $status_code (expected $expected_status)${NC}"

            if [ $retry_count -lt $MAX_RETRIES ]; then
                echo "Retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
    done

    echo -e "${RED}❌ Failed after $MAX_RETRIES attempts${NC}"
    echo "Last status code: $status_code"
    echo "Last response (first 200 chars):"
    echo "$body" | head -c 200
    echo ""
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
    return 1
}

check_json_field() {
    local endpoint=$1
    local field_path=$2
    local expected_value=$3
    local description=$4

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Checking: $description${NC}"
    echo -e "${BLUE}Field: $field_path = $expected_value${NC}"
    echo ""

    response=$(curl -s -m 10 "$DEPLOYMENT_URL$endpoint" 2>&1 || echo "{}")

    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq not installed, skipping field check${NC}"
        echo ""
        return 0
    fi

    actual_value=$(echo "$response" | jq -r "$field_path" 2>/dev/null || echo "null")

    if [ "$actual_value" = "$expected_value" ]; then
        echo -e "${GREEN}✅ Field check passed: $field_path = $actual_value${NC}"
        echo ""
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ Field check failed${NC}"
        echo "Expected: $expected_value"
        echo "Actual: $actual_value"
        echo ""
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

echo "1️⃣  Basic Health Check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_endpoint "/api/health" "Basic health endpoint"

echo ""
echo "2️⃣  Environment Configuration Check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_endpoint "/api/health/env" "Environment variables check"

# Check specific fields
if command -v jq &> /dev/null; then
    check_json_field "/api/health/env" ".data.database" "true" "PostgreSQL configured"
    check_json_field "/api/health/env" ".data.redis" "true" "Redis configured" || \
        echo -e "${YELLOW}⚠️  Redis not configured - will use PostgreSQL fallback${NC}"
fi

echo ""
echo "3️⃣  Database Connectivity..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Try to fetch orders (tests database)
check_endpoint "/api/orders?limit=1" "Database query test"

echo ""
echo "4️⃣  Redis Health Check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Redis health endpoint exists
if curl -s -m 5 "$DEPLOYMENT_URL/api/health" | jq -e '.redis' &> /dev/null; then
    redis_status=$(curl -s -m 5 "$DEPLOYMENT_URL/api/health" | jq -r '.redis.status' 2>/dev/null || echo "unknown")

    if [ "$redis_status" = "healthy" ]; then
        echo -e "${GREEN}✅ Redis is healthy${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    elif [ "$redis_status" = "unavailable" ]; then
        echo -e "${YELLOW}⚠️  Redis unavailable - using PostgreSQL fallback${NC}"
        echo "This is OK - system will continue to work"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Redis status unknown: $redis_status${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Redis health info not available in response${NC}"
fi

echo ""
echo "5️⃣  Critical Endpoints..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Dashboard
check_endpoint "/api/dashboard/stats" "Dashboard statistics"

# Customers
check_endpoint "/api/customers?limit=1" "Customers API"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Health Check Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}❌ Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 DEPLOYMENT HEALTHY - ALL CHECKS PASSED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "✅ Deployment URL: $DEPLOYMENT_URL"
    echo "✅ Database: Connected"
    echo "✅ API: Responding"
    echo ""
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}🚨 DEPLOYMENT UNHEALTHY - SOME CHECKS FAILED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Check the application logs for details."
    echo ""
    echo "Common issues:"
    echo "  - Environment variables not set correctly"
    echo "  - Database migrations failed"
    echo "  - Redis connection issues (check if service is running)"
    echo ""
    exit 1
fi
