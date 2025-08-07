import { ChatGPTConversation, ChatGPTMessage, KnowledgeItem } from '@/lib/types';
import { createKnowledgeItem } from '@/lib/api/knowledge-items';
import { updateDataSourceSyncStatus } from '@/lib/api/data-sources';
import { processKnowledgeItemWithAI } from '@/lib/ai-processing';

// Parse ChatGPT export JSON file
export function parseChatGPTExport(jsonContent: string): ChatGPTConversation[] {
  try {
    const data = JSON.parse(jsonContent);
    
    // Handle different possible formats from ChatGPT export
    if (Array.isArray(data)) {
      return data.map(conversation => ({
        id: conversation.id || conversation.conversation_id || crypto.randomUUID(),
        title: conversation.title || 'Untitled Conversation',
        messages: parseMessages(conversation.mapping || conversation.messages || []),
        created_at: conversation.create_time || conversation.created_at || new Date().toISOString(),
        updated_at: conversation.update_time || conversation.updated_at || new Date().toISOString(),
      }));
    } else if (data.mapping) {
      // Single conversation format
      return [{
        id: data.conversation_id || crypto.randomUUID(),
        title: data.title || 'Untitled Conversation',
        messages: parseMessages(data.mapping),
        created_at: data.create_time || new Date().toISOString(),
        updated_at: data.update_time || new Date().toISOString(),
      }];
    } else {
      throw new Error('Unrecognized ChatGPT export format');
    }
  } catch (error) {
    console.error('Error parsing ChatGPT export:', error);
    throw new Error('Invalid ChatGPT export file format');
  }
}

// Parse messages from different ChatGPT export formats
function parseMessages(messagesData: any): ChatGPTMessage[] {
  const messages: ChatGPTMessage[] = [];

  if (Array.isArray(messagesData)) {
    // Direct array of messages
    return messagesData
      .filter(msg => msg.content && msg.role)
      .map(msg => ({
        id: msg.id || crypto.randomUUID(),
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: msg.timestamp || msg.create_time || new Date().toISOString(),
      }));
  } else if (typeof messagesData === 'object') {
    // Mapping format (common in ChatGPT exports)
    Object.values(messagesData).forEach((node: any) => {
      if (node?.message?.content?.parts && node.message.content.parts.length > 0) {
        const content = node.message.content.parts.join('\n');
        if (content.trim()) {
          messages.push({
            id: node.id || crypto.randomUUID(),
            role: node.message.author?.role || 'user',
            content: content,
            timestamp: node.message.create_time 
              ? new Date(node.message.create_time * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
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
    results.errors.push(`Error processing conversation "${conversation.title}": ${error.message}`);
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
  const finalResults = {
    success: true,
    totalImported: 0,
    totalErrors: 0,
    errors: [] as string[],
  };

  try {
    // Update sync status to syncing
    await updateDataSourceSyncStatus(userId, sourceId, 'syncing');

    // Parse the ChatGPT export
    const conversations = parseChatGPTExport(jsonContent);
    
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
      errors: [...finalResults.errors, error.message],
    };
  }
}

// Validate ChatGPT export file format
export function validateChatGPTExport(jsonContent: string): {valid: boolean; error?: string; preview?: any} {
  try {
    const data = JSON.parse(jsonContent);
    
    // Check for expected structure
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { valid: false, error: 'Export file contains no conversations' };
      }
      
      const firstConv = data[0];
      if (!firstConv.mapping && !firstConv.messages && !firstConv.title) {
        return { valid: false, error: 'Invalid conversation format in export file' };
      }
      
      return {
        valid: true,
        preview: {
          conversationCount: data.length,
          firstTitle: firstConv.title || 'Untitled',
          format: 'multiple_conversations',
        },
      };
    } else if (data.mapping || data.messages) {
      return {
        valid: true,
        preview: {
          conversationCount: 1,
          firstTitle: data.title || 'Untitled',
          format: 'single_conversation',
        },
      };
    } else {
      return { valid: false, error: 'Unrecognized ChatGPT export format' };
    }
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}