import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchKnowledgeItemsVector } from '@/lib/api/knowledge-items';
import { query as dbQuery } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { query, limit, similarityThreshold, categories, emotions, topics } = await request.json();

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const result = await searchKnowledgeItemsVector(session.user.id, queryEmbedding, {
      limit,
      similarityThreshold,
      categories,
      emotions,
      topics,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Log search history asynchronously (do not block response)
    (async () => {
      try {
        await dbQuery(
          'INSERT INTO search_history (user_id, query, results_count) VALUES ($1, $2, $3)',
          [session.user.id, query, result.data?.items?.length || 0]
        );
      } catch (e) {
        console.error('Failed to log search history:', e);
      }
    })();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}