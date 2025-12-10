#!/bin/bash

# Start the Natural Language Agreement Oracle
# Usage: ./start-oracle.sh [network]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load .env file if it exists
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default network
NETWORK=${1:-localhost}
DEPLOYMENT_FILE="./deployments/${NETWORK}.json"

echo -e "${BLUE}🚀 Starting Natural Language Agreement Oracle${NC}\n"

# Check if deployment file exists
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}❌ Error: Deployment file not found: $DEPLOYMENT_FILE${NC}"
    echo "Please deploy contracts first:"
    echo "  ./scripts/deploy.sh $NETWORK"
    exit 1
fi

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ Error: OPENAI_API_KEY environment variable is not set${NC}"
    echo "Please set it:"
    echo "  export OPENAI_API_KEY=sk-your-key-here"
    exit 1
fi

# Check if Oracle private key is set
if [ -z "$ORACLE_PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  ORACLE_PRIVATE_KEY not set, using default Anvil key${NC}"
    export ORACLE_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
fi

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Network: $NETWORK"
echo "  Deployment: $DEPLOYMENT_FILE"
echo "  Oracle Key: ${ORACLE_PRIVATE_KEY:0:6}...${ORACLE_PRIVATE_KEY: -4}"
echo ""

# Start oracle
echo -e "${BLUE}👂 Starting oracle (Press Ctrl+C to stop)...${NC}\n"
bun run setups/oracle.ts \
    --deployment "$DEPLOYMENT_FILE" \
    --openai-api-key "$OPENAI_API_KEY" \
    --private-key "$ORACLE_PRIVATE_KEY"
