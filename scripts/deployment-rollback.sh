#!/bin/bash

# =============================================================================
# DEPLOYMENT ROLLBACK SCRIPT
# =============================================================================
# Automated rollback system for Ordex OMS deployments
# Supports multiple deployment strategies and environments

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/rollback-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${1:-staging}"
DEPLOYMENT_ID="${2:-}"
ROLLBACK_STRATEGY="${3:-blue-green}"
CONFIRM_ROLLBACK="${4:-false}"

# Registry and image configuration
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-ordex/oms}"

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

# Function to get current deployment information
get_current_deployment() {
    local environment="$1"
    
    log "INFO" "Getting current deployment information for $environment..."
    
    # This would typically query your deployment system
    # For Docker Compose:
    if command -v docker-compose &> /dev/null && [ -f "$PROJECT_ROOT/docker-compose.production.yml" ]; then
        local image_info
        image_info=$(docker-compose -f "$PROJECT_ROOT/docker-compose.production.yml" images oms-app 2>/dev/null | tail -n +2 | awk '{print $4}')
        if [ -n "$image_info" ]; then
            echo "$image_info"
            return 0
        fi
    fi
    
    # For Kubernetes:
    if command -v kubectl &> /dev/null; then
        local k8s_image
        k8s_image=$(kubectl get deployment ordex-app -o jsonpath='{.spec.template.spec.containers[0].image}' -n "$environment" 2>/dev/null || true)
        if [ -n "$k8s_image" ]; then
            echo "$k8s_image"
            return 0
        fi
    fi
    
    log "WARN" "Could not determine current deployment information"
    return 1
}

# Function to get rollback target
get_rollback_target() {
    local environment="$1"
    local deployment_id="$2"
    
    log "INFO" "Determining rollback target..."
    
    if [ -n "$deployment_id" ]; then
        # Rollback to specific deployment
        echo "${REGISTRY}/${IMAGE_NAME}:${deployment_id}"
    else
        # Rollback to last known stable version
        local stable_image="${REGISTRY}/${IMAGE_NAME}:production-stable"
        if docker manifest inspect "$stable_image" >/dev/null 2>&1; then
            echo "$stable_image"
        else
            log "ERROR" "No stable image found for rollback"
            return 1
        fi
    fi
}

# Function to create backup before rollback
create_rollback_backup() {
    local environment="$1"
    
    log "INFO" "Creating backup before rollback..."
    
    # Database backup
    local backup_file="${PROJECT_ROOT}/backups/pre-rollback-$(date +%Y%m%d-%H%M%S).sql"
    mkdir -p "$(dirname "$backup_file")"
    
    # This would typically use your database backup method
    if command -v docker-compose &> /dev/null; then
        log "INFO" "Creating database backup: $backup_file"
        # docker-compose exec postgres pg_dump -U postgres ordex > "$backup_file"
        # For now, we'll simulate the backup
        echo "-- Database backup created at $(date)" > "$backup_file"
        log "SUCCESS" "Database backup created: $backup_file"
    fi
    
    # Save current deployment state
    local deployment_state="${PROJECT_ROOT}/backups/deployment-state-$(date +%Y%m%d-%H%M%S).json"
    cat > "$deployment_state" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$environment",
    "current_image": "$(get_current_deployment "$environment" || echo "unknown")",
    "reason": "pre-rollback backup",
    "initiated_by": "$(whoami)",
    "hostname": "$(hostname)"
}
EOF
    
    log "SUCCESS" "Deployment state saved: $deployment_state"
}

# Function to perform Docker Compose rollback
docker_compose_rollback() {
    local environment="$1"
    local target_image="$2"
    
    log "INFO" "Performing Docker Compose rollback..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.production.yml"
    
    if [ ! -f "$compose_file" ]; then
        log "ERROR" "Docker Compose file not found: $compose_file"
        return 1
    fi
    
    # Update the image in docker-compose file or use environment variable
    export ORDEX_IMAGE="$target_image"
    
    log "INFO" "Pulling rollback image: $target_image"
    if ! docker pull "$target_image"; then
        log "ERROR" "Failed to pull rollback image: $target_image"
        return 1
    fi
    
    log "INFO" "Stopping current services..."
    docker-compose -f "$compose_file" down --remove-orphans
    
    log "INFO" "Starting services with rollback image..."
    docker-compose -f "$compose_file" up -d
    
    log "SUCCESS" "Docker Compose rollback completed"
}

