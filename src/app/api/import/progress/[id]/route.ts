import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getImportProgress } from '@/lib/streaming-import';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Progress ID required' },
        { status: 400 }
      );
    }

    const progress = getImportProgress(id);
    
    if (!progress) {
      return NextResponse.json(
        { success: false, error: 'Import job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: progress,
    });

  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}