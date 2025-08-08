import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Recent queries
    const recentQueriesPromise = query(
      `SELECT query FROM search_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId]
    );

    // Top metadata suggestions from knowledge_items
    const topCategoriesPromise = query(
      `SELECT unnest(categories) as value, COUNT(*) as count
       FROM knowledge_items
       WHERE user_id = $1 AND categories IS NOT NULL
       GROUP BY value
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    const topEmotionsPromise = query(
      `SELECT unnest(emotions) as value, COUNT(*) as count
       FROM knowledge_items
       WHERE user_id = $1 AND emotions IS NOT NULL
       GROUP BY value
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    const topTopicsPromise = query(
      `SELECT unnest(topics) as value, COUNT(*) as count
       FROM knowledge_items
       WHERE user_id = $1 AND topics IS NOT NULL
       GROUP BY value
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    const [recentQueriesRes, categoriesRes, emotionsRes, topicsRes] = await Promise.all([
      recentQueriesPromise,
      topCategoriesPromise,
      topEmotionsPromise,
      topTopicsPromise,
    ]);

    type Row = { query?: string; value?: string };
    const suggestions = {
      recentQueries: (recentQueriesRes.rows as Row[]).map((r) => r.query || ''),
      categories: (categoriesRes.rows as Row[]).map((r) => r.value || ''),
      emotions: (emotionsRes.rows as Row[]).map((r) => r.value || ''),
      topics: (topicsRes.rows as Row[]).map((r) => r.value || ''),
    };

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Search suggestions API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

