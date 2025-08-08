import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { processKnowledgeItemWithAI } from '@/lib/ai-processing';

// Get count of pending items
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
         COUNT(*) FILTER (WHERE processing_status = 'processing') as processing,
         COUNT(*) FILTER (WHERE processing_status = 'error') as error,
         COUNT(*) FILTER (WHERE processing_status = 'completed') as completed
       FROM knowledge_items 
       WHERE user_id = $1`,
      [session.user.id]
    );

    const stats = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        pending: parseInt(stats.pending),
        processing: parseInt(stats.processing),
        error: parseInt(stats.error),
        completed: parseInt(stats.completed),
      },
    });

  } catch (error) {
    console.error('Pending items API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process next batch of pending items
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { batchSize = 5 } = await request.json();

    // Get next batch of pending items
    const pendingResult = await query(
      `SELECT id, title, content 
       FROM knowledge_items 
       WHERE user_id = $1 
         AND processing_status IN ('pending', 'error')
       ORDER BY created_at ASC
       LIMIT $2`,
      [session.user.id, Math.min(batchSize, 10)] // Cap at 10 items per batch
    );

    const pendingItems = pendingResult.rows;

    if (pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending items to process',
        processed: 0,
      });
    }

    let processed = 0;
    const errors: string[] = [];

    // Process each item
    for (const item of pendingItems) {
      try {
        const result = await processKnowledgeItemWithAI(
          session.user.id,
          item.id,
          item.content,
          item.title
        );

        if (result.success) {
          processed++;
        } else {
          errors.push(`Item ${item.id}: ${result.error}`);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        errors.push(`Item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} of ${pendingItems.length} items`,
      processed,
      total: pendingItems.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Batch processing API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}