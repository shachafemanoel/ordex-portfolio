#!/bin/bash

# =============================================================================
# GITHUB SECRETS SETUP SCRIPT
# =============================================================================
# Automates the setup of GitHub repository secrets for CI/CD pipelines

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="${1:-}"
ENVIRONMENT="${2:-production}"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    
    case $level in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        *) echo "[$level] $message" ;;
    esac
}

# Function to check if GitHub CLI is installed and authenticated
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log "ERROR" "GitHub CLI (gh) is not installed. Please install it first."
        log "INFO" "Visit: https://cli.github.com/"
        exit 1
    fi
    
    if ! gh auth status &>/dev/null; then
        log "ERROR" "GitHub CLI is not authenticated. Please run 'gh auth login' first."
        exit 1
    fi
    
    log "SUCCESS" "GitHub CLI is installed and authenticated"
}

# Function to generate secure keys
generate_secure_key() {
    local key_type="$1"
    local length="${2:-32}"
    
    case "$key_type" in
        "jwt")
            openssl rand -base64 "$length"
            ;;
        "encryption")
            openssl rand -hex 16  # Always 32 characters for encryption key
            ;;
        "cron")
            openssl rand -base64 24
            ;;
        "webhook")
            openssl rand -hex 32
            ;;
        *)
            openssl rand -base64 "$length"
            ;;
    esac
}

# Function to prompt for secret value
prompt_for_secret() {
    local secret_name="$1"
    local description="$2"
    local is_required="${3:-true}"
    local default_value="${4:-}"
    
    echo
    log "INFO" "Setting up: $secret_name"
    log "INFO" "Description: $description"
    
    if [ -n "$default_value" ]; then
        log "INFO" "Default/Generated value available"
        read -p "Use default/generated value? (y/n): " -r use_default
        if [[ $use_default =~ ^[Yy]$ ]]; then
            echo "$default_value"
            return
        fi
    fi
    
    if [ "$is_required" = "true" ]; then
        while true; do
            read -s -p "Enter value for $secret_name: " secret_value
            echo
            if [ -n "$secret_value" ]; then
                break
            fi
            log "WARN" "This secret is required. Please provide a value."
        done
    else
        read -s -p "Enter value for $secret_name (optional): " secret_value
        echo
    fi
    
    echo "$secret_value"
}

# Function to set GitHub secret
set_github_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local environment="$3"
    
    if [ -z "$secret_value" ]; then
        log "WARN" "Skipping empty secret: $secret_name"
        return
    fi
    
    if [ "$environment" = "repository" ]; then
        log "INFO" "Setting repository secret: $secret_name"
        echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO"
    else
        log "INFO" "Setting environment secret: $secret_name (environment: $environment)"
        echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO" --env "$environment"
    fi
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "Set secret: $secret_name"
    else
        log "ERROR" "Failed to set secret: $secret_name"
    fi
}

# Function to setup application secrets
setup_application_secrets() {
    local env="$1"
    
    log "INFO" "Setting up application secrets for environment: $env"
    
    # JWT Secret
    local jwt_secret
    jwt_secret=$(generate_secure_key "jwt" 32)
    jwt_secret=$(prompt_for_secret "JWT_SECRET" "JWT signing secret (at least 32 characters)" true "$jwt_secret")
    set_github_secret "JWT_SECRET" "$jwt_secret" "$env"
    
    # Encryption Key
    local encryption_key
    encryption_key=$(generate_secure_key "encryption")
    encryption_key=$(prompt_for_secret "ENCRYPTION_KEY" "Data encryption key (exactly 32 characters)" true "$encryption_key")
    set_github_secret "ENCRYPTION_KEY" "$encryption_key" "$env"
    
    # Cron Key
    local cron_key
    cron_key=$(generate_secure_key "cron")
    cron_key=$(prompt_for_secret "CRON_KEY" "Cron job authentication key" true "$cron_key")
    set_github_secret "CRON_KEY" "$cron_key" "$env"
}

# Function to setup database secrets
setup_database_secrets() {
    local env="$1"
    
    log "INFO" "Setting up database secrets for environment: $env"
    
    # Database URL
    local db_url
    db_url=$(prompt_for_secret "DATABASE_URL" "PostgreSQL connection string" true)
    set_github_secret "DATABASE_URL" "$db_url" "$env"
    
    # Database credentials (for backup/maintenance)
    local postgres_user
    postgres_user=$(prompt_for_secret "POSTGRES_USER" "PostgreSQL username" false "postgres")
    set_github_secret "POSTGRES_USER" "$postgres_user" "$env"
    
    local postgres_password
    postgres_password=$(prompt_for_secret "POSTGRES_PASSWORD" "PostgreSQL password" true)
    set_github_secret "POSTGRES_PASSWORD" "$postgres_password" "$env"
    
    local postgres_db
    postgres_db=$(prompt_for_secret "POSTGRES_DB" "PostgreSQL database name" false "ordex")
    set_github_secret "POSTGRES_DB" "$postgres_db" "$env"
}

