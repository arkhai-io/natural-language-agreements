#!/bin/bash

# Stop all running oracle and Anvil processes

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Natural Language Agreement services...${NC}\n"

# Stop Anvil
if [ -f .anvil.pid ]; then
    ANVIL_PID=$(cat .anvil.pid)
    if kill -0 $ANVIL_PID 2>/dev/null; then
        kill $ANVIL_PID
        echo -e "${GREEN}✅ Stopped Anvil (PID: $ANVIL_PID)${NC}"
    fi
    rm .anvil.pid
else
    # Try to kill any running anvil
    pkill -f anvil && echo -e "${GREEN}✅ Stopped Anvil${NC}" || echo -e "${YELLOW}⚠️  No Anvil process found${NC}"
fi

# Stop oracle
pkill -f "bun run oracle" && echo -e "${GREEN}✅ Stopped oracle${NC}" || echo -e "${YELLOW}⚠️  No oracle process found${NC}"

echo -e "\n${GREEN}✨ Cleanup complete${NC}"
