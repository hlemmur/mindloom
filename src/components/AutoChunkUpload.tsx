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

const funProgressMessages = [
  "🔍 Analyzing your ChatGPT wisdom...",
  "🎯 Detecting conversation patterns...",
  "🧠 Extracting brilliant insights...", 
  "📚 Cataloging your knowledge treasures...",
  "✨ Sprinkling AI magic on your data...",
  "🔮 Divining conversation topics...",
  "🎪 Orchestrating your digital memories...",
  "🌟 Illuminating hidden connections...",
  "🎨 Painting your knowledge canvas...",
  "🚀 Launching conversations into orbit...",
  "🔬 Examining intellectual DNA...",
  "🎭 Rehearsing conversation symphonies...",
  "🌊 Surfing waves of wisdom...",
  "🎪 Juggling conversational gems...",
];

export default function AutoChunkUpload({ file, sourceName, onSuccess, onError }: AutoChunkUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunks, setChunks] = useState<ChunkProgress[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<'splitting' | 'uploading' | 'completed' | 'paused' | 'cancelled'>('splitting');
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentProgressMessage, setCurrentProgressMessage] = useState('');
  const [conversationStats, setConversationStats] = useState<{
    totalConversations: number;
    dateRange: { oldest: string; newest: string } | null;
    longestStreak: number;
    averagePerDay: number;
  } | null>(null);

  const analyzeConversations = (conversations: any[]) => {
    if (!Array.isArray(conversations) || conversations.length === 0) return null;

    // Extract dates
    const dates = conversations
      .map(conv => {
        const date = conv.created_at || conv.create_time;
        if (!date) return null;
        return typeof date === 'number' ? new Date(date * 1000) : new Date(date);
      })
      .filter(date => date && !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) return null;

    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    const daysDiff = Math.max(1, Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate usage patterns
    const dailyCounts = new Map<string, number>();
    dates.forEach(date => {
      const dayKey = date.toDateString();
      dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
    });

    // Find longest streak
    let longestStreak = 0;
    let currentStreak = 0;
    const sortedDays = Array.from(dailyCounts.keys()).sort();
    
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0 || new Date(sortedDays[i]).getTime() - new Date(sortedDays[i-1]).getTime() <= 24 * 60 * 60 * 1000) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    return {
      totalConversations: conversations.length,
      dateRange: {
        oldest: oldest.toLocaleDateString(),
        newest: newest.toLocaleDateString()
      },
      longestStreak,
      averagePerDay: Math.round((conversations.length / daysDiff) * 10) / 10
    };
  };

  const getEncouragingMessage = (stats: typeof conversationStats): string => {
    if (!stats) return "Ready to process your ChatGPT conversations!";

    const messages = [];
    
    if (stats.totalConversations > 500) {
      messages.push("🤯 Wow! You've been quite the ChatGPT power user!");
    } else if (stats.totalConversations > 100) {
      messages.push("🎉 Impressive collection of conversations!");
    } else {
      messages.push("🌟 Great start on your AI journey!");
    }

    if (stats.longestStreak > 30) {
      messages.push(`🔥 Amazing ${stats.longestStreak}-day streak! You're dedicated!`);
    } else if (stats.longestStreak > 7) {
      messages.push(`💪 Nice ${stats.longestStreak}-day usage streak!`);
    }

    if (stats.averagePerDay > 5) {
      messages.push("📈 You're averaging more than 5 conversations per day - impressive!");
    } else if (stats.averagePerDay > 1) {
      messages.push(`📊 Averaging ${stats.averagePerDay} conversations per day - consistent!`);
    }

    if (stats.dateRange) {
      const years = new Date(stats.dateRange.newest).getFullYear() - new Date(stats.dateRange.oldest).getFullYear();
      if (years >= 2) {
        messages.push(`🗓️ ${years}+ years of AI conversations - what a journey!`);
      } else if (years >= 1) {
        messages.push("📅 Over a year of ChatGPT usage - you're a veteran!");
      }
    }

    return messages.join(' ');
  };

  const splitAndProcessFile = async () => {
    setIsProcessing(true);
    setCurrentStage('splitting');
    setCurrentProgressMessage(funProgressMessages[0]);

    try {
      // Read and parse the file
      const content = await file.text();
      const conversations = JSON.parse(content);

      if (!Array.isArray(conversations)) {
        throw new Error('Invalid file format - not a conversation array');
      }

      // Analyze conversations for stats
      const stats = analyzeConversations(conversations);
      setConversationStats(stats);

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

      // Start progress message rotation
      const messageInterval = setInterval(() => {
        setCurrentProgressMessage(prev => {
          const currentIndex = funProgressMessages.indexOf(prev);
          const nextIndex = (currentIndex + 1) % funProgressMessages.length;
          return funProgressMessages[nextIndex];
        });
      }, 3000);

      try {
        await processChunks(fileChunks, conversations);
      } finally {
        clearInterval(messageInterval);
      }

    } catch (error) {
      console.error('Auto chunk upload error:', error);
      setCurrentStage('completed');
      onError(error instanceof Error ? error.message : 'Failed to process large file');
    } finally {
      setIsProcessing(false);
    }
  };

  const processChunks = async (fileChunks: any[][], originalConversations: any[]) => {
    const results: any[] = [];
    let completedChunks = 0;
    let totalItemsImported = 0;
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
            totalItemsImported += result.data?.imported || 0;
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
      const totalConversations = originalConversations.length;
      // Success if at least one chunk was processed
      onSuccess({
        success: true,
        data: {
          totalChunks: fileChunks.length,
          completedChunks,
          failedChunks: fileChunks.length - completedChunks,
          sources: results.map(r => r.data),
          totalConversations,
          importedItems: totalItemsImported,
        },
        message: `🎉 Import Completed!\nSuccessfully imported ${completedChunks}/${fileChunks.length} chunks containing ${totalConversations} conversations\n${totalItemsImported} Knowledge Items Created`,
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

        {/* Fun Progress Message */}
        {currentStage === 'uploading' && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-lg font-medium text-gray-800 mb-2">{currentProgressMessage}</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        )}

        {/* Conversation Stats */}
        {conversationStats && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800 mb-2">
                {conversationStats.totalConversations.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 mb-4">conversations discovered</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {conversationStats.dateRange && (
                  <div className="text-center">
                    <div className="font-medium text-gray-700">📅 Date Range</div>
                    <div className="text-gray-600">{conversationStats.dateRange.oldest} - {conversationStats.dateRange.newest}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="font-medium text-gray-700">🔥 Longest Streak</div>
                  <div className="text-gray-600">{conversationStats.longestStreak} days</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-700">📊 Daily Average</div>
                  <div className="text-gray-600">{conversationStats.averagePerDay} conversations</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-700">📦 Processing</div>
                  <div className="text-gray-600">{chunks.length} chunks</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-white/50 rounded-lg">
                <p className="text-sm text-gray-700 italic">
                  {getEncouragingMessage(conversationStats)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Simple Status Summary */}
        {chunks.length > 0 && currentStage === 'uploading' && (
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-medium text-green-600">{chunks.filter(c => c.status === 'completed').length}</div>
              <div className="text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-600">{chunks.filter(c => c.status === 'uploading').length}</div>
              <div className="text-gray-600">Processing</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">{chunks.filter(c => c.status === 'failed').length}</div>
              <div className="text-gray-600">Failed</div>
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