# Function to setup cache secrets
setup_cache_secrets() {
    local env="$1"
    
    log "INFO" "Setting up cache secrets for environment: $env"
    
    # Redis URL
    local redis_url
    redis_url=$(prompt_for_secret "REDIS_URL" "Redis connection string" true)
    set_github_secret "REDIS_URL" "$redis_url" "$env"
    
    # Redis password
    local redis_password
    redis_password=$(prompt_for_secret "REDIS_PASSWORD" "Redis password (optional)" false)
    set_github_secret "REDIS_PASSWORD" "$redis_password" "$env"
}

# Function to setup external service secrets
setup_external_service_secrets() {
    local env="$1"
    
    log "INFO" "Setting up external service secrets for environment: $env"
    
    # Google Services
    log "INFO" "Google Services Configuration"
    local google_client_email
    google_client_email=$(prompt_for_secret "GOOGLE_CLIENT_EMAIL" "Google service account email" false)
    set_github_secret "GOOGLE_CLIENT_EMAIL" "$google_client_email" "$env"
    
    local google_private_key
    google_private_key=$(prompt_for_secret "GOOGLE_PRIVATE_KEY" "Google service account private key (JSON format)" false)
    set_github_secret "GOOGLE_PRIVATE_KEY" "$google_private_key" "$env"
    
    local google_calendar_id
    google_calendar_id=$(prompt_for_secret "GOOGLE_CALENDAR_ID" "Google Calendar ID" false)
    set_github_secret "GOOGLE_CALENDAR_ID" "$google_calendar_id" "$env"
    
    local mapbox_token
    mapbox_token=$(prompt_for_secret "MAPBOX" "Mapbox access token" false)
    set_github_secret "MAPBOX" "$mapbox_token" "$env"
    
    # Twilio
    log "INFO" "Twilio Configuration"
    local twilio_account_sid
    twilio_account_sid=$(prompt_for_secret "TWILIO_ACCOUNT_SID" "Twilio Account SID" false)
    set_github_secret "TWILIO_ACCOUNT_SID" "$twilio_account_sid" "$env"
    
    local twilio_auth_token
    twilio_auth_token=$(prompt_for_secret "TWILIO_AUTH_TOKEN" "Twilio Auth Token" false)
    set_github_secret "TWILIO_AUTH_TOKEN" "$twilio_auth_token" "$env"
    
    local twilio_from_number
    twilio_from_number=$(prompt_for_secret "TWILIO_FROM_NUMBER" "Twilio From Phone Number" false)
    set_github_secret "TWILIO_FROM_NUMBER" "$twilio_from_number" "$env"
    
    # WooCommerce
    log "INFO" "WooCommerce Configuration"
    local woocommerce_base_url
    woocommerce_base_url=$(prompt_for_secret "WOOCOMMERCE_BASE_URL" "WooCommerce store URL" false)
    set_github_secret "WOOCOMMERCE_BASE_URL" "$woocommerce_base_url" "$env"
    
    local woocommerce_consumer_key
    woocommerce_consumer_key=$(prompt_for_secret "WOOCOMMERCE_CONSUMER_KEY" "WooCommerce consumer key" false)
    set_github_secret "WOOCOMMERCE_CONSUMER_KEY" "$woocommerce_consumer_key" "$env"
    
    local woocommerce_consumer_secret
    woocommerce_consumer_secret=$(prompt_for_secret "WOOCOMMERCE_CONSUMER_SECRET" "WooCommerce consumer secret" false)
    set_github_secret "WOOCOMMERCE_CONSUMER_SECRET" "$woocommerce_consumer_secret" "$env"
}

# Function to setup CI/CD secrets
setup_cicd_secrets() {
    log "INFO" "Setting up CI/CD secrets"
    
    # Container registry
    local registry_token
    registry_token=$(prompt_for_secret "REGISTRY_TOKEN" "Container registry token (GitHub token with packages:write)" false)
    set_github_secret "REGISTRY_TOKEN" "$registry_token" "repository"
    
    # Deployment keys
    local deploy_private_key
    deploy_private_key=$(prompt_for_secret "DEPLOY_PRIVATE_KEY" "SSH private key for deployment servers" false)
    set_github_secret "DEPLOY_PRIVATE_KEY" "$deploy_private_key" "repository"
    
    # Security scanning
    local snyk_token
    snyk_token=$(prompt_for_secret "SNYK_TOKEN" "Snyk API token for security scanning" false)
    set_github_secret "SNYK_TOKEN" "$snyk_token" "repository"
    
    local codecov_token
    codecov_token=$(prompt_for_secret "CODECOV_TOKEN" "Codecov token for test coverage" false)
    set_github_secret "CODECOV_TOKEN" "$codecov_token" "repository"
}

