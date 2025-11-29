#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   Chasing Your Tail - Touch Launcher         ${NC}"
echo -e "${GREEN}==============================================${NC}"

# Function to kill processes on exit
cleanup() {
    echo -e "\n${RED}Shutting down services...${NC}"
    kill $BRIDGE_PID
    kill $UI_PID
    exit
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

# 1. Start the Python Bridge
echo -e "${BLUE}[1/2] Starting Bridge Server (Port 5000)...${NC}"
python3 cyt_bridge.py &
BRIDGE_PID=$!

# Wait for bridge to spin up
sleep 2

# 2. Start the Web Interface
echo -e "${BLUE}[2/2] Starting Web Interface (Port 3000)...${NC}"
echo -e "${GREEN}Access the app at: http://localhost:3000${NC}"

# Using --host to ensure it listens on the network (accessible from other devices)
npm run dev -- --host &
UI_PID=$!

# Wait for processes to finish
wait
