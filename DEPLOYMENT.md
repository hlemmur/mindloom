# MindLoom Deployment Guide

## 🚀 Quick Deploy to Vercel

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database with pgvector extension
- OpenAI API key

### 2. Environment Variables Setup

Create a `.env.local` file (or set in Vercel dashboard):

```bash
# Database Configuration (Required)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# OpenAI API (Required for AI processing)
OPENAI_API_KEY="your_openai_api_key_here"

# NextAuth Configuration (Required)
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your_secure_nextauth_secret_32_chars+"

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Encryption (Required for storing API keys)
ENCRYPTION_KEY="your_32_character_encryption_key_here"
```

### 3. Database Setup

#### Option A: Use Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
3. Run the schema file:
   ```bash
   psql -h your-host -p 5432 -U your-user -d your-db -f database/schema.sql
   ```

#### Option B: Use Neon, Railway, or other PostgreSQL provider
1. Create a PostgreSQL database
2. Ensure pgvector extension is available
3. Run the schema file from `database/schema.sql`

### 4. Deploy to Vercel

#### Method 1: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Method 2: Using Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

#### Method 3: Deploy Button
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fmindloom)

### 5. OAuth Setup (Optional)

#### Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain.vercel.app/api/auth/callback/google`

#### GitHub OAuth:
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App
3. Set callback URL: `https://your-domain.vercel.app/api/auth/callback/github`

### 6. Test Deployment

1. Visit your deployed URL
2. Sign in with email or OAuth
3. Try importing a ChatGPT conversation
4. Verify AI processing works

## 🛠 Development Setup

### Local Development
```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

### Build Locally
```bash
npm run build
npm run start
```

## 🔧 Configuration Notes

### Database Requirements
- PostgreSQL 12+
- pgvector extension installed
- UUID extension installed
- Sufficient storage for embeddings (1536 dimensions per item)

### OpenAI API Usage
- Uses `text-embedding-3-small` for embeddings
- Uses `gpt-4o-mini` for content analysis
- Estimated cost: ~$0.01-0.05 per 1000 knowledge items processed

### Performance Considerations
- Vector search performance improves with proper indexing
- Consider connection pooling for high-traffic deployments
- AI processing is queued to avoid rate limits

## 🔒 Security

- All API keys are encrypted before storage
- User data is isolated by user ID
- NextAuth handles session management
- Environment variables contain sensitive data

## 📊 Monitoring

The application includes:
- Processing status tracking
- Error logging in console
- Basic performance metrics in dashboard

## 🆘 Troubleshooting

### Common Issues:

1. **Build Errors**: ESLint and TypeScript errors are currently ignored for deployment
2. **Database Connection**: Ensure DATABASE_URL includes SSL mode for hosted databases
3. **OpenAI Rate Limits**: Processing is throttled to avoid hitting limits
4. **Large Imports**: ChatGPT exports can be large - ensure sufficient memory

### Getting Help:
- Check the console for detailed error messages
- Verify all environment variables are set correctly
- Test database connection separately if deployment fails