# MindLoom

AI-Powered Personal Knowledge Management Platform

## Overview

MindLoom is an AI-native personal knowledge management platform that intelligently consolidates, organizes, and synthesizes personal data from multiple sources (ChatGPT conversations, personal notes, health tracking data, emails, social media content) into a unified, searchable, and actionable knowledge base.

## Core Features

- **Intelligent Data Ingestion:** AI analyzes and processes every piece of data during import
- **Smart Organization:** Automatic tagging, categorization, emotion detection, and entity extraction
- **Intelligent Linking:** AI identifies relationships and connections between data points
- **Contextual Enrichment:** Extracts dates, emotions, topics, and metadata automatically
- **Powerful Query Engine:** Vector-based search with semantic understanding
- **Insight Generation:** AI synthesizes patterns and generates actionable insights

## Technology Stack

- **Frontend:** Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes with TypeScript
- **Database:** PostgreSQL with pgvector extension
- **AI Services:** OpenAI API (GPT-4, embeddings)
- **State Management:** Zustand
- **UI Components:** Shadcn/ui

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/mindloom.git
cd mindloom

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your database and API keys

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📋 Prerequisites

- **Node.js 18+**
- **PostgreSQL** with pgvector extension
- **OpenAI API Key** for AI processing
- **Optional**: Google/GitHub OAuth credentials

## 🛠 Environment Setup

### Database Setup
1. Create PostgreSQL database with pgvector extension
2. Run the schema: `psql -d your_db -f database/schema.sql`

### Required Environment Variables
```bash
DATABASE_URL="postgresql://user:pass@host:port/db"
OPENAI_API_KEY="your_openai_key"
NEXTAUTH_SECRET="your_secure_secret_32_chars"
ENCRYPTION_KEY="your_32_character_encryption_key"
```

See `.env.local.example` for complete configuration.

## Development Phases

### Phase 1: Foundation ✅
- [x] Project setup and basic architecture
- [x] Database schema implementation
- [x] User authentication system with NextAuth
- [x] Basic API structure with comprehensive CRUD operations

### Phase 2: Core Features ✅
- [x] ChatGPT conversation import functionality
- [x] Vector-based semantic search
- [x] Knowledge item storage and retrieval
- [x] Data source management

### Phase 3: AI-Native Processing ✅
- [x] AI-native content analysis during import
- [x] Intelligent metadata extraction (emotions, topics, entities)
- [x] Smart tagging and categorization system
- [x] Embedding generation for similarity search
- [x] Processing pipeline with status tracking

### Phase 4: User Interface ✅
- [x] Complete dashboard UI implementation
- [x] Authentication pages (signin, error handling)
- [x] Import workflow with file validation
- [x] Real-time processing status display

### Phase 5: Ready for Testing 🚀
- [x] MVP feature complete
- [x] Build system optimized for production
- [x] Deployment configuration and documentation
- [ ] Database setup and production testing
- [ ] User acceptance testing

## 🚢 Deployment

### Quick Deploy to Vercel
```bash
# Using deployment script
./scripts/deploy.sh vercel

# Or manually with Vercel CLI
npm i -g vercel
vercel --prod
```

### Other Platforms
- **Railway**: Connect GitHub repo, add environment variables
- **Netlify**: Deploy as Next.js app with serverless functions
- **Docker**: Use included Dockerfile for containerized deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🧪 Testing

Run the test checklist:
```bash
# Build and test locally
npm run build
npm run start

# Check the testing guide
cat TEST_CHECKLIST.md
```

## 📖 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Comprehensive deployment guide
- [TEST_CHECKLIST.md](./TEST_CHECKLIST.md) - Manual testing procedures
- Database schema in `database/schema.sql`
- API documentation in source code comments

## 🎯 Current Status

**✅ MVP Complete** - All core features implemented and ready for deployment!

**Key Features Working:**
- User authentication (email, Google, GitHub)
- ChatGPT conversation import with validation
- AI-powered content analysis and metadata extraction
- Vector-based semantic search
- Real-time processing status
- Responsive dashboard interface

**Ready for Production:**
- Optimized build configuration
- Environment variable documentation
- Deployment scripts and guides
- Error handling and logging

## License

MIT
