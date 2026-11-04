#!/bin/bash

# Production Deployment Script for Ordex OMS
# Usage: ./scripts/deploy-production.sh [--skip-tests] [--force] [--backup]

set -e

# Configuration
DEPLOYMENT_TYPE=${1:-docker}
SKIP_TESTS=false
FORCE_DEPLOY=false
CREATE_BACKUP=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/deployment-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    --backup)
      CREATE_BACKUP=true
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --skip-tests    Skip running tests before deployment"
      echo "  --force         Force deployment even if health checks fail"
      echo "  --backup        Create database backup before deployment"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Error handling
cleanup_on_error() {
    log_error "Deployment failed! Cleaning up..."
    
    # Stop any running containers if deployment failed
    if [ -f "$PROJECT_ROOT/docker-compose.production.yml" ]; then
        log_info "Stopping failed deployment containers..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.production.yml" down --remove-orphans
    fi
    
    log_error "Check the deployment log: $LOG_FILE"
    exit 1
}

trap cleanup_on_error ERR

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker service."
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed. Please install docker-compose."
        exit 1
    fi
    
    # Check if production environment file exists
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        log_error "Production environment file not found!"
        log_error "Please copy .env.production.template to .env.production and configure it."
        exit 1
    fi
    
    # Check if required environment variables are set
    source "$PROJECT_ROOT/.env.production"
    
    if [ -z "$DATABASE_URL" ] || [ -z "$JWT_SECRET" ]; then
        log_error "Required environment variables are not set in .env.production"
        log_error "Please ensure DATABASE_URL and JWT_SECRET are configured."
        exit 1
    fi
    
    log_success "Prerequisites check passed!"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if we're on the right branch
    current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    if [ "$current_branch" != "main" ] && [ "$FORCE_DEPLOY" != "true" ]; then
        log_error "Production deployments should be from 'main' branch. Current branch: $current_branch"
        log_error "Use --force to override this check."
        exit 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        if [ "$FORCE_DEPLOY" != "true" ]; then
            log_error "Uncommitted changes detected. Please commit or stash changes before deployment."
            log_error "Use --force to override this check."
            exit 1
        else
            log_warn "Uncommitted changes detected but deployment is forced."
        fi
    fi
    
    # Run tests if not skipped
    if [ "$SKIP_TESTS" != "true" ]; then
        log_info "Running tests..."
        cd "$PROJECT_ROOT"
        npm test || {
            log_error "Tests failed!"
            if [ "$FORCE_DEPLOY" != "true" ]; then
                exit 1
            else
                log_warn "Tests failed but deployment is forced."
            fi
        }
    else
        log_warn "Skipping tests as requested."
    fi
    
    log_success "Pre-deployment checks passed!"
}

# Create database backup
create_database_backup() {
    if [ "$CREATE_BACKUP" = "true" ]; then
        log_info "Creating database backup..."
        
        # Create backup directory
        mkdir -p "$PROJECT_ROOT/backups"
        
        # Generate backup filename
        BACKUP_FILE="$PROJECT_ROOT/backups/backup-$(date +%Y%m%d-%H%M%S).sql"
        
        # Create backup (if database is running)
        if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps postgres | grep -q "Up"; then
            docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \\\n                pg_dump -U postgres oms_development > "$BACKUP_FILE"
            log_success "Database backup created: $BACKUP_FILE"
        else
            log_warn "Database is not running, skipping backup."
        fi
    fi
}

# Check external services health
check_external_services() {
    log_info "Checking external services configuration..."
    
    # Source environment variables
    source "$PROJECT_ROOT/.env.production"
    
    # Check if any external services are configured
    services_configured=0
    
    if [ -n "$GOOGLE_CLIENT_EMAIL" ] && [ -n "$GOOGLE_PRIVATE_KEY" ] && [ -n "$GOOGLE_CALENDAR_ID" ]; then
        log_info "Google Calendar integration is configured"
        ((services_configured++))
    else
        log_warn "Google Calendar integration is not configured"
    fi
    
    if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ] && [ -n "$TWILIO_FROM_NUMBER" ]; then
        log_info "Twilio SMS integration is configured"
        ((services_configured++))
    else
        log_warn "Twilio SMS integration is not configured"
    fi
    
    if [ -n "$MAPBOX" ] || [ -n "$NEXT_PUBLIC_MAPBOX_TOKEN" ]; then
        log_info "Mapbox geocoding is configured"
        ((services_configured++))
    else
        log_warn "Mapbox geocoding is not configured"
    fi
    
    if [ $services_configured -eq 0 ]; then
        log_warn "No external services are configured. The system will work with reduced functionality."
    else
        log_info "$services_configured external service(s) configured."
    fi
}

