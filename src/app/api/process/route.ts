import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processKnowledgeItemWithAI, batchProcessKnowledgeItems } from '@/lib/ai-processing';
import { getKnowledgeItems } from '@/lib/api/knowledge-items';

// Process a single knowledge item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { itemId, content, title } = await request.json();

    if (!itemId && !content) {
      return NextResponse.json(
        { success: false, error: 'Either itemId or content is required' },
        { status: 400 }
      );
    }

    let actualContent = content;
    let actualTitle = title;

    // If only itemId is provided, fetch the item
    if (itemId && !content) {
      const itemResult = await fetch(`${request.nextUrl.origin}/api/knowledge-items/${itemId}`, {
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
        },
      });

      if (!itemResult.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch knowledge item' },
          { status: 404 }
        );
      }

      const itemData = await itemResult.json();
      actualContent = itemData.data.content;
      actualTitle = itemData.data.title;
    }

    const result = await processKnowledgeItemWithAI(
      session.user.id,
      itemId,
      actualContent,
      actualTitle
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge item processed successfully',
    });

  } catch (error) {
    console.error('Processing API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Batch process multiple items or all pending items
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { itemIds, processPending = false } = await request.json();

    let targetItemIds = itemIds;

    // If processPending is true, get all pending items
    if (processPending) {
      const pendingItemsResult = await getKnowledgeItems(session.user.id, {
        limit: 100, // Process up to 100 items at a time
      });

      if (!pendingItemsResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch pending items' },
          { status: 400 }
        );
      }

      // Filter for pending items
      const pendingItems = pendingItemsResult.data!.items.filter(
        item => item.processing_status === 'pending' || item.processing_status === 'error'
      );

      targetItemIds = pendingItems.map(item => item.id);
    }

    if (!targetItemIds || targetItemIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items to process',
        processed: 0,
        failed: 0,
        errors: [],
      });
    }

    const result = await batchProcessKnowledgeItems(session.user.id, targetItemIds);

    return NextResponse.json({
      success: result.success,
      message: `Processed ${result.processed} items, ${result.failed} failed`,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
    });

  } catch (error) {
    console.error('Batch processing API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}