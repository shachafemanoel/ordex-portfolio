#!/bin/bash

##############################################################################
# Production Validation Script
#
# Validates all critical pages and API endpoints after deployment
# to ensure error handling improvements are working correctly.
#
# Usage:
#   ./scripts/validate-production.sh [BASE_URL] [AUTH_TOKEN]
#
# Example:
#   ./scripts/validate-production.sh https://ordex.com eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
#
# Environment Variables:
#   BASE_URL       - Base URL of the application (default: http://localhost:3000)
#   AUTH_TOKEN     - JWT token for authenticated requests
#   VERBOSE        - Set to 'true' for detailed output
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
AUTH_TOKEN="${2:-${AUTH_TOKEN:-}}"
VERBOSE="${VERBOSE:-false}"

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Arrays to store results
declare -a FAILED_ENDPOINTS=()
declare -a WARNINGS=()

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${NC}  $1${NC}"
    fi
}

##############################################################################
# Test Functions
##############################################################################

# Test an API endpoint
test_api_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=$3
    local check_field=$4

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    log_verbose "Testing: $endpoint"

    # Build curl command
    local headers=()
    if [ -n "$AUTH_TOKEN" ]; then
        headers+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi

    # Make request
    local response
    local status_code

    response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "${BASE_URL}${endpoint}" 2>&1) || {
        print_error "$description - Connection failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$endpoint - Connection failed")
        return 1
    }

    status_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | sed '$d')

    log_verbose "Status: $status_code"

    # Check status code
    if [ "$status_code" -ne "$expected_status" ]; then
        print_error "$description - Expected $expected_status, got $status_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$endpoint - Status: $status_code")

        if [ "$VERBOSE" = "true" ]; then
            echo "$body" | head -n 10
        fi
        return 1
    fi

    # Check for error messages in body
    if echo "$body" | grep -qi "failed to fetch\|משהו השתבש\|500 internal server error\|typeerror\|cannot read property"; then
        print_error "$description - Error message found in response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$endpoint - Error in response")

        if [ "$VERBOSE" = "true" ]; then
            echo "$body" | grep -i "error\|failed"
        fi
        return 1
    fi

    # Check for specific field if provided
    if [ -n "$check_field" ]; then
        if ! echo "$body" | grep -q "\"$check_field\""; then
            print_warning "$description - Field '$check_field' not found"
            WARNINGS+=("$endpoint - Missing field: $check_field")
        fi
    fi

    # Check for valid JSON
    if ! echo "$body" | jq . > /dev/null 2>&1; then
        print_error "$description - Invalid JSON response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$endpoint - Invalid JSON")
        return 1
    fi

    print_success "$description"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

# Test a web page
test_web_page() {
    local path=$1
    local description=$2
    local expected_text=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    log_verbose "Testing page: $path"

    # Make request
    local response
    local status_code

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${path}" 2>&1) || {
        print_error "$description - Connection failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$path - Connection failed")
        return 1
    }

    status_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | sed '$d')

    # Check status code
    if [ "$status_code" -ne 200 ]; then
        print_error "$description - Status: $status_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$path - Status: $status_code")
        return 1
    fi

    # Check for error messages
    if echo "$body" | grep -qi "failed to fetch\|משהו השתבש\|500 internal server error\|typeerror\|cannot read property"; then
        print_error "$description - Error message found"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$path - Error in page")
        return 1
    fi

    # Check for expected text if provided
    if [ -n "$expected_text" ]; then
        if ! echo "$body" | grep -q "$expected_text"; then
            print_warning "$description - Expected text not found: $expected_text"
            WARNINGS+=("$path - Missing expected text")
        fi
    fi

    print_success "$description"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

##############################################################################
# Main Test Execution
##############################################################################

print_header "Ordex Production Validation"
echo ""
print_info "Base URL: $BASE_URL"
print_info "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Check if server is reachable
print_header "Connectivity Check"
if ! curl -s --head --fail "${BASE_URL}" > /dev/null 2>&1; then
    print_error "Cannot reach $BASE_URL"
    exit 1
fi
print_success "Server is reachable"
echo ""

# Test API Endpoints
print_header "API Endpoints"

test_api_endpoint "/api/health" 200 "Health Check" "status"

test_api_endpoint "/api/receiving" 200 "Receiving Dashboard" "pendingItems"

test_api_endpoint "/api/products?page=1&limit=20" 200 "Products List" "items"

test_api_endpoint "/api/skus/list?pageSize=20" 200 "SKUs List" "items"

test_api_endpoint "/api/management/overview" 200 "Management Overview" "stats"

test_api_endpoint "/api/users?limit=50" 200 "Users List" "users"

test_api_endpoint "/api/notifications/preferences?customerPhone=0501234567" 200 "Notification Preferences" "success"

test_api_endpoint "/api/store/settings" 200 "Store Settings" "storeName"

test_api_endpoint "/api/integrations/providers" 200 "Integration Providers"

test_api_endpoint "/api/integrations/connections" 200 "Integration Connections" "connections"

test_api_endpoint "/api/integrations/woocommerce/test" 200 "WooCommerce Test" "success"

test_api_endpoint "/api/integrations/woocommerce/webhooks" 200 "WooCommerce Webhooks" "webhooks"

echo ""

# Test Web Pages (if not API-only mode)
if [ "${API_ONLY:-false}" != "true" ]; then
    print_header "Web Pages"

    test_web_page "/receiving" "Receiving Page"

    test_web_page "/products" "Products Page"

    test_web_page "/skus" "SKUs Page"

    test_web_page "/map" "Map View"

    test_web_page "/management/overview" "Management Overview Page"

    test_web_page "/admin/users" "Users Management Page"

    test_web_page "/settings" "Store Settings Page"

    test_web_page "/admin/integrations" "Integrations Admin Page"

    test_web_page "/notifications" "Notifications Center"

    test_web_page "/purchase-orders" "Purchase Orders Page"

    test_web_page "/calendar" "Calendar Page"

    echo ""
fi

##############################################################################
# Results Summary
##############################################################################

print_header "Test Results Summary"
echo ""

echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
else
    echo -e "Failed:       $FAILED_TESTS"
fi
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo -e "Warnings:     ${YELLOW}${#WARNINGS[@]}${NC}"
fi

echo ""

# Print failed endpoints
if [ ${#FAILED_ENDPOINTS[@]} -gt 0 ]; then
    print_error "Failed Endpoints:"
    for endpoint in "${FAILED_ENDPOINTS[@]}"; do
        echo "  - $endpoint"
    done
    echo ""
fi

# Print warnings
if [ ${#WARNINGS[@]} -gt 0 ]; then
    print_warning "Warnings:"
    for warning in "${WARNINGS[@]}"; do
        echo "  - $warning"
    done
    echo ""
fi

# Final status
if [ $FAILED_TESTS -eq 0 ]; then
    print_success "✓ All tests passed!"
    echo ""
    echo -e "${GREEN}Production validation successful.${NC}"
    echo -e "${GREEN}All critical pages and APIs are functioning correctly.${NC}"
    exit 0
else
    print_error "✗ Some tests failed"
    echo ""
    echo -e "${RED}Production validation failed.${NC}"
    echo -e "${RED}Please review the failed endpoints above.${NC}"
    exit 1
fi
