import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createDataSource } from '@/lib/api/data-sources';
import { importChatGPTConversations, validateChatGPTExport } from '@/lib/chatgpt-import';

export async function POST(request: NextRequest) {
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
    const sourceName = formData.get('sourceName') as string || 'ChatGPT Import';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { success: false, error: 'File must be a JSON file' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Validate the export format
    const validation = validateChatGPTExport(content);
    if (!validation.valid) {
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
    const importResult = await importChatGPTConversations(
      session.user.id,
      sourceId,
      content
    );

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