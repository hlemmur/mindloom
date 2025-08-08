'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DirectFileUploadProps {
  file: File;
  sourceName: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onProgress: (progressId: string) => void;
}

export default function DirectFileUpload({ file, sourceName, onSuccess, onError, onProgress }: DirectFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadDirect = async () => {
    setIsUploading(true);
    
    try {
      // Step 1: Get upload URL
      const urlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sourceName,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, fileKey } = await urlResponse.json();

      // Step 2: Upload file directly (bypasses Vercel body limit)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file, // Direct binary upload - no FormData!
        headers: {
          'Content-Type': file.type,
          'Content-Length': file.size.toString(),
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Direct upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Trigger processing
      const processResponse = await fetch('/api/import/process-uploaded', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileKey,
          sourceName,
        }),
      });

      const result = await processResponse.json();
      
      if (result.success && result.data?.progressId) {
        onProgress(result.data.progressId);
        onSuccess(result);
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error('Direct upload error:', error);
      onError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Direct Upload Method</h3>
            <p className="text-gray-600 text-sm mt-1">
              Your file ({Math.round(file.size / 1024 / 1024)}MB) will be uploaded directly, 
              bypassing Vercel's size limits for reliable processing.
            </p>
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              ✅ Optimized for large files - no size restrictions
            </div>
          </div>

          <Button 
            onClick={uploadDirect}
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading Directly...
              </div>
            ) : (
              '🚀 Direct Upload'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}