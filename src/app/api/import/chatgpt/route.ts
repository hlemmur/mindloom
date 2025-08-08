import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createDataSource, updateDataSourceSyncStatus } from '@/lib/api/data-sources';
import { importChatGPTConversations, validateChatGPTExport } from '@/lib/chatgpt-import';

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

    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      console.error('[ChatGPT Import API] File too large:', file.size, 'bytes');
      return NextResponse.json(
        { success: false, error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum limit of 10MB` },
        { status: 413 }
      );
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

    // Start the import process
    console.log('[ChatGPT Import API] Starting import process...');
    const importResult = await importChatGPTConversations(
      session.user.id,
      sourceId,
      content
    );
    console.log('[ChatGPT Import API] Import result:', importResult);

    // Return results
    return NextResponse.json({
      success: importResult.success,
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