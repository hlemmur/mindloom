import OpenAI from 'openai';
import { KnowledgeItem } from '@/lib/types';
import { updateKnowledgeItem } from '@/lib/api/knowledge-items';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Analysis Result Interface
interface AIAnalysis {
  summary: string;
  categories: string[];
  emotions: string[];
  sentiment_score: number;
  topics: string[];
  entities: {
    people: string[];
    places: string[];
    organizations: string[];
    concepts: string[];
  };
  key_insights: string[];
  action_items: string[];
  questions: string[];
  tags: {
    topic: string[];
    emotion: string[];
    action: string[];
    context: string[];
  };
  confidence_score: number;
}

// Main function to process a knowledge item with AI
export async function processKnowledgeItemWithAI(
  userId: string,
  itemId: string,
  content: string,
  title?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update status to processing
    await updateKnowledgeItem(userId, itemId, {
      processing_status: 'processing',
    });

    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Perform AI analysis
    const analysis = await analyzeContent(content, title);

    // Extract temporal information
    const temporalInfo = extractTemporalInfo(content);

    // Update the knowledge item with AI results
    const updateResult = await updateKnowledgeItem(userId, itemId, {
      embedding,
      summary: analysis.summary,
      categories: analysis.categories,
      emotions: analysis.emotions,
      sentiment_score: analysis.sentiment_score,
      topics: analysis.topics,
      entities: analysis.entities,
      key_insights: analysis.key_insights,
      action_items: analysis.action_items,
      questions: analysis.questions,
      tags: analysis.tags,
      ai_confidence_score: analysis.confidence_score,
      extracted_date: temporalInfo.date,
      time_period: temporalInfo.period,
      processing_status: 'completed',
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update knowledge item');
    }

    return { success: true };

  } catch (error) {
    console.error('AI processing error:', error);

    // Update status to error
    await updateKnowledgeItem(userId, itemId, {
      processing_status: 'error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI processing failed',
    };
  }
}

// Generate embedding for vector search
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Truncate to avoid token limits
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding');
  }
}

