import { ChatGPTConversation } from '@/lib/types';
import { convertConversationToKnowledgeItems } from '@/lib/chatgpt-import';

export interface ImportProgress {
  id: string;
  status: 'parsing' | 'importing' | 'completed' | 'error';
  stage: string;
  progress: number; // 0-100
  totalConversations: number;
  processedConversations: number;
  importedItems: number;
  errors: string[];
  startTime: Date;
  estimatedTimeRemaining?: number;
}

// In-memory progress storage (in production, use Redis or database)
const progressStore = new Map<string, ImportProgress>();

export function createImportJob(id: string): ImportProgress {
  const progress: ImportProgress = {
    id,
    status: 'parsing',
    stage: 'Analyzing file...',
    progress: 0,
    totalConversations: 0,
    processedConversations: 0,
    importedItems: 0,
    errors: [],
    startTime: new Date(),
  };
  
  progressStore.set(id, progress);
  return progress;
}

export function updateImportProgress(id: string, updates: Partial<ImportProgress>): ImportProgress {
  const current = progressStore.get(id);
  if (!current) {
    throw new Error(`Import job ${id} not found`);
  }
  
  const updated = { ...current, ...updates };
  
  // Calculate estimated time remaining
  if (updated.processedConversations > 0 && updated.totalConversations > 0) {
    const elapsed = Date.now() - updated.startTime.getTime();
    const rate = updated.processedConversations / elapsed; // conversations per ms
    const remaining = updated.totalConversations - updated.processedConversations;
    updated.estimatedTimeRemaining = Math.round(remaining / rate / 1000); // seconds
  }
  
  // Calculate progress percentage
  if (updated.totalConversations > 0) {
    updated.progress = Math.round((updated.processedConversations / updated.totalConversations) * 100);
  }
  
  progressStore.set(id, updated);
  console.log(`[Import ${id}] Progress: ${updated.progress}% (${updated.processedConversations}/${updated.totalConversations}) - ${updated.stage}`);
  
  return updated;
}

export function getImportProgress(id: string): ImportProgress | undefined {
  return progressStore.get(id);
}

export function removeImportJob(id: string): void {
  progressStore.delete(id);
}

// Stream and process large ChatGPT exports
export async function streamChatGPTImport(
  userId: string,
  sourceId: string,
  jsonContent: string,
  progressId: string
): Promise<{ success: boolean; totalImported: number; totalErrors: number; errors: string[] }> {
  
  const results = {
    success: true,
    totalImported: 0,
    totalErrors: 0,
    errors: [] as string[],
  };

  try {
    // Update progress: parsing
    updateImportProgress(progressId, {
      status: 'parsing',
      stage: 'Parsing conversations...',
      progress: 5
    });

    // Parse JSON (this still loads into memory, but we'll process in chunks)
    let conversations: ChatGPTConversation[];
    try {
      const data = JSON.parse(jsonContent.trim().replace(/^\uFEFF/, ''));
      
      // Handle different ChatGPT export formats
      if (Array.isArray(data)) {
        conversations = data.map(conv => ({
          id: conv.id || conv.conversation_id || crypto.randomUUID(),
          title: conv.title || 'Untitled Conversation',
          messages: parseMessages(conv.mapping || conv.messages || []),
          created_at: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString(),
          updated_at: conv.update_time ? new Date(conv.update_time * 1000).toISOString() : new Date().toISOString(),
        }));
      } else {
        throw new Error('Expected array of conversations');
      }
    } catch (error) {
      updateImportProgress(progressId, {
        status: 'error',
        stage: 'Failed to parse file',
        errors: [`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
      throw error;
    }

    // Update progress with total count
    updateImportProgress(progressId, {
      status: 'importing',
      stage: 'Starting import...',
      totalConversations: conversations.length,
      progress: 10
    });

    // Process conversations in chunks to avoid memory issues
    const CHUNK_SIZE = 10; // Process 10 conversations at a time
    
    for (let i = 0; i < conversations.length; i += CHUNK_SIZE) {
      const chunk = conversations.slice(i, i + CHUNK_SIZE);
      const chunkEnd = Math.min(i + CHUNK_SIZE, conversations.length);
      
      updateImportProgress(progressId, {
        stage: `Importing conversations ${i + 1}-${chunkEnd} of ${conversations.length}...`,
        processedConversations: i
      });

      // Process each conversation in the chunk
      for (const conversation of chunk) {
        try {
          const convResult = await convertConversationToKnowledgeItems(userId, sourceId, conversation);
          results.totalImported += convResult.imported;
          results.totalErrors += convResult.errors.length;
          results.errors.push(...convResult.errors);
          
          if (!convResult.success) {
            results.success = false;
          }
          
          // Update progress after each conversation
          updateImportProgress(progressId, {
            processedConversations: results.totalImported > 0 ? Math.min(i + chunk.indexOf(conversation) + 1, conversations.length) : i + chunk.indexOf(conversation) + 1,
            importedItems: results.totalImported
          });
          
        } catch (error) {
          console.error('Error processing conversation:', error);
          results.totalErrors++;
          results.errors.push(`Failed to import "${conversation.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.success = false;
        }
      }

      // Small delay to allow progress updates to be seen
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final progress update
    updateImportProgress(progressId, {
      status: 'completed',
      stage: `Import completed! ${results.totalImported} items imported${results.totalErrors > 0 ? `, ${results.totalErrors} errors` : ''}`,
      processedConversations: conversations.length,
      progress: 100
    });

    return results;

  } catch (error) {
    console.error('Stream import error:', error);
    updateImportProgress(progressId, {
      status: 'error',
      stage: 'Import failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
    
    return {
      success: false,
      totalImported: results.totalImported,
      totalErrors: results.totalErrors + 1,
      errors: [...results.errors, error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Helper function to parse messages (simplified version)
function parseMessages(messagesData: unknown): any[] {
  if (Array.isArray(messagesData)) {
    return messagesData.filter(msg => msg?.content || msg?.message?.content);
  }
  
  if (typeof messagesData === 'object' && messagesData !== null) {
    const messages: any[] = [];
    Object.values(messagesData).forEach((node: any) => {
      const msg = node?.message;
      if (msg?.content) {
        messages.push({
          id: node.id || crypto.randomUUID(),
          role: msg.author?.role || 'user',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.create_time ? new Date(msg.create_time * 1000).toISOString() : new Date().toISOString(),
        });
      }
    });
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  return [];
}