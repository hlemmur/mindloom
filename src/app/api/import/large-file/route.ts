import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createDataSource } from '@/lib/api/data-sources';
import { createImportJob, updateImportProgress, streamChatGPTImport } from '@/lib/streaming-import';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('[Large File Import] Starting large file import...');
  
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceName = (formData.get('sourceName') as string) || 'Large File Import';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[Large File Import] File received:', file.name, 'Size:', file.size);

    // Create data source
    const dataSourceResult = await createDataSource(
      session.user.id,
      'chatgpt',
      sourceName
    );

    if (!dataSourceResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create data source' },
        { status: 500 }
      );
    }

    const sourceId = dataSourceResult.data!.id;
    const progressId = crypto.randomUUID();

    // Create progress job
    createImportJob(progressId);

    try {
      // Read file content on server side (has more memory)
      const content = await file.text();
      console.log('[Large File Import] File read successfully, starting streaming import');
      
      // Start streaming import in background
      streamChatGPTImport(session.user.id, sourceId, content, progressId)
        .catch((error) => {
          console.error('[Large File Import] Streaming import failed:', error);
        });

      // Return progress ID immediately
      return NextResponse.json({
        success: true,
        streaming: true,
        data: {
          sourceId,
          progressId,
        },
        message: 'Large file import started successfully',
      });

    } catch (error) {
      console.error('[Large File Import] Error processing file:', error);
      
      updateImportProgress(progressId, {
        status: 'error',
        stage: 'File processing failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });

      return NextResponse.json(
        { success: false, error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Large File Import] API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}