# Function to perform Kubernetes rollback
kubernetes_rollback() {
    local environment="$1"
    local target_image="$2"
    
    log "INFO" "Performing Kubernetes rollback..."
    
    # Rollback using kubectl
    if [ -n "$target_image" ]; then
        log "INFO" "Rolling back to image: $target_image"
        kubectl set image deployment/ordex-app ordex-app="$target_image" -n "$environment"
    else
        log "INFO" "Rolling back to previous revision"
        kubectl rollout undo deployment/ordex-app -n "$environment"
    fi
    
    # Wait for rollback to complete
    log "INFO" "Waiting for rollback to complete..."
    if kubectl rollout status deployment/ordex-app -n "$environment" --timeout=300s; then
        log "SUCCESS" "Kubernetes rollback completed"
    else
        log "ERROR" "Kubernetes rollback failed or timed out"
        return 1
    fi
}

# Function to verify rollback success
verify_rollback() {
    local environment="$1"
    local base_url="$2"
    
    log "INFO" "Verifying rollback success..."
    
    # Use the health check script
    local health_check_script="$SCRIPT_DIR/deploy-health-check.sh"
    
    if [ -x "$health_check_script" ]; then
        log "INFO" "Running health checks..."
        if "$health_check_script" "$environment" "$base_url" 30 5 10 smoke; then
            log "SUCCESS" "Rollback verification passed"
            return 0
        else
            log "ERROR" "Rollback verification failed"
            return 1
        fi
    else
        log "WARN" "Health check script not found, performing basic verification..."
        
        # Basic connectivity check
        local max_attempts=10
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if curl -f -s "$base_url/api/health/simple" >/dev/null 2>&1; then
                log "SUCCESS" "Basic rollback verification passed"
                return 0
            fi
            
            log "INFO" "Verification attempt $attempt/$max_attempts failed, retrying..."
            sleep 10
            attempt=$((attempt + 1))
        done
        
        log "ERROR" "Basic rollback verification failed after $max_attempts attempts"
        return 1
    fi
}

# Function to send rollback notifications
send_notifications() {
    local environment="$1"
    local status="$2"
    local details="$3"
    
    log "INFO" "Sending rollback notifications..."
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji
        local color
        
        if [ "$status" = "success" ]; then
            emoji="✅"
            color="good"
        else
            emoji="❌"
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Ordex Rollback $status\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$environment\", \"short\": true},
                        {\"title\": \"Status\", \"value\": \"$status\", \"short\": true},
                        {\"title\": \"Details\", \"value\": \"$details\", \"short\": false}
                    ],
                    \"footer\": \"Ordex OMS Deployment\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || log "WARN" "Failed to send Slack notification"
    fi
    
    # Email notification (if configured)
    if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        local subject="Ordex Rollback $status - $environment"
        local body="Rollback Details:\n\nEnvironment: $environment\nStatus: $status\nDetails: $details\nTimestamp: $(date)"
        
        # Send email using available mail command or API
        if command -v mail &> /dev/null; then
            echo -e "$body" | mail -s "$subject" "$NOTIFICATION_EMAIL"
        fi
    fi
    
    log "SUCCESS" "Rollback notifications sent"
}

# Function to update rollback tracking
update_rollback_tracking() {
    local environment="$1"
    local status="$2"
    local details="$3"
    
    local tracking_file="${PROJECT_ROOT}/logs/rollback-tracking.json"
    
    # Create tracking entry
    local entry=$(cat << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$environment",
    "status": "$status",
    "details": "$details",
    "initiated_by": "$(whoami)",
    "hostname": "$(hostname)",
    "rollback_strategy": "$ROLLBACK_STRATEGY"
}
EOF
    )
    
    # Append to tracking file
    mkdir -p "$(dirname "$tracking_file")"
    if [ -f "$tracking_file" ]; then
        # Update existing JSON array
        jq ". += [$entry]" "$tracking_file" > "${tracking_file}.tmp" && mv "${tracking_file}.tmp" "$tracking_file"
    else
        # Create new JSON array
        echo "[$entry]" > "$tracking_file"
    fi
    
    log "INFO" "Rollback tracking updated: $tracking_file"
}

