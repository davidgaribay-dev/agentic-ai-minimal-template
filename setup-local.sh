#!/bin/bash

# Full-Stack AI Agent Template - Local Development Setup
# Starts only infrastructure services (databases, caches)
# Run backend and frontend manually for hot reload development experience
#
# Usage:
#   ./setup-local.sh
#
# Then in separate terminals:
#   cd backend && uv run uvicorn backend.main:app --reload
#   cd frontend && npm run dev

set -e

# =============================================================================
# Colors and Formatting
# =============================================================================
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}        Local Development Setup (Infrastructure Only)                ${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BOLD}${CYAN}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
    echo -e "${DIM}────────────────────────────────────────────────────────────────────${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${DIM}  $1${NC}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

copy_env_file() {
    local source=$1
    local destination=$2

    if [ ! -f "$source" ]; then
        print_error "Source file $source does not exist"
        return 1
    fi

    if [ -f "$destination" ]; then
        print_warning "$destination already exists (skipping)"
        return 0
    fi

    cp "$source" "$destination"
    if [ $? -eq 0 ]; then
        print_success "Created $destination"
    else
        print_error "Failed to create $destination"
        return 1
    fi
}

generate_secret() {
    local length=${1:-32}
    if command_exists openssl; then
        openssl rand -hex "$length" 2>/dev/null
    elif [ -f /dev/urandom ]; then
        cat /dev/urandom | LC_ALL=C tr -dc 'a-f0-9' | head -c $((length * 2))
    else
        date +%s%N | sha256sum | head -c $((length * 2))
    fi
}

# =============================================================================
# Configuration
# =============================================================================

TOTAL_STEPS=5
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

SUCCESS=true
WARNINGS=0

# =============================================================================
# Main Setup
# =============================================================================

print_header

echo -e "${DIM}This script starts only infrastructure services.${NC}"
echo -e "${DIM}You'll run backend and frontend manually for hot reload.${NC}"

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================
print_step 1 "Checking prerequisites"

# Check Docker
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    print_success "Docker found (v$DOCKER_VERSION)"
else
    print_error "Docker not found. Please install Docker: https://docs.docker.com/get-docker/"
    SUCCESS=false
fi

# Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
    print_success "Docker Compose found (v$COMPOSE_VERSION)"
else
    print_error "Docker Compose not found"
    SUCCESS=false
fi

