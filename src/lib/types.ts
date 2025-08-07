// Database types matching the schema

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DataSource {
  id: string;
  user_id: string;
  source_type: 'chatgpt' | 'notes' | 'email' | 'health';
  source_name?: string;
  api_key_encrypted?: string;
  last_sync_at?: Date;
  sync_status: 'idle' | 'syncing' | 'error' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export interface KnowledgeItem {
  id: string;
  user_id: string;
  source_id: string;
  source_item_id?: string;
  title?: string;
  content: string;
  embedding?: number[]; // Vector embedding
  
  // AI-generated metadata
  tags?: Record<string, string[]>; // Structured tags
  categories?: string[];
  emotions?: string[];
  sentiment_score?: number;
  topics?: string[];
  entities?: Record<string, any>;
  relationships?: Record<string, any>;
  
  // Content analysis
  summary?: string;
  key_insights?: string[];
  action_items?: string[];
  questions?: string[];
  
  // Temporal and contextual
  extracted_date?: Date;
  time_period?: string;
  context?: Record<string, any>;
  
  // Processing metadata
  processing_status: 'pending' | 'processing' | 'completed' | 'error';
  ai_confidence_score?: number;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  results_count?: number;
  created_at: Date;
}

export interface TagRelationship {
  id: string;
  user_id: string;
  tag1: string;
  tag2: string;
  relationship_type?: 'frequently_co_occurs' | 'semantic_similarity' | 'user_defined';
  strength: number;
  created_at: Date;
}

export interface Insight {
  id: string;
  user_id: string;
  insight_type: 'pattern' | 'trend' | 'connection' | 'summary';
  title: string;
  description: string;
  confidence_score?: number;
  related_items?: string[];
  metadata?: Record<string, any>;
  is_dismissed: boolean;
  created_at: Date;
  updated_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ChatGPT specific types
export interface ChatGPTConversation {
  id: string;
  title: string;
  messages: ChatGPTMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatGPTMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// Search types
export interface SearchFilters {
  categories?: string[];
  emotions?: string[];
  topics?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sentimentRange?: {
    min: number;
    max: number;
  };
  sources?: string[];
}

export interface SearchResult {
  item: KnowledgeItem;
  score: number; // Similarity score
  highlights?: string[]; // Highlighted text matches
}