#!/bin/bash

# Complete setup and deployment for local development
# This script will:
# 1. Check prerequisites
# 2. Start Anvil
# 3. Deploy contracts
# 4. Start the oracle

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Natural Language Agreement Oracle - Quick Setup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}\n"

# Load .env file if it exists
if [ -f ".env" ]; then
    echo -e "${BLUE}📄 Loading .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
fi

# Check Bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed${NC}"
    echo "Please install it: https://bun.sh"
    exit 1
fi
echo -e "${GREEN}✅ Bun installed${NC}"

# Check Foundry
if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Foundry (forge) is not installed${NC}"
    echo "Please install it: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi
echo -e "${GREEN}✅ Foundry installed${NC}"

# Check Anvil
if ! command -v anvil &> /dev/null; then
    echo -e "${RED}❌ Anvil is not installed${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi
echo -e "${GREEN}✅ Anvil installed${NC}"

# Check alkahest
if [ ! -d "../alkahest" ]; then
    echo -e "${RED}❌ alkahest repository not found${NC}"
    echo "Please clone it in the parent directory:"
    echo "  cd .. && git clone https://github.com/arkhai-io/alkahest.git"
    exit 1
fi
echo -e "${GREEN}✅ alkahest repository found${NC}"

# Check OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ OPENAI_API_KEY not set${NC}"
    echo "Please create a .env file with: OPENAI_API_KEY=sk-your-key-here"
    echo "Or export it: export OPENAI_API_KEY=sk-your-key-here"
    exit 1
fi
echo -e "${GREEN}✅ OpenAI API key configured${NC}\n"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}\n"
bun install

# Check if Anvil is already running
if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Anvil is already running on port 8545${NC}"
    read -p "Do you want to kill it and start fresh? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -f anvil || true
        sleep 2
    else
        echo -e "${BLUE}Using existing Anvil instance${NC}\n"
    fi
fi

# Start Anvil in background if not running
if ! lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${BLUE}🔨 Starting Anvil...${NC}"
    anvil > anvil.log 2>&1 &
    ANVIL_PID=$!
    echo $ANVIL_PID > .anvil.pid
    echo -e "${GREEN}✅ Anvil started (PID: $ANVIL_PID)${NC}"
    echo "   Logs: tail -f anvil.log"
    sleep 3
fi

# Deploy contracts
echo -e "\n${BLUE}📝 Deploying contracts...${NC}\n"
export DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
./cli/scripts/deploy.sh localhost http://localhost:8545

# Start oracle
echo -e "\n${BLUE}🚀 Starting oracle...${NC}\n"
export ORACLE_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
./cli/scripts/start-oracle.sh localhost

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    if [ -f .anvil.pid ]; then
        ANVIL_PID=$(cat .anvil.pid)
        kill $ANVIL_PID 2>/dev/null || true
        rm .anvil.pid
        echo -e "${GREEN}✅ Anvil stopped${NC}"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM
