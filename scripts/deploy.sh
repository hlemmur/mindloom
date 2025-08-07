#!/bin/bash

# MindLoom Deployment Script
# This script helps deploy MindLoom to various platforms

set -e

echo "🚀 MindLoom Deployment Script"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "   Please copy .env.local.example to .env.local and configure it"
    echo "   Required variables: DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET"
fi

# Build the application
echo "🔨 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

# Check deployment target
if [ "$1" = "vercel" ]; then
    echo "🚀 Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    
elif [ "$1" = "test" ]; then
    echo "🧪 Starting test deployment locally..."
    echo "   Visit http://localhost:3000 to test"
    npm run start
    
else
    echo "📋 Deployment Options:"
    echo "   ./scripts/deploy.sh vercel  - Deploy to Vercel"
    echo "   ./scripts/deploy.sh test    - Test locally"
    echo ""
    echo "💡 Manual deployment steps:"
    echo "   1. Set up environment variables on your platform"
    echo "   2. Configure PostgreSQL database with pgvector"
    echo "   3. Run database/schema.sql on your database"
    echo "   4. Deploy the application"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed instructions"
fi

echo ""
echo "🎉 Deployment script completed!"