import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKnowledgeItems, createKnowledgeItem } from '@/lib/api/knowledge-items';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;
    const categories = searchParams.get('categories')?.split(',').filter(Boolean);
    const emotions = searchParams.get('emotions')?.split(',').filter(Boolean);
    const topics = searchParams.get('topics')?.split(',').filter(Boolean);
    const sourceId = searchParams.get('sourceId') || undefined;

    const result = await getKnowledgeItems(session.user.id, {
      limit,
      offset,
      search,
      categories,
      emotions,
      topics,
      sourceId,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();

    // Validate required fields
    if (!data.content || !data.source_id) {
      return NextResponse.json(
        { success: false, error: 'Content and source_id are required' },
        { status: 400 }
      );
    }

    const result = await createKnowledgeItem(session.user.id, data);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}