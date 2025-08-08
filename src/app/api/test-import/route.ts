import { NextRequest, NextResponse } from 'next/server';
import { validateChatGPTExport } from '@/lib/chatgpt-import';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('[Test Import] Testing import without authentication...');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' });
    }
    
    console.log('[Test Import] File received:', file.name, 'Size:', file.size);
    
    // Try to read file
    let content: string;
    try {
      content = await file.text();
      console.log('[Test Import] File read successfully, length:', content.length);
    } catch (error) {
      console.error('[Test Import] File read failed:', error);
      return NextResponse.json({ 
        success: false, 
        error: `File read failed: ${error}`,
        fileSize: file.size 
      });
    }
    
    // Try validation
    const validation = validateChatGPTExport(content);
    console.log('[Test Import] Validation result:', validation);
    
    return NextResponse.json({
      success: true,
      validation,
      fileInfo: {
        name: file.name,
        size: file.size,
        contentLength: content.length
      }
    });
    
  } catch (error) {
    console.error('[Test Import] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    });
  }
}