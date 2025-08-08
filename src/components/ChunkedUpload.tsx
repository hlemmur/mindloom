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
      const content = await file.text();
      const conversations = JSON.parse(content);
      
      if (!Array.isArray(conversations)) {
        throw new Error('Invalid file format - expected array of conversations');
      }

      const totalConversations = conversations.length;
      let processedCount = 0;
      let sourceId: string | null = null;

      setStage(`Uploading ${totalConversations} conversations in batches...`);

      // Send conversations in chunks
      const chunkSize = 50; // 50 conversations per chunk
      for (let i = 0; i < conversations.length; i += chunkSize) {
        const chunk = conversations.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(conversations.length / chunkSize);
        
        setStage(`Uploading batch ${chunkIndex}/${totalChunks} (${chunk.length} conversations)...`);
        setProgress((processedCount / totalConversations) * 100);

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

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
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
      onError(error instanceof Error ? error.message : 'Unknown error');
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