# Deploy application
deploy_application() {
    log_info "Starting application deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.production.yml down --remove-orphans || true
    
    # Pull latest images and rebuild
    log_info "Building application image..."
    docker-compose -f docker-compose.production.yml build --no-cache oms-app
    
    # Start services
    log_info "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    
    # Wait for database
    max_retries=30
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U postgres &>/dev/null; then
            log_success "Database is ready!"
            break
        fi
        ((retry_count++))
        log_info "Waiting for database... ($retry_count/$max_retries)"
        sleep 2
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log_error "Database failed to start within expected time."
        exit 1
    fi
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose -f docker-compose.production.yml exec -T oms-app npx prisma migrate deploy
    
    # Wait for application
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if curl -f http://localhost:3000/api/health &>/dev/null; then
            log_success "Application is ready!"
            break
        fi
        ((retry_count++))
        log_info "Waiting for application... ($retry_count/$max_retries)"
        sleep 3
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log_error "Application failed to start within expected time."
        exit 1
    fi
    
    log_success "Application deployment completed!"
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification..."
    
    # Test basic health endpoint
    if curl -f http://localhost:3000/api/health &>/dev/null; then
        log_success "Basic health check passed!"
    else
        log_error "Basic health check failed!"
        exit 1
    fi
    
    # Test detailed health endpoint
    health_response=$(curl -s http://localhost:3000/api/health?detailed=true)
    if echo "$health_response" | jq -e '.status' &>/dev/null; then
        health_status=$(echo "$health_response" | jq -r '.status')
        log_info "Detailed health status: $health_status"
        
        if [ "$health_status" = "healthy" ]; then
            log_success "All services are healthy!"
        elif [ "$health_status" = "degraded" ]; then
            log_warn "Some services are degraded but application is functional."
        else
            log_error "Application health check indicates unhealthy status."
            if [ "$FORCE_DEPLOY" != "true" ]; then
                exit 1
            fi
        fi
    else
        log_warn "Could not parse detailed health response."
    fi
    
    # Test external services health
    external_health=$(curl -s http://localhost:3000/api/health/external)
    if echo "$external_health" | jq -e '.healthPercentage' &>/dev/null; then
        health_percentage=$(echo "$external_health" | jq -r '.healthPercentage')\n        log_info "External services health: $health_percentage%"\n    fi\n    \n    log_success "Post-deployment verification completed!"
}

# Display deployment summary
display_summary() {
    log_success "=========================================="
    log_success "DEPLOYMENT COMPLETED SUCCESSFULLY!"
    log_success "=========================================="
    log_info "Application URL: http://localhost:3000"
    log_info "Health Check: http://localhost:3000/api/health"
    log_info "Detailed Health: http://localhost:3000/api/health?detailed=true"
    log_info "External Services: http://localhost:3000/api/health/external"
    log_info ""
    log_info "Deployment log: $LOG_FILE"
    log_info ""
    log_info "To view application logs:"
    log_info "  docker-compose -f docker-compose.production.yml logs -f oms-app"
    log_info ""
    log_info "To stop the application:"
    log_info "  docker-compose -f docker-compose.production.yml down"
    log_info ""
    log_success "Deployment completed at $(date)"
}

# Main deployment function
main() {
    log_info "=========================================="
    log_info "STARTING ORDEX OMS PRODUCTION DEPLOYMENT"
    log_info "=========================================="
    log_info "Deployment started at $(date)"
    log_info "Deployment type: $DEPLOYMENT_TYPE"
    log_info "Skip tests: $SKIP_TESTS"
    log_info "Force deploy: $FORCE_DEPLOY"
    log_info "Create backup: $CREATE_BACKUP"
    log_info ""
    
    check_prerequisites
    pre_deployment_checks
    create_database_backup
    check_external_services
    deploy_application
    post_deployment_verification
    display_summary
}

# Run main function
main "$@"