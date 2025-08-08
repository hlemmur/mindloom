'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ChunkedUploadProps {
  file: File;
  sourceName: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

export default function ChunkedUpload({ file, sourceName, onSuccess, onError }: ChunkedUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks

  const uploadInChunks = async () => {
    setIsUploading(true);
    setStage('Reading file...');
    
    try {
      // Add timeout and memory protection for very large files
      let content: string;
      
      // For very large files (>10MB), add warning about memory usage
      if (file.size > 10 * 1024 * 1024) {
        setStage('Reading large file - this may take a moment...');
      }
      
      try {
        // Read with timeout protection
        const readPromise = file.text();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('File reading timeout after 60 seconds')), 60000)
        );
        
        content = await Promise.race([readPromise, timeoutPromise]);
      } catch (readError) {
        console.error('File reading failed:', readError);
        throw new Error(`Failed to read file: ${readError instanceof Error ? readError.message : 'Unknown error'}. File may be too large or corrupted.`);
      }
      
      setStage('Parsing conversations...');
      
      let conversations: any[];
      try {
        conversations = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        throw new Error('Invalid JSON format. Please ensure you uploaded a valid ChatGPT export file.');
      }
      
      if (!Array.isArray(conversations)) {
        throw new Error('Invalid file format - expected array of conversations');
      }

      const totalConversations = conversations.length;
      let processedCount = 0;
      let sourceId: string | null = null;

      setStage(`Uploading ${totalConversations} conversations in batches...`);

      // Send conversations in chunks - smaller chunks for larger files
      const conversationCount = conversations.length;
      let chunkSize = 50; // Default: 50 conversations per chunk
      
      // Use smaller chunks for very large files to avoid timeouts
      if (file.size > 20 * 1024 * 1024) { // >20MB files
        chunkSize = 20;
      } else if (file.size > 10 * 1024 * 1024) { // >10MB files  
        chunkSize = 30;
      }
      
      console.log(`Processing ${conversationCount} conversations in chunks of ${chunkSize}`);
      
      for (let i = 0; i < conversations.length; i += chunkSize) {
        const chunk = conversations.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(conversations.length / chunkSize);
        
        setStage(`Uploading batch ${chunkIndex}/${totalChunks} (${chunk.length} conversations)...`);
        setProgress((processedCount / totalConversations) * 100);

        // Retry logic for failed chunks
        let retries = 3;
        let result;
        
        while (retries > 0) {
          try {
            const response = await fetch('/api/import/chatgpt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                conversations: chunk,
                sourceName: i === 0 ? sourceName : undefined, // Only set name for first chunk
                sourceId, // Reuse same source for subsequent chunks
              }),
            });

            result = await response.json();
            
            if (result.success) {
              break; // Success, exit retry loop
            } else {
              throw new Error(result.error || 'Upload failed');
            }
          } catch (chunkError) {
            retries--;
            if (retries === 0) {
              throw new Error(`Failed to upload batch ${chunkIndex} after 3 attempts: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`);
            }
            
            console.warn(`Batch ${chunkIndex} failed, retrying... (${retries} attempts left)`);
            setStage(`Retrying batch ${chunkIndex}/${totalChunks}... (${retries} attempts left)`);
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Store sourceId from first chunk
        if (i === 0) {
          sourceId = result.data?.sourceId;
        }

        processedCount += chunk.length;
        setProgress((processedCount / totalConversations) * 100);
      }

      setStage('Upload complete!');
      onSuccess({
        success: true,
        data: {
          sourceId,
          imported: processedCount,
          conversationCount: totalConversations,
        },
        message: `Successfully uploaded ${processedCount} conversations in batches`,
      });

    } catch (error) {
      console.error('Chunked upload error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide specific guidance based on error type
        if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = `File too large for browser memory (${Math.round(file.size / 1024 / 1024)}MB). Try using a smaller file or contact support for alternative import methods.`;
        } else if (error.message.includes('timeout') || error.message.includes('reading timeout')) {
          errorMessage = `File reading timed out (${Math.round(file.size / 1024 / 1024)}MB). File may be too large or connection too slow.`;
        } else if (error.message.includes('JSON')) {
          errorMessage = `Invalid file format. Please ensure this is a valid ChatGPT export JSON file.`;
        }
      }
      
      onError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Using Smart Upload Method</h3>
            <p className="text-gray-600 text-sm mt-1">
              Your file ({Math.round(file.size / 1024 / 1024)}MB) exceeds Vercel's upload limits. 
              We'll process it in smaller, reliable batches instead - same result, better experience!
            </p>
            {file.size > 30 * 1024 * 1024 && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                ⚠️ Very large file detected. Processing may take several minutes. Please keep this tab open.
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(progress, 3)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{stage}</p>
              <p className="text-xs text-gray-500">{Math.round(progress)}% complete</p>
            </div>
          )}

          <Button 
            onClick={uploadInChunks}
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing Batches...
              </div>
            ) : (
              '🚀 Start Smart Upload'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}