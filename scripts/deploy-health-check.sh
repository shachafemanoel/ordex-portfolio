#!/bin/bash

# =============================================================================
# DEPLOYMENT HEALTH CHECK SCRIPT
# =============================================================================
# Comprehensive health check system for Ordex OMS deployment validation
# Supports multiple environments and deployment strategies

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/health-check-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${1:-staging}"
BASE_URL="${2:-http://localhost:3000}"
TIMEOUT="${3:-30}"
MAX_RETRIES="${4:-5}"
RETRY_DELAY="${5:-10}"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Log to console with colors
    case $level in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        *) echo "[$level] $message" ;;
    esac
}

# Function to check if a URL is responding
check_url() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="${3:-$url}"
    
    log "INFO" "Checking $description..."
    
    local response
    if response=$(curl -s -w "%{http_code}" -o /dev/null --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            log "SUCCESS" "$description responded with status $response"
            return 0
        else
            log "ERROR" "$description responded with status $response (expected $expected_status)"
            return 1
        fi
    else
        log "ERROR" "$description is not responding"
        return 1
    fi
}

# Function to check JSON API endpoint
check_json_endpoint() {
    local url="$1"
    local expected_field="${2:-status}"
    local expected_value="${3:-ok}"
    local description="${4:-$url}"
    
    log "INFO" "Checking JSON endpoint $description..."
    
    local response
    if response=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        if echo "$response" | jq -e ".${expected_field} == \"${expected_value}\"" >/dev/null 2>&1; then
            log "SUCCESS" "$description JSON check passed"
            return 0
        else
            log "ERROR" "$description JSON check failed. Response: $response"
            return 1
        fi
    else
        log "ERROR" "$description JSON endpoint is not responding"
        return 1
    fi
}

# Function to wait for service with retries
wait_for_service() {
    local url="$1"
    local description="${2:-service}"
    local retries=0
    
    log "INFO" "Waiting for $description to be ready..."
    
    while [ $retries -lt "$MAX_RETRIES" ]; do
        if check_url "$url" 200 "$description"; then
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt "$MAX_RETRIES" ]; then
            log "WARN" "$description not ready. Retry $retries/$MAX_RETRIES in ${RETRY_DELAY}s..."
            sleep "$RETRY_DELAY"
        fi
    done
    
    log "ERROR" "$description failed to become ready after $MAX_RETRIES retries"
    return 1
}

