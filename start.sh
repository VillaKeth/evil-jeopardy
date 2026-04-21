#!/bin/bash
echo "============================================"
echo "  Evil Jeopardy² — Starting Server"
echo "============================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
echo "Starting server..."
node server/index.js
