import { query, transaction } from '@/lib/db';
import { KnowledgeItem, ApiResponse } from '@/lib/types';

// Get knowledge items for a user with filtering and pagination
export async function getKnowledgeItems(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    categories?: string[];
    emotions?: string[];
    topics?: string[];
    sourceId?: string;
  } = {}
): Promise<ApiResponse<{ items: KnowledgeItem[]; total: number }>> {
  try {
    const {
      limit = 20,
      offset = 0,
      search,
      categories,
      emotions,
      topics,
      sourceId,
    } = options;

    const whereConditions = ['user_id = $1'];
    const queryParams: (string | number | string[] | null)[] = [userId];
    let paramIndex = 2;

    // Add search condition
    if (search) {
      whereConditions.push(`(
        to_tsvector('english', title) @@ plainto_tsquery('english', $${paramIndex}) OR
        to_tsvector('english', content) @@ plainto_tsquery('english', $${paramIndex})
      )`);
      queryParams.push(search);
      paramIndex++;
    }

    // Add category filter
    if (categories && categories.length > 0) {
      whereConditions.push(`categories && $${paramIndex}::text[]`);
      queryParams.push(categories);
      paramIndex++;
    }

    // Add emotion filter
    if (emotions && emotions.length > 0) {
      whereConditions.push(`emotions && $${paramIndex}::text[]`);
      queryParams.push(emotions);
      paramIndex++;
    }

    // Add topic filter
    if (topics && topics.length > 0) {
      whereConditions.push(`topics && $${paramIndex}::text[]`);
      queryParams.push(topics);
      paramIndex++;
    }

    // Add source filter
    if (sourceId) {
      whereConditions.push(`source_id = $${paramIndex}`);
      queryParams.push(sourceId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM knowledge_items WHERE ${whereClause}`,
      queryParams
    );

    // Get items with pagination
    const itemsResult = await query(
      `SELECT * FROM knowledge_items 
       WHERE ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    return {
      success: true,
      data: {
        items: itemsResult.rows,
        total: parseInt(countResult.rows[0].total),
      },
    };
  } catch (error) {
    console.error('Error fetching knowledge items:', error);
    return {
      success: false,
      error: 'Failed to fetch knowledge items',
    };
  }
}

// Get a single knowledge item by ID
export async function getKnowledgeItem(
  userId: string,
  itemId: string
): Promise<ApiResponse<KnowledgeItem>> {
  try {
    const result = await query(
      'SELECT * FROM knowledge_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Knowledge item not found',
      };
    }

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    console.error('Error fetching knowledge item:', error);
    return {
      success: false,
      error: 'Failed to fetch knowledge item',
    };
  }
}

// Create a new knowledge item
export async function createKnowledgeItem(
  userId: string,
  data: Partial<KnowledgeItem>
): Promise<ApiResponse<KnowledgeItem>> {
  try {
    const result = await query(
      `INSERT INTO knowledge_items (
        user_id, source_id, source_item_id, title, content,
        tags, categories, emotions, sentiment_score, topics,
        entities, relationships, summary, key_insights,
        action_items, questions, extracted_date, time_period,
        context, processing_status, ai_confidence_score, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22
      ) RETURNING *`,
      [
        userId,
        data.source_id,
        data.source_item_id || null,
        data.title || null,
        data.content,
        JSON.stringify(data.tags || {}),
        data.categories || [],
        data.emotions || [],
        data.sentiment_score || null,
        data.topics || [],
        JSON.stringify(data.entities || {}),
        JSON.stringify(data.relationships || {}),
        data.summary || null,
        data.key_insights || [],
        data.action_items || [],
        data.questions || [],
        data.extracted_date || null,
        data.time_period || null,
        JSON.stringify(data.context || {}),
        data.processing_status || 'pending',
        data.ai_confidence_score || null,
        JSON.stringify(data.metadata || {}),
      ]
    );

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    console.error('Error creating knowledge item:', error);
    return {
      success: false,
      error: 'Failed to create knowledge item',
    };
  }
}

// Update a knowledge item
export async function updateKnowledgeItem(
  userId: string,
  itemId: string,
  data: Partial<KnowledgeItem>
): Promise<ApiResponse<KnowledgeItem>> {
  try {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        if (['tags', 'entities', 'relationships', 'context', 'metadata'].includes(key)) {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return {
        success: false,
        error: 'No fields to update',
      };
    }

    updateFields.push('updated_at = NOW()');
    values.push(itemId, userId);

    const result = await query(
      `UPDATE knowledge_items 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Knowledge item not found',
      };
    }

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    console.error('Error updating knowledge item:', error);
    return {
      success: false,
      error: 'Failed to update knowledge item',
    };
  }
}

// Delete a knowledge item
export async function deleteKnowledgeItem(
  userId: string,
  itemId: string
): Promise<ApiResponse<void>> {
  try {
    const result = await query(
      'DELETE FROM knowledge_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Knowledge item not found',
      };
    }

    return {
      success: true,
      message: 'Knowledge item deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting knowledge item:', error);
    return {
      success: false,
      error: 'Failed to delete knowledge item',
    };
  }
}

// Search knowledge items using vector similarity
export async function searchKnowledgeItemsVector(
  userId: string,
  queryEmbedding: number[],
  options: {
    limit?: number;
    similarityThreshold?: number;
    categories?: string[];
    emotions?: string[];
    topics?: string[];
  } = {}
): Promise<ApiResponse<{ items: (KnowledgeItem & { similarity: number })[]; }>> {
  try {
    const {
      limit = 10,
      similarityThreshold = 0.7,
      categories,
      emotions,
      topics,
    } = options;

    const whereConditions = ['user_id = $1'];
    const queryParams: (string | number | string[])[] = [userId];
    let paramIndex = 2;

    // Add category filter
    if (categories && categories.length > 0) {
      whereConditions.push(`categories && $${paramIndex}::text[]`);
      queryParams.push(categories);
      paramIndex++;
    }

    // Add emotion filter
    if (emotions && emotions.length > 0) {
      whereConditions.push(`emotions && $${paramIndex}::text[]`);
      queryParams.push(emotions);
      paramIndex++;
    }

    // Add topic filter
    if (topics && topics.length > 0) {
      whereConditions.push(`topics && $${paramIndex}::text[]`);
      queryParams.push(topics);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `SELECT *, (embedding <=> $${paramIndex}::vector) as distance
       FROM knowledge_items 
       WHERE ${whereClause}
         AND embedding IS NOT NULL
         AND (1 - (embedding <=> $${paramIndex}::vector)) >= $${paramIndex + 1}
       ORDER BY embedding <=> $${paramIndex}::vector
       LIMIT $${paramIndex + 2}`,
      [...queryParams, `[${queryEmbedding.join(',')}]`, similarityThreshold, limit]
    );

    const items = result.rows.map(row => ({
      ...row,
      similarity: 1 - row.distance,
    }));

    return {
      success: true,
      data: { items },
    };
  } catch (error) {
    console.error('Error searching knowledge items:', error);
    return {
      success: false,
      error: 'Failed to search knowledge items',
    };
  }
}