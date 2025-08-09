'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AutoChunkUploadProps {
  file: File;
  sourceName: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

interface ChunkProgress {
  index: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  conversationsCount?: number;
  error?: string;
  sourceId?: string;
  retryCount: number;
  uploadProgress?: number;
}

export default function AutoChunkUpload({ file, sourceName, onSuccess, onError }: AutoChunkUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunks, setChunks] = useState<ChunkProgress[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<'splitting' | 'uploading' | 'completed' | 'paused' | 'cancelled'>('splitting');
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const splitAndProcessFile = async () => {
    setIsProcessing(true);
    setCurrentStage('splitting');

    try {
      // Read and parse the file
      const content = await file.text();
      const conversations = JSON.parse(content);

      if (!Array.isArray(conversations)) {
        throw new Error('Invalid file format - not a conversation array');
      }

      // Calculate optimal chunk size (target ~3MB per chunk)
      const targetSize = 3 * 1024 * 1024; // 3MB
      const fileChunks: any[][] = [];
      let currentChunk: any[] = [];
      let currentSize = 2; // Start with array brackets []

      for (const conversation of conversations) {
        const conversationJson = JSON.stringify(conversation);
        const conversationSize = conversationJson.length + (currentChunk.length > 0 ? 1 : 0); // +1 for comma

        // If adding this conversation would exceed target size, save current chunk
        if (currentSize + conversationSize > targetSize && currentChunk.length > 0) {
          fileChunks.push([...currentChunk]);
          currentChunk = [];
          currentSize = 2;
        }

        currentChunk.push(conversation);
        currentSize += conversationSize;
      }

      // Save final chunk
      if (currentChunk.length > 0) {
        fileChunks.push(currentChunk);
      }

      // Initialize chunk progress tracking
      const initialChunks: ChunkProgress[] = fileChunks.map((_, index) => ({
        index,
        status: 'pending',
        conversationsCount: fileChunks[index].length,
        retryCount: 0,
        uploadProgress: 0,
      }));

      setChunks(initialChunks);
      setCurrentStage('uploading');
      setStartTime(Date.now());

      await processChunks(fileChunks);

    } catch (error) {
      console.error('Auto chunk upload error:', error);
      setCurrentStage('completed');
      onError(error instanceof Error ? error.message : 'Failed to process large file');
    } finally {
      setIsProcessing(false);
    }
  };

  const processChunks = async (fileChunks: any[][]) => {
    const results: any[] = [];
    let completedChunks = 0;
    const maxRetries = 3;

    for (let i = 0; i < fileChunks.length; i++) {
      // Check for pause or cancellation
      while (isPaused && !isCancelled) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (isCancelled) {
        setCurrentStage('cancelled');
        onError('Upload cancelled by user');
        return;
      }

      const chunk = fileChunks[i];
      let success = false;
      let retryCount = 0;

      while (!success && retryCount <= maxRetries && !isCancelled) {
        try {
          // Update chunk status to uploading
          setChunks(prev => prev.map(c => 
            c.index === i ? { ...c, status: 'uploading', retryCount, uploadProgress: 0 } : c
          ));

          // Create chunk as JSON blob
          const chunkJson = JSON.stringify(chunk);
          const chunkBlob = new Blob([chunkJson], { type: 'application/json' });
          const chunkFile = new File([chunkBlob], `${file.name}_chunk_${i + 1}.json`, {
            type: 'application/json'
          });

          // Upload chunk with progress tracking
          const formData = new FormData();
          formData.append('file', chunkFile);
          formData.append('sourceName', `${sourceName} (Part ${i + 1}/${fileChunks.length})`);

          const response = await uploadWithProgress(formData, i);
          const result = await response.json();

          if (result.success) {
            // Update chunk status to completed
            setChunks(prev => prev.map(c => 
              c.index === i ? { 
                ...c, 
                status: 'completed',
                sourceId: result.data?.sourceId,
                uploadProgress: 100
              } : c
            ));
            
            results.push(result);
            completedChunks++;
            success = true;
          } else {
            throw new Error(result.errors?.[0] || 'Upload failed');
          }

        } catch (error) {
          retryCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (retryCount > maxRetries) {
            // Update chunk status to failed after exhausting retries
            setChunks(prev => prev.map(c => 
              c.index === i ? { 
                ...c, 
                status: 'failed',
                error: `Failed after ${maxRetries} retries: ${errorMessage}`,
                retryCount: retryCount - 1
              } : c
            ));
            console.error(`Chunk ${i + 1} failed after ${maxRetries} retries:`, error);
            break;
          } else {
            // Wait before retry with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            console.warn(`Chunk ${i + 1} failed, retrying in ${delay}ms (attempt ${retryCount}):`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Update overall progress and time estimates
      const progress = Math.round(((i + 1) / fileChunks.length) * 100);
      setOverallProgress(progress);
      
      if (startTime && completedChunks > 0) {
        const elapsed = Date.now() - startTime;
        const avgTimePerChunk = elapsed / (i + 1);
        const remaining = (fileChunks.length - (i + 1)) * avgTimePerChunk;
        setEstimatedTimeRemaining(Math.round(remaining / 1000));
      }
    }

    setCurrentStage('completed');

    if (completedChunks > 0) {
      const totalConversations = fileChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      // Success if at least one chunk was processed
      onSuccess({
        success: true,
        data: {
          totalChunks: fileChunks.length,
          completedChunks,
          failedChunks: fileChunks.length - completedChunks,
          sources: results.map(r => r.data),
          totalConversations,
        },
        message: `Successfully imported ${completedChunks}/${fileChunks.length} chunks containing ${totalConversations} conversations`,
      });
    } else {
      throw new Error('All chunks failed to process');
    }
  };

  const uploadWithProgress = async (formData: FormData, chunkIndex: number): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setChunks(prev => prev.map(c => 
            c.index === chunkIndex ? { ...c, uploadProgress: progress } : c
          ));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          } as Response);
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));

      xhr.open('POST', '/api/import/chatgpt');
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(formData);
    });
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    setCurrentStage(isPaused ? 'uploading' : 'paused');
  };

  const handleCancel = () => {
    setIsCancelled(true);
    setCurrentStage('cancelled');
  };

  const handleRetryFailed = async () => {
    const failedChunks = chunks.filter(c => c.status === 'failed');
    if (failedChunks.length === 0) return;

    // Reset failed chunks to pending
    setChunks(prev => prev.map(c => 
      c.status === 'failed' ? { ...c, status: 'pending', error: undefined, retryCount: 0 } : c
    ));

    // Recreate file chunks for failed indices
    const content = await file.text();
    const conversations = JSON.parse(content);
    const targetSize = 3 * 1024 * 1024;
    const fileChunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentSize = 2;

    for (const conversation of conversations) {
      const conversationJson = JSON.stringify(conversation);
      const conversationSize = conversationJson.length + (currentChunk.length > 0 ? 1 : 0);

      if (currentSize + conversationSize > targetSize && currentChunk.length > 0) {
        fileChunks.push([...currentChunk]);
        currentChunk = [];
        currentSize = 2;
      }

      currentChunk.push(conversation);
      currentSize += conversationSize;
    }

    if (currentChunk.length > 0) {
      fileChunks.push(currentChunk);
    }

    // Process only the failed chunks
    setCurrentStage('uploading');
    await processFailedChunks(fileChunks, failedChunks.map(c => c.index));
  };

  const processFailedChunks = async (fileChunks: any[][], failedIndices: number[]) => {
    for (const index of failedIndices) {
      if (isCancelled) break;
      
      // Same retry logic as processChunks but only for specific indices
      const chunk = fileChunks[index];
      let success = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!success && retryCount <= maxRetries && !isCancelled) {
        try {
          setChunks(prev => prev.map(c => 
            c.index === index ? { ...c, status: 'uploading', retryCount, uploadProgress: 0 } : c
          ));

          const chunkJson = JSON.stringify(chunk);
          const chunkBlob = new Blob([chunkJson], { type: 'application/json' });
          const chunkFile = new File([chunkBlob], `${file.name}_chunk_${index + 1}.json`, {
            type: 'application/json'
          });

          const formData = new FormData();
          formData.append('file', chunkFile);
          formData.append('sourceName', `${sourceName} (Part ${index + 1}/${fileChunks.length}) - Retry`);

          const response = await uploadWithProgress(formData, index);
          const result = await response.json();

          if (result.success) {
            setChunks(prev => prev.map(c => 
              c.index === index ? { 
                ...c, 
                status: 'completed',
                sourceId: result.data?.sourceId,
                uploadProgress: 100
              } : c
            ));
            success = true;
          } else {
            throw new Error(result.errors?.[0] || 'Upload failed');
          }

        } catch (error) {
          retryCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (retryCount > maxRetries) {
            setChunks(prev => prev.map(c => 
              c.index === index ? { 
                ...c, 
                status: 'failed',
                error: `Failed after ${maxRetries} retries: ${errorMessage}`,
                retryCount: retryCount - 1
              } : c
            ));
            break;
          } else {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  useEffect(() => {
    // Auto-start processing when component mounts
    splitAndProcessFile();
  }, []);

  const getStageTitle = () => {
    switch (currentStage) {
      case 'splitting': return '🔪 Analyzing and Splitting File';
      case 'uploading': return '📤 Processing Chunks';
      case 'paused': return '⏸️ Upload Paused';
      case 'cancelled': return '❌ Upload Cancelled';
      case 'completed': return '✅ Processing Complete';
    }
  };

  const getStageDescription = () => {
    switch (currentStage) {
      case 'splitting': return 'Breaking your large file into manageable chunks...';
      case 'uploading': return `Processing ${chunks.length} chunks automatically...`;
      case 'paused': return 'Upload is paused. Click resume to continue.';
      case 'cancelled': return 'Upload was cancelled by user.';
      case 'completed': return 'All chunks have been processed!';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getStageTitle()}</CardTitle>
        <p className="text-sm text-gray-600">
          {getStageDescription()}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <div className="flex items-center gap-2 text-gray-600">
              <span>{overallProgress}%</span>
              {estimatedTimeRemaining && currentStage === 'uploading' && (
                <span className="text-xs">• ~{formatTime(estimatedTimeRemaining)} remaining</span>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ease-out ${
                currentStage === 'cancelled' ? 'bg-red-500' :
                currentStage === 'paused' ? 'bg-yellow-500' :
                'bg-blue-600'
              }`}
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Control Buttons */}
        {(currentStage === 'uploading' || currentStage === 'paused') && !isCancelled && (
          <div className="flex gap-2 justify-center">
            <Button
              onClick={handlePause}
              variant="outline"
              size="sm"
              disabled={currentStage === 'splitting' || currentStage === 'completed'}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              ❌ Cancel
            </Button>
          </div>
        )}

        {/* Retry Failed Button */}
        {currentStage === 'completed' && chunks.some(c => c.status === 'failed') && (
          <div className="flex justify-center">
            <Button
              onClick={handleRetryFailed}
              variant="outline"
              size="sm"
              className="text-orange-600 hover:text-orange-700"
            >
              🔄 Retry Failed Chunks
            </Button>
          </div>
        )}

        {/* File Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <span className="text-lg">📂</span>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-blue-600">
                {Math.round(file.size / 1024 / 1024)}MB → {chunks.length} chunks
              </p>
            </div>
          </div>
        </div>

        {/* Chunk Progress */}
        {chunks.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Chunk Progress</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {chunks.map((chunk) => (
                <div key={chunk.index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white">
                        {chunk.status === 'completed' && <span className="text-green-600">✓</span>}
                        {chunk.status === 'failed' && <span className="text-red-600">✗</span>}
                        {chunk.status === 'uploading' && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                        {chunk.status === 'pending' && <span className="text-gray-400">⏳</span>}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Part {chunk.index + 1}
                          {chunk.retryCount > 0 && (
                            <span className="text-xs text-orange-600 ml-2">(Retry {chunk.retryCount})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600">
                          {chunk.conversationsCount} conversations
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        chunk.status === 'completed' ? 'bg-green-100 text-green-800' :
                        chunk.status === 'failed' ? 'bg-red-100 text-red-800' :
                        chunk.status === 'uploading' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {chunk.status}
                        {chunk.status === 'uploading' && chunk.uploadProgress !== undefined && (
                          <span className="ml-1">({chunk.uploadProgress}%)</span>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {/* Individual chunk progress bar */}
                  {chunk.status === 'uploading' && chunk.uploadProgress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${chunk.uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {/* Error message */}
                  {chunk.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {chunk.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Message */}
        {currentStage === 'splitting' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Preparing your large file for processing...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}