// AI content analysis
export async function analyzeContent(content: string, title?: string): Promise<AIAnalysis> {
  try {
    const prompt = `Analyze the following content and provide a comprehensive analysis in JSON format.

Content Title: ${title || 'N/A'}
Content: ${content.slice(0, 6000)}

Please provide a JSON response with the following structure:
{
  "summary": "A concise 2-3 sentence summary of the main content",
  "categories": ["array of 2-4 high-level categories that best describe this content"],
  "emotions": ["array of emotions detected in the content"],
  "sentiment_score": 0.0, // float between -1 (very negative) and 1 (very positive)
  "topics": ["array of specific topics or subjects discussed"],
  "entities": {
    "people": ["names of people mentioned"],
    "places": ["locations, cities, countries mentioned"],
    "organizations": ["companies, institutions, groups mentioned"],
    "concepts": ["abstract concepts, ideas, theories mentioned"]
  },
  "key_insights": ["array of 2-5 key insights or important points"],
  "action_items": ["array of actionable tasks or next steps mentioned"],
  "questions": ["array of questions raised in the content"],
  "tags": {
    "topic": ["topical tags"],
    "emotion": ["emotional tags"],
    "action": ["action-oriented tags"],
    "context": ["contextual tags"]
  },
  "confidence_score": 0.0 // float between 0 and 1 indicating confidence in this analysis
}

Focus on being accurate and relevant. If certain fields don't apply, use empty arrays. Be conservative with confidence scores.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in analyzing and extracting structured information from text content. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error('No analysis returned from AI');
    }

    // Parse the JSON response
    const analysis: AIAnalysis = JSON.parse(analysisText);

    // Validate and sanitize the response
    return {
      summary: analysis.summary || '',
      categories: Array.isArray(analysis.categories) ? analysis.categories.slice(0, 5) : [],
      emotions: Array.isArray(analysis.emotions) ? analysis.emotions.slice(0, 8) : [],
      sentiment_score: typeof analysis.sentiment_score === 'number' ? 
        Math.max(-1, Math.min(1, analysis.sentiment_score)) : 0,
      topics: Array.isArray(analysis.topics) ? analysis.topics.slice(0, 10) : [],
      entities: {
        people: Array.isArray(analysis.entities?.people) ? analysis.entities.people.slice(0, 10) : [],
        places: Array.isArray(analysis.entities?.places) ? analysis.entities.places.slice(0, 10) : [],
        organizations: Array.isArray(analysis.entities?.organizations) ? analysis.entities.organizations.slice(0, 10) : [],
        concepts: Array.isArray(analysis.entities?.concepts) ? analysis.entities.concepts.slice(0, 10) : [],
      },
      key_insights: Array.isArray(analysis.key_insights) ? analysis.key_insights.slice(0, 8) : [],
      action_items: Array.isArray(analysis.action_items) ? analysis.action_items.slice(0, 8) : [],
      questions: Array.isArray(analysis.questions) ? analysis.questions.slice(0, 8) : [],
      tags: {
        topic: Array.isArray(analysis.tags?.topic) ? analysis.tags.topic.slice(0, 8) : [],
        emotion: Array.isArray(analysis.tags?.emotion) ? analysis.tags.emotion.slice(0, 5) : [],
        action: Array.isArray(analysis.tags?.action) ? analysis.tags.action.slice(0, 5) : [],
        context: Array.isArray(analysis.tags?.context) ? analysis.tags.context.slice(0, 5) : [],
      },
      confidence_score: typeof analysis.confidence_score === 'number' ? 
        Math.max(0, Math.min(1, analysis.confidence_score)) : 0.5,
    };

  } catch (error) {
    console.error('Content analysis error:', error);
    
    // Return a minimal analysis on error
    return {
      summary: '',
      categories: [],
      emotions: [],
      sentiment_score: 0,
      topics: [],
      entities: { people: [], places: [], organizations: [], concepts: [] },
      key_insights: [],
      action_items: [],
      questions: [],
      tags: { topic: [], emotion: [], action: [], context: [] },
      confidence_score: 0,
    };
  }
}

// Extract temporal information from content
function extractTemporalInfo(content: string): { date?: Date; period?: string } {
  const result: { date?: Date; period?: string } = {};

  // Look for explicit dates in various formats
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/g, // MM/DD/YYYY
    /(\d{4}-\d{2}-\d{2})/g, // YYYY-MM-DD
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    /(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const parsedDate = new Date(matches[0]);
      if (!isNaN(parsedDate.getTime())) {
        result.date = parsedDate;
        break;
      }
    }
  }

  // Detect time periods
  const timeKeywords = [
    { keywords: ['morning', 'am', 'early'], period: 'morning' },
    { keywords: ['afternoon', 'pm', 'lunch'], period: 'afternoon' },
    { keywords: ['evening', 'night', 'late'], period: 'evening' },
    { keywords: ['weekend', 'saturday', 'sunday'], period: 'weekend' },
    { keywords: ['weekday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'], period: 'weekday' },
  ];

  const lowerContent = content.toLowerCase();
  for (const { keywords, period } of timeKeywords) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      result.period = period;
      break;
    }
  }

  return result;
}

// Batch processing function for multiple items
export async function batchProcessKnowledgeItems(
  userId: string,
  itemIds: string[]
): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const itemId of itemIds) {
    try {
      // Get the item content
      const itemResponse = await fetch(`/api/knowledge-items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${userId}`, // This would need proper auth handling
        },
      });

      if (!itemResponse.ok) {
        throw new Error('Failed to fetch knowledge item');
      }

      const itemData = await itemResponse.json();
      const item: KnowledgeItem = itemData.data;

      // Process the item
      const processResult = await processKnowledgeItemWithAI(
        userId,
        itemId,
        item.content,
        item.title || undefined
      );

      if (processResult.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push(`Item ${itemId}: ${processResult.error}`);
        results.success = false;
      }

      // Add a small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.failed++;
      results.errors.push(`Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.success = false;
    }
  }

  return results;
}