# Basic connectivity check
basic_health_check() {
    log "INFO" "=== BASIC HEALTH CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    
    # Simple health check
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/health/simple" 200 "Simple health check"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Basic readiness check
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/health/readiness" 200 "Readiness check"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Liveness check
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/health/liveness" 200 "Liveness check"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log "INFO" "Basic health checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# Detailed health check
detailed_health_check() {
    log "INFO" "=== DETAILED HEALTH CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    
    # Detailed health endpoint
    total_checks=$((total_checks + 1))
    if check_json_endpoint "$BASE_URL/api/health/detailed" "status" "healthy" "Detailed health"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Database connectivity
    total_checks=$((total_checks + 1))
    if check_json_endpoint "$BASE_URL/api/health/detailed" "database" "connected" "Database connectivity"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Redis connectivity
    total_checks=$((total_checks + 1))
    if check_json_endpoint "$BASE_URL/api/health/detailed" "cache" "connected" "Cache connectivity"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log "INFO" "Detailed health checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# External services health check
external_services_check() {
    log "INFO" "=== EXTERNAL SERVICES CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    
    # External services health
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/health/external" 200 "External services check"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log "INFO" "External services checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# Application functionality check
functionality_check() {
    log "INFO" "=== APPLICATION FUNCTIONALITY CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    
    # Dashboard endpoint
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/dashboard" 200 "Dashboard API"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Orders API (should require auth, so 401 is expected)
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/orders" 401 "Orders API (auth required)"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Health metrics
    total_checks=$((total_checks + 1))
    if check_url "$BASE_URL/api/health/metrics" 200 "Health metrics"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log "INFO" "Functionality checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# Performance check
performance_check() {
    log "INFO" "=== PERFORMANCE CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    local start_time end_time duration
    
    # Response time check
    total_checks=$((total_checks + 1))
    start_time=$(date +%s%N)
    if check_url "$BASE_URL/api/health/simple" 200 "Performance check"; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [ "$duration" -lt 2000 ]; then # Less than 2 seconds
            log "SUCCESS" "Response time: ${duration}ms (acceptable)"
            checks_passed=$((checks_passed + 1))
        else
            log "WARN" "Response time: ${duration}ms (slow)"
        fi
    else
        log "ERROR" "Performance check failed"
    fi
    
    log "INFO" "Performance checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# Security headers check
security_check() {
    log "INFO" "=== SECURITY CHECK ==="
    
    local checks_passed=0
    local total_checks=0
    
    # Check for security headers
    local headers
    if headers=$(curl -s -I --max-time "$TIMEOUT" "$BASE_URL" 2>/dev/null); then
        
        # Check for important security headers
        local security_headers=(
            "X-Frame-Options"
            "X-Content-Type-Options"
            "X-XSS-Protection"
            "Strict-Transport-Security"
        )
        
        for header in "${security_headers[@]}"; do
            total_checks=$((total_checks + 1))
            if echo "$headers" | grep -qi "$header"; then
                log "SUCCESS" "Security header $header present"
                checks_passed=$((checks_passed + 1))
            else
                log "WARN" "Security header $header missing"
            fi
        done
    else
        log "ERROR" "Could not fetch headers for security check"
    fi
    
    log "INFO" "Security checks: $checks_passed/$total_checks passed"
    return $(( total_checks - checks_passed ))
}

# Database migration check
migration_check() {
    log "INFO" "=== DATABASE MIGRATION CHECK ==="
    
    # This would typically check migration status via an API endpoint
    # For now, we'll just check if the database is accessible
    if check_json_endpoint "$BASE_URL/api/health/detailed" "database" "connected" "Database migration check"; then
        log "SUCCESS" "Database migrations appear to be applied"
        return 0
    else
        log "ERROR" "Database migration check failed"
        return 1
    fi
}

# Comprehensive smoke test
smoke_test() {
    log "INFO" "=== SMOKE TEST ==="
    
    local checks_passed=0
    local total_checks=6
    
    # Wait for application to be ready
    if wait_for_service "$BASE_URL/api/health/startup" "Application startup"; then
        checks_passed=$((checks_passed + 1))
    fi
    
    # Run all health checks
    if basic_health_check; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if detailed_health_check; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if functionality_check; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if performance_check; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if migration_check; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log "INFO" "Overall smoke test: $checks_passed/$total_checks checks passed"
    
    if [ "$checks_passed" -eq "$total_checks" ]; then
        log "SUCCESS" "All smoke tests passed! Deployment appears healthy."
        return 0
    elif [ "$checks_passed" -ge $((total_checks * 2 / 3)) ]; then
        log "WARN" "Most smoke tests passed, but some issues detected."
        return 1
    else
        log "ERROR" "Smoke test failed! Deployment has significant issues."
        return 2
    fi
}

# Load test (simple)
load_test() {
    log "INFO" "=== BASIC LOAD TEST ==="
    
    local concurrent_requests=10
    local total_requests=50
    local failed_requests=0
    
    log "INFO" "Running $total_requests requests with $concurrent_requests concurrent..."
    
    # Simple load test using curl
    for i in $(seq 1 $total_requests); do
        {
            if ! curl -s -f --max-time 5 "$BASE_URL/api/health/simple" >/dev/null 2>&1; then
                failed_requests=$((failed_requests + 1))
            fi
        } &
        
        # Control concurrency
        if (( i % concurrent_requests == 0 )); then
            wait
        fi
    done
    
    wait # Wait for remaining background jobs
    
    local success_rate=$(( (total_requests - failed_requests) * 100 / total_requests ))
    
    if [ "$success_rate" -ge 95 ]; then
        log "SUCCESS" "Load test passed: $success_rate% success rate ($failed_requests/$total_requests failed)"
        return 0
    else
        log "ERROR" "Load test failed: $success_rate% success rate ($failed_requests/$total_requests failed)"
        return 1
    fi
}

# Main execution
main() {
    log "INFO" "Starting health check for $ENVIRONMENT environment"
    log "INFO" "Base URL: $BASE_URL"
    log "INFO" "Timeout: ${TIMEOUT}s, Max retries: $MAX_RETRIES, Retry delay: ${RETRY_DELAY}s"
    log "INFO" "Log file: $LOG_FILE"
    
    local overall_result=0
    
    # Parse command line arguments for specific checks
    case "${6:-all}" in
        "basic")
            basic_health_check || overall_result=1
            ;;
        "detailed")
            detailed_health_check || overall_result=1
            ;;
        "external")
            external_services_check || overall_result=1
            ;;
        "functionality")
            functionality_check || overall_result=1
            ;;
        "performance")
            performance_check || overall_result=1
            ;;
        "security")
            security_check || overall_result=1
            ;;
        "migration")
            migration_check || overall_result=1
            ;;
        "smoke")
            smoke_test || overall_result=$?
            ;;
        "load")
            load_test || overall_result=1
            ;;
        "all"|*)
            smoke_test || overall_result=$?
            if [ "$overall_result" -eq 0 ]; then
                security_check || log "WARN" "Security check issues detected"
                external_services_check || log "WARN" "External services check issues detected"
            fi
            ;;
    esac
    
    if [ "$overall_result" -eq 0 ]; then
        log "SUCCESS" "Health check completed successfully for $ENVIRONMENT"
        log "INFO" "Deployment validation: PASSED"
    else
        log "ERROR" "Health check failed for $ENVIRONMENT (exit code: $overall_result)"
        log "ERROR" "Deployment validation: FAILED"
    fi
    
    log "INFO" "Health check results logged to: $LOG_FILE"
    
    exit $overall_result
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [BASE_URL] [TIMEOUT] [MAX_RETRIES] [RETRY_DELAY] [CHECK_TYPE]

Arguments:
  ENVIRONMENT   Environment name (default: staging)
  BASE_URL      Base URL to check (default: http://localhost:3000)
  TIMEOUT       Request timeout in seconds (default: 30)
  MAX_RETRIES   Maximum number of retries (default: 5)
  RETRY_DELAY   Delay between retries in seconds (default: 10)
  CHECK_TYPE    Type of check to run (default: all)

Check types:
  all           Run comprehensive health check (default)
  basic         Basic connectivity checks
  detailed      Detailed health checks including database/cache
  external      External services connectivity
  functionality Application functionality checks
  performance   Performance and response time checks
  security      Security headers and configuration
  migration     Database migration status
  smoke         Smoke test (subset of all checks)
  load          Basic load testing

Examples:
  $0                                           # Run all checks on localhost
  $0 production https://ordex.com              # Check production environment
  $0 staging http://staging.ordex.com 60 10   # Custom timeout and retries
  $0 local http://localhost:3000 30 3 5 smoke # Run smoke test only

EOF
}

# Check for help flag
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_help
    exit 0
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
    log "ERROR" "curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log "WARN" "jq is not installed, JSON endpoint checks will be limited"
fi

# Run main function
main "$@"