# Function to setup notification secrets
setup_notification_secrets() {
    local env="$1"
    
    log "INFO" "Setting up notification secrets for environment: $env"
    
    # Slack
    local slack_webhook_url
    slack_webhook_url=$(prompt_for_secret "SLACK_WEBHOOK_URL" "Slack webhook URL for notifications" false)
    set_github_secret "SLACK_WEBHOOK_URL" "$slack_webhook_url" "$env"
    
    local slack_critical_webhook_url
    slack_critical_webhook_url=$(prompt_for_secret "SLACK_CRITICAL_WEBHOOK_URL" "Slack webhook URL for critical alerts" false)
    set_github_secret "SLACK_CRITICAL_WEBHOOK_URL" "$slack_critical_webhook_url" "$env"
    
    # Email notifications
    local notification_email
    notification_email=$(prompt_for_secret "NOTIFICATION_EMAIL" "Email address for notifications" false)
    set_github_secret "NOTIFICATION_EMAIL" "$notification_email" "$env"
    
    # PagerDuty
    local pagerduty_integration_key
    pagerduty_integration_key=$(prompt_for_secret "PAGERDUTY_INTEGRATION_KEY" "PagerDuty integration key" false)
    set_github_secret "PAGERDUTY_INTEGRATION_KEY" "$pagerduty_integration_key" "$env"
}

# Function to setup monitoring secrets
setup_monitoring_secrets() {
    local env="$1"
    
    log "INFO" "Setting up monitoring secrets for environment: $env"
    
    # Grafana
    local grafana_admin_password
    grafana_admin_password=$(generate_secure_key "default" 16)
    grafana_admin_password=$(prompt_for_secret "GRAFANA_ADMIN_PASSWORD" "Grafana admin password" true "$grafana_admin_password")
    set_github_secret "GRAFANA_ADMIN_PASSWORD" "$grafana_admin_password" "$env"
    
    # SMTP for alerts
    local smtp_host
    smtp_host=$(prompt_for_secret "SMTP_HOST" "SMTP server hostname" false)
    set_github_secret "SMTP_HOST" "$smtp_host" "$env"
    
    local smtp_username
    smtp_username=$(prompt_for_secret "SMTP_USERNAME" "SMTP username" false)
    set_github_secret "SMTP_USERNAME" "$smtp_username" "$env"
    
    local smtp_password
    smtp_password=$(prompt_for_secret "SMTP_PASSWORD" "SMTP password" false)
    set_github_secret "SMTP_PASSWORD" "$smtp_password" "$env"
}

# Function to setup production-specific secrets
setup_production_specific_secrets() {
    log "INFO" "Setting up production-specific secrets"
    
    # SSL certificates
    local ssl_cert
    ssl_cert=$(prompt_for_secret "SSL_CERT" "SSL certificate content" false)
    set_github_secret "SSL_CERT" "$ssl_cert" "production"
    
    local ssl_private_key
    ssl_private_key=$(prompt_for_secret "SSL_PRIVATE_KEY" "SSL private key content" false)
    set_github_secret "SSL_PRIVATE_KEY" "$ssl_private_key" "production"
    
    # Production approvers
    local production_approvers
    production_approvers=$(prompt_for_secret "PRODUCTION_APPROVERS" "GitHub usernames for production deployment approval (comma-separated)" false)
    set_github_secret "PRODUCTION_APPROVERS" "$production_approvers" "repository"
    
    # Backup configuration
    local backup_s3_bucket
    backup_s3_bucket=$(prompt_for_secret "BACKUP_S3_BUCKET" "S3 bucket for backups" false)
    set_github_secret "BACKUP_S3_BUCKET" "$backup_s3_bucket" "production"
    
    local aws_access_key_id
    aws_access_key_id=$(prompt_for_secret "AWS_ACCESS_KEY_ID" "AWS access key for backups" false)
    set_github_secret "AWS_ACCESS_KEY_ID" "$aws_access_key_id" "production"
    
    local aws_secret_access_key
    aws_secret_access_key=$(prompt_for_secret "AWS_SECRET_ACCESS_KEY" "AWS secret key for backups" false)
    set_github_secret "AWS_SECRET_ACCESS_KEY" "$aws_secret_access_key" "production"
}

