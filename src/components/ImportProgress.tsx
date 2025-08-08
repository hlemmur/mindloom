import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ImportProgress {
  id: string;
  status: 'parsing' | 'importing' | 'completed' | 'error';
  stage: string;
  progress: number;
  totalConversations: number;
  processedConversations: number;
  importedItems: number;
  errors: string[];
  estimatedTimeRemaining?: number;
}

interface ImportProgressProps {
  progress: ImportProgress;
  fileName: string;
}

export default function ImportProgressComponent({ progress, fileName }: ImportProgressProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'parsing': return 'text-blue-600';
      case 'importing': return 'text-purple-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'parsing': return '📖';
      case 'importing': return '⚡';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <span className={getStatusColor()}>
              {progress.status === 'completed' ? 'Import Complete!' : 
               progress.status === 'error' ? 'Import Failed' : 
               'Importing Large File...'}
            </span>
            <CardDescription className="mt-1">{fileName}</CardDescription>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={getStatusColor()}>{progress.stage}</span>
            <span className="text-gray-500">{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ease-out ${
                progress.status === 'completed' ? 'bg-green-500' :
                progress.status === 'error' ? 'bg-red-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.max(progress.progress, 3)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {progress.totalConversations.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Conversations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {progress.processedConversations.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {progress.importedItems.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Items Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {progress.estimatedTimeRemaining ? formatTime(progress.estimatedTimeRemaining) : '--'}
            </div>
            <div className="text-xs text-gray-500">Time Remaining</div>
          </div>
        </div>

        {/* Processing Rate */}
        {progress.status === 'importing' && progress.processedConversations > 0 && (
          <div className="text-sm text-gray-600 text-center py-2">
            ⚡ Processing {Math.round(progress.processedConversations / ((Date.now() - new Date(progress.startTime || Date.now()).getTime()) / 1000 / 60) || 0)} conversations per minute
          </div>
        )}

        {/* Success Message */}
        {progress.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-800 font-medium">🎉 Import Successful!</div>
            <div className="text-green-700 text-sm mt-1">
              Successfully imported {progress.importedItems.toLocaleString()} knowledge items from {progress.processedConversations.toLocaleString()} conversations.
              <br />
              <span className="text-xs text-green-600">Redirecting to dashboard in 3 seconds...</span>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {progress.errors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-800 font-medium">⚠️ Import Warnings</div>
            <div className="text-yellow-700 text-sm mt-1">
              {progress.errors.slice(0, 3).map((error, index) => (
                <div key={index} className="mt-1">• {error}</div>
              ))}
              {progress.errors.length > 3 && (
                <div className="text-xs text-yellow-600 mt-2">
                  ... and {progress.errors.length - 3} more issues
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {progress.status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium">Import Failed</div>
            <div className="text-red-700 text-sm mt-1">
              The import process encountered an error. Please check your file and try again.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}