import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createDataSource, updateDataSourceSyncStatus } from '@/lib/api/data-sources';
import { importChatGPTConversations, validateChatGPTExport } from '@/lib/chatgpt-import';
import { createImportJob, streamChatGPTImport } from '@/lib/streaming-import';

// Configure route for large file uploads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // JSON streaming mode (chunked import)
    if (contentType.includes('application/json')) {
      const { conversations, sourceName, sourceId } = await request.json();
      if (!Array.isArray(conversations) || conversations.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No conversations provided' },
          { status: 400 }
        );
      }

      let effectiveSourceId = sourceId as string | undefined;
      if (!effectiveSourceId) {
        const dsResult = await createDataSource(
          session.user.id,
          'chatgpt',
          (sourceName as string) || 'ChatGPT Import'
        );
        if (!dsResult.success) {
          return NextResponse.json(
            { success: false, error: 'Failed to create data source' },
            { status: 500 }
          );
        }
        effectiveSourceId = dsResult.data!.id;
      } else {
        // Touch sync status to syncing for ongoing batch
        await updateDataSourceSyncStatus(session.user.id, effectiveSourceId, 'syncing');
      }

      const jsonContent = JSON.stringify(conversations);
      const importResult = await importChatGPTConversations(
        session.user.id,
        effectiveSourceId!,
        jsonContent
      );

      return NextResponse.json({
        success: importResult.success,
        data: {
          sourceId: effectiveSourceId,
          imported: importResult.totalImported,
          errors: importResult.totalErrors,
        },
        errors: importResult.errors.length > 0 ? importResult.errors : undefined,
        message: `Imported ${importResult.totalImported} items in this batch` +
          (importResult.totalErrors > 0 ? `, ${importResult.totalErrors} failed` : ''),
      });
    }

    // Multipart upload mode (single file)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceName = (formData.get('sourceName') as string) || 'ChatGPT Import';

    if (!file) {
      console.error('[ChatGPT Import API] No file provided');
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[ChatGPT Import API] File received:', file.name, 'Size:', file.size, 'bytes');

    // Handle large files with streaming import
    const STREAMING_THRESHOLD = 5 * 1024 * 1024; // 5MB - use streaming for files larger than this
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - absolute maximum
    const isLargeFile = file.size > STREAMING_THRESHOLD;
    
    if (file.size > MAX_FILE_SIZE) {
      console.error('[ChatGPT Import API] File too large:', file.size, 'bytes');
      const sizeMB = Math.round(file.size / 1024 / 1024);
      return NextResponse.json(
        { 
          success: false, 
          error: `File size (${sizeMB}MB) exceeds maximum limit of 50MB. Please contact support for files larger than 50MB.`
        },
        { status: 413 }
      );
    }
    
    if (isLargeFile) {
      console.log('[ChatGPT Import API] Large file detected, using streaming import:', Math.round(file.size / 1024 / 1024), 'MB');
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      console.error('[ChatGPT Import API] Invalid file type:', file.name);
      return NextResponse.json(
        { success: false, error: 'File must be a JSON file' },
        { status: 400 }
      );
    }

    let content: string;
    try {
      console.log('[ChatGPT Import API] Reading file content...');
      content = await file.text();
      console.log('[ChatGPT Import API] File content read successfully, length:', content.length);
      content = content.trim().replace(/^\uFEFF/, '');
      console.log('[ChatGPT Import API] After sanitization, length:', content.length);
    } catch (error) {
      console.error('[ChatGPT Import API] Error reading file content:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to read file content. File may be corrupted or too large.' },
        { status: 400 }
      );
    }

    // Validate the export format
    console.log('[ChatGPT Import API] Starting validation...');
    const validation = validateChatGPTExport(content);
    console.log('[ChatGPT Import API] Validation result:', validation);
    if (!validation.valid) {
      console.error('[ChatGPT Import API] Validation failed:', validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Create a data source for this import
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

    // Choose import method based on file size
    if (isLargeFile) {
      // Large files: Use streaming import with progress tracking
      console.log('[ChatGPT Import API] Starting streaming import for large file...');
      
      const progressId = crypto.randomUUID();
      const progressJob = createImportJob(progressId);
      
      // Start streaming import in background (don't await)
      streamChatGPTImport(session.user.id, sourceId, content, progressId)
        .then(async (result) => {
          // Update data source sync status when done
          const syncStatus = result.success ? 'completed' : 'error';
          await updateDataSourceSyncStatus(session.user.id, sourceId, syncStatus);
        })
        .catch((error) => {
          console.error('Streaming import failed:', error);
          updateDataSourceSyncStatus(session.user.id, sourceId, 'error');
        });

      // Return progress ID immediately for frontend to track
      return NextResponse.json({
        success: true,
        streaming: true,
        data: {
          sourceId,
          progressId,
          estimatedConversations: validation.preview?.conversationCount || 0,
        },
        message: 'Large file upload started. Import is processing in the background.',
      });
      
    } else {
      // Small files: Use original synchronous import
      console.log('[ChatGPT Import API] Starting synchronous import for small file...');
      const importResult = await importChatGPTConversations(
        session.user.id,
        sourceId,
        content
      );
      console.log('[ChatGPT Import API] Import result:', importResult);

      // Return results immediately
      return NextResponse.json({
        success: importResult.success,
        streaming: false,
        data: {
          sourceId,
          imported: importResult.totalImported,
          errors: importResult.totalErrors,
          preview: validation.preview,
        },
        errors: importResult.errors.length > 0 ? importResult.errors : undefined,
        message: `Successfully imported ${importResult.totalImported} items${
          importResult.totalErrors > 0 ? ` with ${importResult.totalErrors} errors` : ''
        }`,
      });
    }

  } catch (error) {
    console.error('ChatGPT import API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Endpoint to validate a ChatGPT export file without importing
export async function PUT(request: NextRequest) {
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

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const content = await file.text();
    const validation = validateChatGPTExport(content);

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
      });
    }

    return NextResponse.json({
      success: true,
      data: validation.preview,
      message: `Valid ChatGPT export with ${validation.preview?.conversationCount} conversation(s)`,
    });

  } catch (error) {
    console.error('ChatGPT validation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate file' },
      { status: 500 }
    );
  }
}