# Function to verify secrets setup
verify_secrets_setup() {
    local env="$1"
    
    log "INFO" "Verifying secrets setup for environment: $env"
    
    # List environment secrets
    if [ "$env" = "repository" ]; then
        gh secret list --repo "$REPO" > /tmp/secrets_list.txt
    else
        gh secret list --repo "$REPO" --env "$env" > /tmp/secrets_list.txt 2>/dev/null || {
            log "WARN" "Could not list environment secrets. Environment may not exist yet."
            return
        }
    fi
    
    local secret_count
    secret_count=$(wc -l < /tmp/secrets_list.txt)
    
    log "SUCCESS" "Found $secret_count secrets configured for $env"
    
    if [ "$secret_count" -gt 0 ]; then
        log "INFO" "Configured secrets:"
        while read -r line; do
            secret_name=$(echo "$line" | awk '{print $1}')
            updated_at=$(echo "$line" | awk '{print $2}')
            log "INFO" "  - $secret_name (updated: $updated_at)"
        done < /tmp/secrets_list.txt
    fi
    
    rm -f /tmp/secrets_list.txt
}

# Function to create GitHub environment
create_github_environment() {
    local env="$1"
    
    if [ "$env" = "repository" ]; then
        return
    fi
    
    log "INFO" "Creating GitHub environment: $env"
    
    # Try to create environment (this might fail if it already exists)
    gh api --method PUT "/repos/$REPO/environments/$env" \
        --field wait_timer=0 \
        --field prevent_self_review=true \
        --field reviewers='[]' >/dev/null 2>&1 || {
        log "INFO" "Environment $env may already exist"
    }
    
    log "SUCCESS" "Environment $env is ready"
}

# Main setup function
main() {
    log "INFO" "Ordex OMS - GitHub Secrets Setup"
    log "INFO" "================================="
    
    # Check prerequisites
    check_gh_cli
    
    if [ -z "$REPO" ]; then
        log "ERROR" "Repository name is required"
        log "INFO" "Usage: $0 <repository> [environment]"
        log "INFO" "Example: $0 myorg/ordex-oms production"
        exit 1
    fi
    
    log "INFO" "Repository: $REPO"
    log "INFO" "Environment: $ENVIRONMENT"
    
    # Confirm setup
    echo
    read -p "This will setup GitHub secrets for $REPO ($ENVIRONMENT). Continue? (y/n): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "Setup cancelled"
        exit 0
    fi
    
    # Create GitHub environment if needed
    create_github_environment "$ENVIRONMENT"
    
    # Setup secrets by category
    echo
    log "INFO" "Starting secrets setup..."
    
    setup_application_secrets "$ENVIRONMENT"
    setup_database_secrets "$ENVIRONMENT"
    setup_cache_secrets "$ENVIRONMENT"
    setup_external_service_secrets "$ENVIRONMENT"
    setup_notification_secrets "$ENVIRONMENT"
    setup_monitoring_secrets "$ENVIRONMENT"
    
    # Setup CI/CD secrets (repository level)
    setup_cicd_secrets
    
    # Production-specific secrets
    if [ "$ENVIRONMENT" = "production" ]; then
        setup_production_specific_secrets
    fi
    
    # Verify setup
    echo
    verify_secrets_setup "$ENVIRONMENT"
    verify_secrets_setup "repository"
    
    echo
    log "SUCCESS" "GitHub secrets setup completed!"
    log "INFO" "Next steps:"
    log "INFO" "1. Verify secrets in GitHub repository settings"
    log "INFO" "2. Test CI/CD pipeline with a test commit"
    log "INFO" "3. Run deployment to verify all secrets work correctly"
    log "INFO" "4. Update team documentation with new secret names"
}

# Help function
show_help() {
    cat << EOF
Usage: $0 <repository> [environment]

Set up GitHub repository secrets for Ordex OMS CI/CD pipelines.

Arguments:
  repository    GitHub repository in format owner/repo (required)
  environment   Target environment name (default: production)

Examples:
  $0 myorg/ordex-oms production      # Setup production secrets
  $0 myorg/ordex-oms staging         # Setup staging secrets
  
Prerequisites:
  - GitHub CLI (gh) installed and authenticated
  - Admin access to the target repository
  - Access to all required secret values

Secret Categories:
  - Application secrets (JWT, encryption keys)
  - Database connection secrets
  - Cache connection secrets  
  - External service credentials
  - Notification configurations
  - Monitoring credentials
  - CI/CD pipeline secrets

EOF
}

# Check for help flag
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"