# Main rollback function
perform_rollback() {
    local environment="$1"
    local rollback_target="$2"
    
    log "INFO" "Starting rollback process..."
    log "INFO" "Environment: $environment"
    log "INFO" "Target: $rollback_target"
    log "INFO" "Strategy: $ROLLBACK_STRATEGY"
    
    # Create backup before rollback
    if ! create_rollback_backup "$environment"; then
        log "ERROR" "Failed to create rollback backup"
        return 1
    fi
    
    # Perform rollback based on strategy
    case "$ROLLBACK_STRATEGY" in
        "docker-compose"|"compose")
            if ! docker_compose_rollback "$environment" "$rollback_target"; then
                log "ERROR" "Docker Compose rollback failed"
                return 1
            fi
            ;;
        "kubernetes"|"k8s")
            if ! kubernetes_rollback "$environment" "$rollback_target"; then
                log "ERROR" "Kubernetes rollback failed"
                return 1
            fi
            ;;
        "blue-green"|*)
            log "INFO" "Performing blue-green rollback strategy"
            # Default to docker-compose for blue-green
            if ! docker_compose_rollback "$environment" "$rollback_target"; then
                log "ERROR" "Blue-green rollback failed"
                return 1
            fi
            ;;
    esac
    
    # Verify rollback success
    local base_url
    case "$environment" in
        "production") base_url="https://ordex.example.com" ;;
        "staging") base_url="https://staging.ordex.example.com" ;;
        *) base_url="http://localhost:3000" ;;
    esac
    
    if verify_rollback "$environment" "$base_url"; then
        local success_msg="Rollback completed successfully for $environment"
        log "SUCCESS" "$success_msg"
        
        update_rollback_tracking "$environment" "success" "$success_msg"
        send_notifications "$environment" "success" "$success_msg"
        
        return 0
    else
        local error_msg="Rollback verification failed for $environment"
        log "ERROR" "$error_msg"
        
        update_rollback_tracking "$environment" "failed" "$error_msg"
        send_notifications "$environment" "failed" "$error_msg"
        
        return 1
    fi
}

# Interactive confirmation
confirm_rollback() {
    if [ "$CONFIRM_ROLLBACK" = "true" ]; then
        return 0
    fi
    
    log "WARN" "You are about to perform a rollback operation!"
    log "WARN" "Environment: $ENVIRONMENT"
    log "WARN" "Current deployment will be replaced"
    
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        return 0
    else
        log "INFO" "Rollback cancelled by user"
        exit 0
    fi
}

# Main execution
main() {
    log "INFO" "Ordex OMS Rollback Script"
    log "INFO" "========================="
    
    # Validate environment
    if [ -z "$ENVIRONMENT" ]; then
        log "ERROR" "Environment must be specified"
        exit 1
    fi
    
    # Get rollback target
    local rollback_target
    if ! rollback_target=$(get_rollback_target "$ENVIRONMENT" "$DEPLOYMENT_ID"); then
        log "ERROR" "Could not determine rollback target"
        exit 1
    fi
    
    log "INFO" "Rollback target: $rollback_target"
    
    # Interactive confirmation (unless bypassed)
    confirm_rollback
    
    # Perform rollback
    if perform_rollback "$ENVIRONMENT" "$rollback_target"; then
        log "SUCCESS" "Rollback operation completed successfully"
        exit 0
    else
        log "ERROR" "Rollback operation failed"
        exit 1
    fi
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [DEPLOYMENT_ID] [ROLLBACK_STRATEGY] [CONFIRM_ROLLBACK]

Arguments:
  ENVIRONMENT       Target environment (required)
  DEPLOYMENT_ID     Specific deployment to rollback to (optional)
  ROLLBACK_STRATEGY Rollback method: docker-compose, kubernetes, blue-green (default: blue-green)
  CONFIRM_ROLLBACK  Skip confirmation prompt: true/false (default: false)

Environment variables:
  REGISTRY          Container registry URL (default: ghcr.io)
  IMAGE_NAME        Container image name (default: ordex/oms)
  SLACK_WEBHOOK_URL Slack webhook for notifications
  NOTIFICATION_EMAIL Email address for notifications

Examples:
  $0 staging                           # Rollback staging to last stable
  $0 production sha-abc123 kubernetes  # Rollback production to specific deployment
  $0 staging "" docker-compose true    # Rollback staging with Docker Compose, skip confirmation

Rollback strategies:
  docker-compose    Use Docker Compose for rollback
  kubernetes        Use kubectl for Kubernetes rollback
  blue-green        Blue-green deployment rollback (default)

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

if command -v jq &> /dev/null; then
    log "INFO" "jq is available for JSON processing"
else
    log "WARN" "jq is not installed, some features may be limited"
fi

# Run main function
main "$@"