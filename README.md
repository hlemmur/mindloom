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

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) with your browser

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
- [ ] Environment setup and configuration
- [ ] Production deployment
- [ ] User acceptance testing

## License

MIT
