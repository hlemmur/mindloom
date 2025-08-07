'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProcessingStats {
  pending: number;
  processing: number;
  error: number;
  completed: number;
}

export function ProcessingStatus() {
  const [stats, setStats] = useState<ProcessingStats>({
    pending: 0,
    processing: 0,
    error: 0,
    completed: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/process/pending');
      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading processing stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processPendingItems = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/process/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchSize: 5 }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Processing result:', result);
        
        // Reload stats after processing
        await loadStats();
      }
    } catch (error) {
      console.error('Error processing items:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return null;
  }

  const totalItems = stats.pending + stats.processing + stats.error + stats.completed;
  const needsProcessing = stats.pending + stats.error > 0;

  if (totalItems === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          AI Processing Status
          <Button
            onClick={loadStats}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ↻
          </Button>
        </CardTitle>
        <CardDescription>
          AI analysis progress for your knowledge items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${totalItems > 0 ? (stats.completed / totalItems) * 100 : 0}%`,
            }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Completed:</span>
            <span className="font-medium text-green-600">{stats.completed}</span>
          </div>
          {stats.pending > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Pending:</span>
              <span className="font-medium text-orange-600">{stats.pending}</span>
            </div>
          )}
          {stats.processing > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Processing:</span>
              <span className="font-medium text-blue-600">{stats.processing}</span>
            </div>
          )}
          {stats.error > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Errors:</span>
              <span className="font-medium text-red-600">{stats.error}</span>
            </div>
          )}
        </div>

        {/* Process Button */}
        {needsProcessing && (
          <Button
            onClick={processPendingItems}
            disabled={isProcessing}
            size="sm"
            className="w-full mt-3"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                Processing...
              </div>
            ) : (
              `Process ${stats.pending + stats.error} Items`
            )}
          </Button>
        )}

        {stats.completed > 0 && !needsProcessing && (
          <div className="text-center text-sm text-green-600 font-medium">
            ✅ All items processed!
          </div>
        )}
      </CardContent>
    </Card>
  );
}