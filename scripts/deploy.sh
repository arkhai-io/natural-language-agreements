#!/bin/bash

# Deploy Alkahest contracts to blockchain
# Usage: ./deploy.sh [network] [rpc-url]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
NETWORK=${1:-localhost}
RPC_URL=${2:-http://localhost:8545}

echo -e "${BLUE}🚀 Deploying Alkahest Contracts${NC}\n"

# Check if deployer private key is set
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  DEPLOYER_PRIVATE_KEY not set, using default Anvil key${NC}"
    export DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
fi

# Check if alkahest exists
if [ ! -d "../alkahest" ]; then
    echo -e "${RED}❌ Error: alkahest repository not found in parent directory${NC}"
    echo "Please clone it first: git clone https://github.com/arkhai-io/alkahest.git"
    exit 1
fi

# Check if contract artifacts exist
if [ ! -d "../alkahest/sdks/ts/src/contracts" ]; then
    echo -e "${RED}❌ Error: Contract artifacts not found${NC}"
    echo "Expected path: ../alkahest/sdks/ts/src/contracts"
    exit 1
fi

echo -e "${GREEN}✅ Contract artifacts found${NC}\n"

# Run deployment
echo -e "${BLUE}📝 Deploying to ${NETWORK}...${NC}"
bun run setups/deploy.ts --network "$NETWORK" --rpc-url "$RPC_URL"

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✨ Deployment complete!${NC}"
    echo -e "${BLUE}Deployment file saved to: deployments/${NETWORK}.json${NC}\n"
    
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Start the oracle with:"
    echo "   ./scripts/start-oracle.sh $NETWORK"
    echo ""
    echo "2. Or using npm script:"
    echo "   bun run oracle"
    echo ""
    echo "3. Or manually:"
    echo "   bun run setups/oracle.ts --deployment ./deployments/${NETWORK}.json"
else
    echo -e "\n${RED}❌ Deployment failed${NC}"
    exit 1
fi
