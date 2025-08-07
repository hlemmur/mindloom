# 🧪 MindLoom Testing Checklist

## Pre-Deployment Testing

### ✅ Build & Dependencies
- [x] `npm install --legacy-peer-deps` - Dependencies install successfully
- [x] `npm run build` - Production build completes without errors
- [x] Development server starts on `npm run dev`

### 🔑 Environment Setup Required
Before testing functionality, you need:

1. **Database Setup**:
   ```bash
   # Create PostgreSQL database with pgvector
   # Run: database/schema.sql
   ```

2. **Environment Variables**:
   ```bash
   # Copy and configure:
   cp .env.local.example .env.local
   # Add real values for DATABASE_URL, OPENAI_API_KEY, etc.
   ```

### 🌐 UI/UX Testing
- [ ] **Landing Page** (`/`): Hero section, features grid, CTA buttons
- [ ] **Sign In Page** (`/auth/signin`): Email, Google, GitHub authentication
- [ ] **Dashboard** (`/dashboard`): Stats cards, recent items, search functionality
- [ ] **Import Page** (`/import`): Data source options, clear instructions
- [ ] **ChatGPT Import** (`/import/chatgpt`): File upload, validation, progress

### 🔐 Authentication Flow
- [ ] **Email Sign In**: Create account with email
- [ ] **OAuth Sign In**: Google/GitHub authentication (if configured)
- [ ] **Session Persistence**: Stays logged in across browser sessions
- [ ] **Protected Routes**: Redirects to signin when not authenticated
- [ ] **User Info**: Displays user name/email correctly

### 💾 Database Operations
- [ ] **User Creation**: New users added to database
- [ ] **Data Sources**: Can create and list data sources
- [ ] **Knowledge Items**: CRUD operations work correctly
- [ ] **Search**: Text search returns relevant results

### 🤖 AI Processing
- [ ] **File Import**: ChatGPT JSON files validate correctly
- [ ] **Content Processing**: AI analysis generates metadata
- [ ] **Embeddings**: Vector embeddings created successfully
- [ ] **Processing Status**: Status updates work in real-time
- [ ] **Semantic Search**: Vector similarity search works

### 📊 Core Features
- [ ] **ChatGPT Import**: Complete workflow from upload to processed items
- [ ] **Dashboard Search**: Find imported conversations
- [ ] **Processing Queue**: Batch processing of pending items
- [ ] **Data Management**: View and manage imported data

## Manual Test Scenarios

### Scenario 1: New User Onboarding
1. Visit landing page
2. Click "Get Started"
3. Sign up with email
4. Redirected to dashboard
5. Dashboard shows empty state with import prompts

### Scenario 2: ChatGPT Import
1. Go to Import > ChatGPT
2. Follow export instructions
3. Upload sample JSON file
4. Validate file format
5. Import successfully
6. See processing status
7. Search imported conversations

### Scenario 3: AI Processing
1. Import data with pending status
2. Use "Process Pending Items" button
3. Watch processing status update
4. Verify metadata extraction
5. Test semantic search functionality

## Sample Test Data

### Test ChatGPT JSON
```json
[
  {
    "id": "test-conversation-1",
    "title": "Test Conversation",
    "mapping": {
      "msg1": {
        "id": "msg1",
        "message": {
          "content": {"parts": ["Hello, can you help me with JavaScript?"]},
          "author": {"role": "user"},
          "create_time": 1640995200
        }
      },
      "msg2": {
        "id": "msg2", 
        "message": {
          "content": {"parts": ["Of course! I'd be happy to help you with JavaScript. What specific topic or problem would you like assistance with?"]},
          "author": {"role": "assistant"},
          "create_time": 1640995260
        }
      }
    },
    "create_time": 1640995200,
    "update_time": 1640995260
  }
]
```

## Deployment Testing

### Vercel Deployment
- [ ] Environment variables configured
- [ ] Database connection works in production
- [ ] Build completes successfully
- [ ] All routes accessible
- [ ] OAuth redirects work (if configured)

### Performance Testing
- [ ] Page load times acceptable
- [ ] File upload handles large files
- [ ] AI processing doesn't timeout
- [ ] Database queries perform well

## Known Issues (To Address)

### Build Warnings (Non-blocking)
- ESLint warnings disabled for deployment
- TypeScript strict mode disabled temporarily
- Some unused variables and parameters

### Missing Features (Future Releases)
- Advanced search filters
- Conversation threading
- Export functionality
- User settings management
- Bulk operations

## Success Criteria

The MVP is considered successful if:
- [x] Application builds and deploys
- [ ] User can sign up and authenticate
- [ ] ChatGPT import workflow completes end-to-end  
- [ ] AI processing generates meaningful metadata
- [ ] Search finds relevant conversations
- [ ] Dashboard provides clear overview

## Post-Launch Tasks

1. **Performance Monitoring**: Set up error tracking
2. **User Feedback**: Collect and prioritize feature requests  
3. **Code Quality**: Address TypeScript and ESLint issues
4. **Documentation**: Create user guides and API docs
5. **Testing**: Add comprehensive test suite