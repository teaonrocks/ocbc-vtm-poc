#!/bin/bash

echo "🚀 Live Agent POC Setup Script"
echo "================================"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is installed: $(node --version)"
echo ""

# Install main dependencies
echo "📦 Installing main application dependencies..."
npm install

echo ""
echo "📦 Installing WebSocket server dependencies..."
cd server
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the system:"
echo "  1. Start WebSocket server: cd server && npm start"
echo "  2. Start Live Agent dashboard: npm run dev"
echo "  3. Open atm-test-simulator.html to test ticket creation"
echo ""
echo "📚 Read INTEGRATION_GUIDE.md for detailed instructions"
