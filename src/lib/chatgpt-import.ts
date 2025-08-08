import { ChatGPTConversation, ChatGPTMessage } from '@/lib/types';
import { createKnowledgeItem } from '@/lib/api/knowledge-items';
import { updateDataSourceSyncStatus } from '@/lib/api/data-sources';
import { processKnowledgeItemWithAI } from '@/lib/ai-processing';

// Parse ChatGPT export JSON file
export function parseChatGPTExport(jsonContent: string): ChatGPTConversation[] {
  console.log('[parseChatGPTExport] Starting parse...');
  console.log('[parseChatGPTExport] Input content length:', jsonContent.length);
  
  try {
    const sanitized = jsonContent.trim().replace(/^\uFEFF/, '');
    console.log('[parseChatGPTExport] After sanitization length:', sanitized.length);
    
    let data;
    try {
      data = JSON.parse(sanitized);
      console.log('[parseChatGPTExport] JSON parse successful');
      console.log('[parseChatGPTExport] Data type:', typeof data);
      console.log('[parseChatGPTExport] Is array:', Array.isArray(data));
    } catch (parseError) {
      console.error('[parseChatGPTExport] JSON parse error:', parseError);
      throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
    type LooseConversation = {
      id?: string;
      conversation_id?: string;
      title?: string;
      mapping?: unknown;
      messages?: unknown;
      create_time?: number | string;
      created_at?: string;
      update_time?: number | string;
      updated_at?: string;
    };
    
    const toIso = (value?: number | string): string => {
      if (typeof value === 'number') {
        // Heuristic: seconds vs milliseconds
        const ms = value < 1e12 ? value * 1000 : value;
        return new Date(ms).toISOString();
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      }
      return new Date().toISOString();
    };

    // Handle different possible formats from ChatGPT export
    if (Array.isArray(data)) {
      console.log('[parseChatGPTExport] Processing array format, length:', data.length);
      const conversations = (data as LooseConversation[]).map((conversation, index) => {
        console.log(`[parseChatGPTExport] Processing conversation ${index + 1}/${data.length}:`, conversation.title || 'Untitled');
        return {
          id: conversation.id || conversation.conversation_id || crypto.randomUUID(),
          title: conversation.title || 'Untitled Conversation',
          messages: parseMessages(conversation.mapping || conversation.messages || []),
          created_at: toIso(conversation.create_time || conversation.created_at),
          updated_at: toIso(conversation.update_time || conversation.updated_at),
        };
      });
      console.log('[parseChatGPTExport] Successfully parsed', conversations.length, 'conversations');
      return conversations;
    } else if (data.conversations && Array.isArray(data.conversations)) {
      // Root has `conversations` array
      return (data.conversations as LooseConversation[]).map((conversation) => ({
        id: conversation.id || conversation.conversation_id || crypto.randomUUID(),
        title: conversation.title || 'Untitled Conversation',
        messages: parseMessages(conversation.mapping || conversation.messages || []),
        created_at: toIso(conversation.create_time || conversation.created_at),
        updated_at: toIso(conversation.update_time || conversation.updated_at),
      }));
    } else if (data.items && Array.isArray(data.items)) {
      // Root has `items` array
      return (data.items as LooseConversation[]).map((conversation) => ({
        id: conversation.id || conversation.conversation_id || crypto.randomUUID(),
        title: conversation.title || 'Untitled Conversation',
        messages: parseMessages(conversation.mapping || conversation.messages || []),
        created_at: toIso(conversation.create_time || conversation.created_at),
        updated_at: toIso(conversation.update_time || conversation.updated_at),
      }));
    } else if (data.mapping) {
      // Single conversation format
      return [{
        id: data.conversation_id || crypto.randomUUID(),
        title: data.title || 'Untitled Conversation',
        messages: parseMessages(data.mapping),
        created_at: toIso((data as any).create_time),
        updated_at: toIso((data as any).update_time),
      }];
    } else {
      throw new Error('Unrecognized ChatGPT export format');
    }
  } catch (error) {
    console.error('[parseChatGPTExport] Error parsing ChatGPT export:', error);
    throw new Error(`Invalid ChatGPT export file format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse messages from different ChatGPT export formats
function parseMessages(messagesData: unknown): ChatGPTMessage[] {
  const messages: ChatGPTMessage[] = [];

  if (Array.isArray(messagesData)) {
    // Direct array of messages
    type ArrayMsg = {
      id?: string;
      role?: 'user' | 'assistant' | 'system';
      author?: { role?: 'user' | 'assistant' | 'system' };
      content?: unknown;
      message?: { content?: unknown; create_time?: number };
      timestamp?: string;
      create_time?: number;
    };

    return (messagesData as ArrayMsg[])
      .filter((msg) => (msg?.content || msg?.message?.content) && (msg?.role || msg?.author?.role))
      .map((m) => {
        const role = m.role || m.author?.role || 'user';
        let content = '';
        const c = m.content || m.message?.content;
        if (typeof c === 'string') {
          content = c;
        } else if (typeof c === 'object' && c && (c as { parts?: string[] }).parts && Array.isArray((c as { parts?: string[] }).parts)) {
          content = ((c as { parts?: string[] }).parts || []).join('\n');
        } else {
          content = JSON.stringify(c);
        }
        const ts = m.timestamp || m.create_time || m.message?.create_time;
        const iso = ts ? (typeof ts === 'number' ? new Date(ts * 1000).toISOString() : new Date(ts).toISOString()) : new Date().toISOString();
        return {
          id: m.id || crypto.randomUUID(),
          role,
          content,
          timestamp: iso,
        } as ChatGPTMessage;
      });
  } else if (typeof messagesData === 'object' && messagesData !== null) {
    // Mapping format (common in ChatGPT exports)
    Object.values(messagesData as Record<string, unknown>).forEach((nodeUnknown) => {
      const node = nodeUnknown as { id?: string; message?: { content?: any; author?: { role?: string }; create_time?: number } };
      const msg = node?.message;
      if (!msg) return;

      const authorRole = (msg.author?.role as 'user' | 'assistant' | 'system') || 'user';
      const contentObj = msg.content;
      let content = '';

      if (contentObj?.content_type === 'text') {
        const parts: string[] = Array.isArray(contentObj.parts) ? contentObj.parts : [];
        content = parts.join('\n');
      } else if (contentObj?.content_type === 'user_editable_context') {
        const pieces: string[] = [];
        if (typeof contentObj.user_profile === 'string' && contentObj.user_profile.trim()) {
          pieces.push(`User profile:\n${contentObj.user_profile.trim()}`);
        }
        if (typeof contentObj.user_instructions === 'string' && contentObj.user_instructions.trim()) {
          pieces.push(`User instructions:\n${contentObj.user_instructions.trim()}`);
        }
        content = pieces.join('\n\n');
      } else if (contentObj) {
        // Fallback to JSON string if unknown shape
        try { content = JSON.stringify(contentObj); } catch { content = ''; }
      }

      if (typeof content === 'string' && content.trim()) {
        const ts = msg.create_time;
        messages.push({
          id: node.id || crypto.randomUUID(),
          role: authorRole,
          content,
          timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
        });
      }
    });
  }

  return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Convert ChatGPT conversation to knowledge items
export async function convertConversationToKnowledgeItems(
  userId: string,
  sourceId: string,
  conversation: ChatGPTConversation
): Promise<{success: boolean; imported: number; errors: string[]}> {
  const results = { success: true, imported: 0, errors: [] as string[] };

  try {
    // Create a single knowledge item for the entire conversation
    const conversationContent = conversation.messages
      .map(msg => `**${msg.role.toUpperCase()}**: ${msg.content}`)
      .join('\n\n');

    const conversationResult = await createKnowledgeItem(userId, {
      source_id: sourceId,
      source_item_id: conversation.id,
      title: conversation.title,
      content: conversationContent,
      processing_status: 'pending',
      extracted_date: new Date(conversation.created_at),
      metadata: {
        type: 'chatgpt_conversation',
        message_count: conversation.messages.length,
        original_created_at: conversation.created_at,
        original_updated_at: conversation.updated_at,
      },
    });

    if (conversationResult.success) {
      results.imported++;
      
      // Queue the item for AI processing (don't wait for completion)
      processKnowledgeItemWithAI(
        userId,
        conversationResult.data!.id,
        conversationContent,
        conversation.title
      ).catch(error => {
        console.error('AI processing error for conversation:', error);
      });
    } else {
      results.errors.push(`Failed to import conversation "${conversation.title}": ${conversationResult.error}`);
      results.success = false;
    }

    // Optionally, create individual knowledge items for important messages
    const importantMessages = conversation.messages.filter(msg => 
      msg.content.length > 200 && // Longer messages are likely more substantial
      (msg.role === 'assistant' || msg.content.includes('?')) // Assistant responses or questions
    );

    for (const message of importantMessages.slice(0, 5)) { // Limit to 5 important messages per conversation
      const messageResult = await createKnowledgeItem(userId, {
        source_id: sourceId,
        source_item_id: `${conversation.id}_${message.id}`,
        title: `${conversation.title} - ${message.role} message`,
        content: message.content,
        processing_status: 'pending',
        extracted_date: new Date(message.timestamp),
        metadata: {
          type: 'chatgpt_message',
          conversation_id: conversation.id,
          conversation_title: conversation.title,
          message_role: message.role,
          original_timestamp: message.timestamp,
        },
      });

      if (messageResult.success) {
        results.imported++;
        
        // Queue the message for AI processing (don't wait for completion)
        processKnowledgeItemWithAI(
          userId,
          messageResult.data!.id,
          message.content,
          `${conversation.title} - ${message.role} message`
        ).catch(error => {
          console.error('AI processing error for message:', error);
        });
      } else {
        results.errors.push(`Failed to import message from "${conversation.title}": ${messageResult.error}`);
      }
    }

  } catch (error) {
    console.error('Error converting conversation:', error);
    results.errors.push(`Error processing conversation "${conversation.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.success = false;
  }

  return results;
}

// Main function to import ChatGPT conversations
export async function importChatGPTConversations(
  userId: string,
  sourceId: string,
  jsonContent: string
): Promise<{success: boolean; totalImported: number; totalErrors: number; errors: string[]}> {
  console.log('[importChatGPTConversations] Starting import process...');
  console.log('[importChatGPTConversations] userId:', userId);
  console.log('[importChatGPTConversations] sourceId:', sourceId);
  console.log('[importChatGPTConversations] jsonContent length:', jsonContent.length);
  
  const finalResults = {
    success: true,
    totalImported: 0,
    totalErrors: 0,
    errors: [] as string[],
  };

  try {
    // Update sync status to syncing
    console.log('[importChatGPTConversations] Updating sync status to syncing...');
    await updateDataSourceSyncStatus(userId, sourceId, 'syncing');

    // Parse the ChatGPT export
    console.log('[importChatGPTConversations] Starting to parse ChatGPT export...');
    const conversations = parseChatGPTExport(jsonContent);
    console.log('[importChatGPTConversations] Parsed', conversations.length, 'conversations');
    
    if (conversations.length === 0) {
      throw new Error('No conversations found in the export file');
    }

    // Process each conversation
    for (const conversation of conversations) {
      const result = await convertConversationToKnowledgeItems(userId, sourceId, conversation);
      
      finalResults.totalImported += result.imported;
      finalResults.totalErrors += result.errors.length;
      finalResults.errors.push(...result.errors);

      if (!result.success) {
        finalResults.success = false;
      }
    }

    // Update sync status
    const syncStatus = finalResults.success ? 'completed' : 'error';
    await updateDataSourceSyncStatus(userId, sourceId, syncStatus);

    return finalResults;

  } catch (error) {
    console.error('Import error:', error);
    
    // Update sync status to error
    await updateDataSourceSyncStatus(userId, sourceId, 'error');

    return {
      success: false,
      totalImported: finalResults.totalImported,
      totalErrors: finalResults.totalErrors + 1,
      errors: [...finalResults.errors, error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Validate ChatGPT export file format
export function validateChatGPTExport(jsonContent: string): {valid: boolean; error?: string; preview?: { conversationCount: number; firstTitle?: string; format: string }} {
  console.log('[validateChatGPTExport] Starting validation...');
  console.log('[validateChatGPTExport] Input content length:', jsonContent.length);
  console.log('[validateChatGPTExport] First 200 chars:', JSON.stringify(jsonContent.substring(0, 200)));
  
  try {
    const sanitized = jsonContent.trim().replace(/^\uFEFF/, '');
    console.log('[validateChatGPTExport] After sanitization length:', sanitized.length);
    console.log('[validateChatGPTExport] Last 200 chars:', JSON.stringify(sanitized.substring(sanitized.length - 200)));
    
    let data;
    try {
      data = JSON.parse(sanitized);
      console.log('[validateChatGPTExport] JSON parse successful');
      console.log('[validateChatGPTExport] Data type:', typeof data);
      console.log('[validateChatGPTExport] Is array:', Array.isArray(data));
    } catch (parseError) {
      console.error('[validateChatGPTExport] JSON parse error:', parseError);
      const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      
      // Check if it might be a truncated file
      if (errorMsg.includes('Unexpected end of JSON input') || errorMsg.includes('Expected')) {
        return { 
          valid: false, 
          error: `Invalid JSON format - file appears to be truncated or incomplete. ${errorMsg}. Please ensure you have the complete ChatGPT export file.`
        };
      }
      
      return { 
        valid: false, 
        error: `Invalid JSON format: ${errorMsg}`
      };
    }
    
    if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
      console.log('[validateChatGPTExport] Object keys:', Object.keys(data));
    }
    
    // Check for expected structure
    if (Array.isArray(data)) {
      console.log('[validateChatGPTExport] Processing array format, length:', data.length);
      if (data.length === 0) {
        console.log('[validateChatGPTExport] Empty array detected');
        return { valid: false, error: 'Export file contains no conversations' };
      }
      
      const firstConv = data[0];
      console.log('[validateChatGPTExport] First conversation type:', typeof firstConv);
      if (typeof firstConv === 'object' && firstConv !== null) {
        console.log('[validateChatGPTExport] First conversation keys:', Object.keys(firstConv));
        console.log('[validateChatGPTExport] First conversation fields check:');
        console.log('  - title:', firstConv?.title);
        console.log('  - mapping exists:', !!firstConv?.mapping);
        console.log('  - messages exists:', !!firstConv?.messages);
        console.log('  - create_time exists:', !!firstConv?.create_time);
        console.log('  - update_time exists:', !!firstConv?.update_time);
      }
      
      // Be lenient: accept if common fields exist
      const isLikelyConversation = !!(firstConv?.mapping || firstConv?.messages || firstConv?.title || firstConv?.create_time || firstConv?.update_time);
      console.log('[validateChatGPTExport] isLikelyConversation:', isLikelyConversation);
      
      if (!isLikelyConversation) {
        return { 
          valid: false, 
          error: `Invalid conversation format in export file. Expected ChatGPT conversation structure but found: ${JSON.stringify(firstConv, null, 2).substring(0, 500)}` 
        };
      }
      
      const result = {
        valid: true,
        preview: {
          conversationCount: data.length,
          firstTitle: firstConv.title || 'Untitled',
          format: 'multiple_conversations',
        },
      };
      console.log('[validateChatGPTExport] Array validation successful:', result);
      return result;
    } else if ((data as any).mapping || (data as any).messages) {
      console.log('[validateChatGPTExport] Processing single conversation format');
      const result = {
        valid: true,
        preview: {
          conversationCount: 1,
          firstTitle: data.title || 'Untitled',
          format: 'single_conversation',
        },
      };
      console.log('[validateChatGPTExport] Single conversation validation successful:', result);
      return result;
    } else if ((data as any).conversations && Array.isArray((data as any).conversations)) {
      console.log('[validateChatGPTExport] Processing root conversations array format');
      const firstConv = data.conversations[0] || {};
      const result = {
        valid: true,
        preview: {
          conversationCount: data.conversations.length,
          firstTitle: firstConv.title || 'Untitled',
          format: 'root_conversations_array',
        },
      };
      console.log('[validateChatGPTExport] Root conversations validation successful:', result);
      return result;
    } else if ((data as any).items && Array.isArray((data as any).items)) {
      console.log('[validateChatGPTExport] Processing root items array format');
      const firstItem = data.items[0] || {};
      const result = {
        valid: true,
        preview: {
          conversationCount: data.items.length,
          firstTitle: firstItem.title || 'Untitled',
          format: 'root_items_array',
        },
      };
      console.log('[validateChatGPTExport] Root items validation successful:', result);
      return result;
    } else {
      console.log('[validateChatGPTExport] Unrecognized format');
      console.log('[validateChatGPTExport] Data structure:', JSON.stringify(data, null, 2).substring(0, 1000));
      return { 
        valid: false, 
        error: `Unrecognized ChatGPT export format. Expected array of conversations or object with 'mapping'/'messages' fields. Found: ${typeof data === 'object' ? Object.keys(data).join(', ') : typeof data}` 
      };
    }
  } catch (error) {
    console.error('[validateChatGPTExport] Unexpected error:', error);
    return { 
      valid: false, 
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}