'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LargeFileUploadProps {
  file: File;
  sourceName: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onProgress: (progressId: string) => void;
}

export default function LargeFileUpload({ file, sourceName, onSuccess, onError, onProgress }: LargeFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadLargeFile = async () => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceName', sourceName);

      // Upload to server-side processor with progress tracking
      const response = await fetch('/api/import/large-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data?.progressId) {
        // Server-side streaming import started
        onProgress(result.data.progressId);
        onSuccess(result);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Large file upload error:', error);
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
            <h3 className="text-lg font-semibold text-gray-900">Server-Side Processing</h3>
            <p className="text-gray-600 text-sm mt-1">
              Your file ({Math.round(file.size / 1024 / 1024)}MB) will be processed on our servers 
              for better memory handling and reliability.
            </p>
            {file.size > 20 * 1024 * 1024 && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                🚀 Large file detected - using our high-performance server infrastructure
              </div>
            )}
          </div>

          <Button 
            onClick={uploadLargeFile}
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading to Server...
              </div>
            ) : (
              '⚡ Process on Server'
            )}
          </Button>

          <p className="text-xs text-gray-500">
            Server processing can handle files up to 50MB efficiently
          </p>
        </div>
      </CardContent>
    </Card>
  );
}