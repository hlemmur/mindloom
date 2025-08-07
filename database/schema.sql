-- MindLoom Database Schema
-- AI-Powered Personal Knowledge Management Platform

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Data sources table
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- 'chatgpt', 'notes', 'email', 'health'
  source_name VARCHAR(255),
  api_key_encrypted TEXT,
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'idle', -- 'idle', 'syncing', 'error', 'completed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge items table - Core table for all imported content
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  source_item_id VARCHAR(255), -- External ID from source
  title VARCHAR(500),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  
  -- Multi-dimensional AI-generated metadata
  tags JSONB, -- Structured tags: {"topic": ["AI", "business"], "emotion": ["excited"], "action": ["planning"], "context": ["work"]}
  categories TEXT[], -- AI-generated categories
  emotions TEXT[], -- Detected emotions (happy, stressed, curious, etc.)
  sentiment_score FLOAT, -- Sentiment analysis score (-1 to 1)
  topics TEXT[], -- Main topics discussed
  entities JSONB, -- People, places, organizations, concepts
  relationships JSONB, -- Links to other knowledge items
  
  -- Content analysis
  summary TEXT, -- AI-generated summary
  key_insights TEXT[], -- Key insights extracted
  action_items TEXT[], -- Action items identified
  questions TEXT[], -- Questions raised
  
  -- Temporal and contextual
  extracted_date TIMESTAMP, -- Date extracted from content
  time_period VARCHAR(50), -- Morning, afternoon, evening, etc.
  context JSONB, -- Additional context (weather, location, etc.)
  
  -- Processing metadata
  processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  ai_confidence_score FLOAT, -- Confidence in AI analysis (0-1)
  metadata JSONB, -- Additional source metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Search history table
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tag relationships table for flexible connections
CREATE TABLE tag_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tag1 VARCHAR(100) NOT NULL,
  tag2 VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(50), -- 'frequently_co_occurs', 'semantic_similarity', 'user_defined'
  strength FLOAT DEFAULT 1.0, -- Relationship strength (0-1)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tag1, tag2)
);

-- Insights table for AI-generated insights and patterns
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL, -- 'pattern', 'trend', 'connection', 'summary'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  confidence_score FLOAT, -- AI confidence in insight (0-1)
  related_items UUID[], -- Array of knowledge_item IDs
  metadata JSONB, -- Additional insight metadata
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for AI-enhanced search and performance

-- Users indexes
CREATE INDEX idx_users_email ON users(email);

-- Data sources indexes
CREATE INDEX idx_data_sources_user_id ON data_sources(user_id);
CREATE INDEX idx_data_sources_type ON data_sources(source_type);
CREATE INDEX idx_data_sources_status ON data_sources(sync_status);

-- Knowledge items indexes
CREATE INDEX idx_knowledge_items_user_id ON knowledge_items(user_id);
CREATE INDEX idx_knowledge_items_source_id ON knowledge_items(source_id);
CREATE INDEX idx_knowledge_items_source_item_id ON knowledge_items(source_item_id);

-- Vector similarity search index
CREATE INDEX idx_knowledge_items_embedding ON knowledge_items USING ivfflat (embedding vector_cosine_ops);

-- JSONB and array indexes for fast filtering
CREATE INDEX idx_knowledge_items_tags ON knowledge_items USING GIN(tags);
CREATE INDEX idx_knowledge_items_categories ON knowledge_items USING GIN(categories);
CREATE INDEX idx_knowledge_items_emotions ON knowledge_items USING GIN(emotions);
CREATE INDEX idx_knowledge_items_topics ON knowledge_items USING GIN(topics);
CREATE INDEX idx_knowledge_items_entities ON knowledge_items USING GIN(entities);

-- Temporal indexes
CREATE INDEX idx_knowledge_items_extracted_date ON knowledge_items(extracted_date);
CREATE INDEX idx_knowledge_items_created_at ON knowledge_items(created_at);

-- Analysis indexes
CREATE INDEX idx_knowledge_items_sentiment ON knowledge_items(sentiment_score);
CREATE INDEX idx_knowledge_items_processing_status ON knowledge_items(processing_status);
CREATE INDEX idx_knowledge_items_confidence ON knowledge_items(ai_confidence_score);

-- Search history indexes
CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_created_at ON search_history(created_at);

-- Tag relationship indexes
CREATE INDEX idx_tag_relationships_user_id ON tag_relationships(user_id);
CREATE INDEX idx_tag_relationships_tags ON tag_relationships(tag1, tag2);
CREATE INDEX idx_tag_relationships_strength ON tag_relationships(strength);

-- Insights indexes
CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_confidence ON insights(confidence_score);
CREATE INDEX idx_insights_dismissed ON insights(is_dismissed);

-- Full-text search indexes
CREATE INDEX idx_knowledge_items_title_fts ON knowledge_items USING GIN(to_tsvector('english', title));
CREATE INDEX idx_knowledge_items_content_fts ON knowledge_items USING GIN(to_tsvector('english', content));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON knowledge_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();