# Check uv (optional but recommended)
if command_exists uv; then
    UV_VERSION=$(uv --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    print_success "uv found (v$UV_VERSION)"
else
    print_warning "uv not found - install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Node.js (optional but recommended)
if command_exists node; then
    NODE_VERSION=$(node --version 2>/dev/null | tr -d 'v')
    print_success "Node.js found (v$NODE_VERSION)"
else
    print_warning "Node.js not found - needed for frontend"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$SUCCESS" = false ]; then
    echo ""
    print_error "Missing required prerequisites (Docker). Please install and try again."
    exit 1
fi

# =============================================================================
# Step 2: Setup Environment Files
# =============================================================================
print_step 2 "Setting up environment files"

# Backend .env
if [ -f "$BACKEND_DIR/.env.example" ]; then
    copy_env_file "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

# Frontend .env
if [ -f "$FRONTEND_DIR/.env.example" ]; then
    copy_env_file "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
fi

# =============================================================================
# Step 3: Generate Secrets
# =============================================================================
print_step 3 "Generating SECRET_KEY"

# Note: Secrets are now stored encrypted in the database using SECRET_KEY
print_info "Secrets will be stored encrypted in the database"

# Generate SECRET_KEY for backend if not set
if [ -f "$BACKEND_DIR/.env" ]; then
    if grep -q "SECRET_KEY=your-secret-key-change-in-production" "$BACKEND_DIR/.env" 2>/dev/null; then
        SECRET_KEY=$(generate_secret 32)
        if [ "$(uname)" = "Darwin" ]; then
            sed -i '' "s/SECRET_KEY=your-secret-key-change-in-production/SECRET_KEY=$SECRET_KEY/" "$BACKEND_DIR/.env"
        else
            sed -i "s/SECRET_KEY=your-secret-key-change-in-production/SECRET_KEY=$SECRET_KEY/" "$BACKEND_DIR/.env"
        fi
        print_success "Generated SECRET_KEY for backend"
    else
        print_info "SECRET_KEY already configured"
    fi
fi

# =============================================================================
# Step 4: Start Infrastructure Services
# =============================================================================
print_step 4 "Starting infrastructure services"

echo -e "${DIM}  Starting PostgreSQL and SeaweedFS...${NC}"
echo -e "${DIM}  (Backend and frontend are NOT started - run them manually)${NC}"
echo ""

if docker compose -f docker-compose-local.yml up -d 2>/dev/null; then
    print_success "Infrastructure services started"
    echo ""

    # List running services
    echo -e "${DIM}  Running containers:${NC}"
    docker compose -f docker-compose-local.yml ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | while read line; do
        echo -e "${DIM}    $line${NC}"
    done
else
    print_error "Failed to start Docker services"
    print_info "Try running manually: docker compose -f docker-compose-local.yml up -d"
    SUCCESS=false
fi

# =============================================================================
# Step 5: Wait for Database and Run Migrations
# =============================================================================
print_step 5 "Initializing database"

echo -e "${DIM}  Waiting for PostgreSQL to be ready...${NC}"

# Wait for PostgreSQL to be healthy (up to 30 seconds)
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose -f docker-compose-local.yml exec -T db pg_isready -U postgres >/dev/null 2>&1; then
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    print_success "PostgreSQL is ready"
else
    print_warning "PostgreSQL may still be starting - wait a moment before running migrations"
    WARNINGS=$((WARNINGS + 1))
fi

# Run migrations if uv is available
if command_exists uv; then
    cd "$BACKEND_DIR"

    # Ensure dependencies are installed first
    echo -e "${DIM}  Installing backend dependencies...${NC}"
    if uv sync 2>&1 | tail -3; then
        print_success "Backend dependencies installed"
    else
        print_warning "Dependency install may have had issues"
        WARNINGS=$((WARNINGS + 1))
    fi

    echo -e "${DIM}  Running database migrations...${NC}"
    if uv run alembic upgrade head 2>&1 | tail -5; then
        print_success "Database migrations complete"
    else
        print_warning "Migrations may have failed - run manually: cd backend && uv run alembic upgrade head"
        WARNINGS=$((WARNINGS + 1))
    fi

    echo -e "${DIM}  Creating initial superuser...${NC}"
    # Don't suppress errors - show last 5 lines if it fails
    if uv run python -m backend.scripts.initial_data 2>&1 | grep -E "(Created|already exists|ERROR|Error)" | tail -5; then
        print_success "Initial superuser setup complete"
    else
        print_warning "Initial data setup had issues - run manually: cd backend && uv run python -m backend.scripts.initial_data"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Create audit logs directory
    echo -e "${DIM}  Creating audit logs directory...${NC}"
    mkdir -p "$BACKEND_DIR/logs"
    print_success "Audit logs directory created (backend/logs)"

    cd "$SCRIPT_DIR"
else
    print_warning "uv not available - run migrations manually after installing dependencies"
    WARNINGS=$((WARNINGS + 1))
fi


# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$SUCCESS" = true ]; then
    echo -e "${GREEN}${BOLD}Infrastructure is ready!${NC}"
else
    echo -e "${RED}${BOLD}Setup completed with errors.${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}  ($WARNINGS warnings - see above)${NC}"
fi

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${BOLD}Infrastructure Services:${NC}"
echo -e "  ${CYAN}PostgreSQL:${NC}             localhost:5432"
echo -e "  ${CYAN}SeaweedFS (S3):${NC}         localhost:8333"

echo ""
echo -e "${BOLD}Now start your dev servers:${NC}"
echo ""
echo -e "  ${BOLD}Terminal 1 - Backend:${NC}"
echo -e "  ${CYAN}cd backend && uv run uvicorn backend.main:app --reload${NC}"
echo ""
echo -e "  ${BOLD}Terminal 2 - Frontend:${NC}"
echo -e "  ${CYAN}cd frontend && npm run dev${NC}"
echo ""

echo -e "${BOLD}Quick Commands:${NC}"
echo -e "  ${DIM}Stop services:${NC}    docker compose -f docker-compose-local.yml down"
echo -e "  ${DIM}View logs:${NC}        docker compose -f docker-compose-local.yml logs -f"
echo -e "  ${DIM}Reset data:${NC}       docker compose -f docker-compose-local.yml down -v"
echo ""

echo -e "${BOLD}Don't forget to:${NC}"
echo -e "  1. Add an LLM API key to ${CYAN}backend/.env${NC} (ANTHROPIC_API_KEY, etc.)"
echo -e "  2. Install dependencies if needed:"
echo -e "     ${DIM}cd backend && uv sync${NC}"
echo -e "     ${DIM}cd frontend && npm install${NC}"
echo ""
