'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import ImportProgressComponent from '@/components/ImportProgress';
import ChunkedUpload from '@/components/ChunkedUpload';

interface ImportResult {
  success: boolean;
  streaming?: boolean;
  data?: {
    sourceId: string;
    imported?: number;
    errors?: number;
    preview?: { conversationCount?: number };
    progressId?: string;
    estimatedConversations?: number;
  };
  errors?: string[];
  message?: string;
}

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

export default function ChatGPTImportPage() {
  const { status } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; data?: { conversationCount: number; firstTitle?: string; format: string }; error?: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isPollingProgress, setIsPollingProgress] = useState(false);
  const [showChunkedUpload, setShowChunkedUpload] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Progress polling effect
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    if (isPollingProgress && importResult?.data?.progressId) {
      const pollProgress = async () => {
        try {
          const response = await fetch(`/api/import/progress/${importResult.data!.progressId}`);
          const result = await response.json();
          
          if (result.success) {
            setImportProgress(result.data);
            
            // Stop polling when completed or failed
            if (result.data.status === 'completed' || result.data.status === 'error') {
              setIsPollingProgress(false);
              setIsUploading(false);
              
              // Redirect to dashboard after successful completion
              if (result.data.status === 'completed') {
                setTimeout(() => {
                  router.push('/dashboard');
                }, 3000);
              }
            }
          }
        } catch (error) {
          console.error('Progress polling error:', error);
        }
      };
      
      // Poll every 1 second
      pollInterval = setInterval(pollProgress, 1000);
      
      // Poll immediately
      pollProgress();
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isPollingProgress, importResult?.data?.progressId, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationResult(null);
    setImportResult(null);

    // Auto-generate source name from filename
    if (!sourceName) {
      const baseName = selectedFile.name.replace('.json', '');
      setSourceName(`ChatGPT Import - ${baseName}`);
    }

    // Validate the file
    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/chatgpt', {
        method: 'PUT',
        body: formData,
      });

      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        success: false,
        error: 'Failed to validate file',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !validationResult?.success) return;

    setIsUploading(true);
    setImportProgress(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceName', sourceName || 'ChatGPT Import');

      const response = await fetch('/api/import/chatgpt', {
        method: 'POST',
        body: formData,
      });

      // Check for Vercel payload size limit (413 error)
      if (response.status === 413) {
        console.log('Vercel payload too large error detected, using chunked upload fallback');
        setShowChunkedUpload(true);
        setIsUploading(false);
        return;
      }

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        if (result.streaming && result.data?.progressId) {
          // Large file: Start progress polling
          console.log('Starting progress tracking for large file import');
          setIsPollingProgress(true);
        } else {
          // Small file: Import completed immediately
          setIsUploading(false);
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        }
      } else {
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Import error:', error);
      
      // Check if it's a large file that might benefit from chunked upload
      const isLargeFile = file && file.size > 5 * 1024 * 1024; // 5MB+
      if (isLargeFile && error instanceof Error && 
          (error.message.includes('timeout') || error.message.includes('too large') || error.message.includes('Failed to fetch'))) {
        console.log('Large file upload failed, offering chunked upload option');
        setShowChunkedUpload(true);
        setIsUploading(false);
      } else {
        setImportResult({
          success: false,
          errors: [error instanceof Error ? error.message : 'Failed to import data'],
        });
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import ChatGPT Conversations</h1>
              <p className="text-sm text-gray-600 mt-1">
                Upload your ChatGPT export file to analyze and organize your AI conversations
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/import">← Back to Import Options</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {showChunkedUpload && file ? (
          <ChunkedUpload
            file={file}
            sourceName={sourceName}
            onSuccess={(result) => {
              setImportResult(result);
              setShowChunkedUpload(false);
            }}
            onError={(error) => {
              setImportResult({
                success: false,
                errors: [error],
              });
              setShowChunkedUpload(false);
            }}
          />
        ) : !importResult ? (
          <div className="space-y-6">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>📋 How to Export Your ChatGPT Data</CardTitle>
                <CardDescription>Follow these steps to get your conversation data from OpenAI</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                   <li>Go to <a href="https://chatgpt.com/#settings/DataControls" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ChatGPT Account Settings</a></li>
                  <li>Navigate to the &quot;Export Data&quot; section</li>
                  <li>Request an export of your ChatGPT conversation data</li>
                  <li>Wait for the export email (this can take up to 30 days)</li>
                  <li>Download the ZIP file and extract the JSON file(s)</li>
                  <li>Upload the conversation JSON file below</li>
                </ol>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                     <strong>Note:</strong> OpenAI exports can contain multiple JSON files. Upload the one labeled &quot;conversations.json&quot; or similar.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>📤 Upload Your Export File</CardTitle>
                <CardDescription>
                  Select your ChatGPT export JSON file to begin the import process
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                    ChatGPT Export File (JSON)
                  </label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="w-full"
                  />
                </div>

                <div>
                  <label htmlFor="source-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Source Name (Optional)
                  </label>
                  <Input
                    id="source-name"
                    type="text"
                    placeholder="e.g., ChatGPT Conversations 2024"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will help you identify this data source in your dashboard
                  </p>
                </div>

                {/* Validation Status */}
                {isValidating && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Validating file format...
                  </div>
                )}

                {validationResult && (
                  <div className={`p-3 rounded-lg ${
                    validationResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {validationResult.success ? (
                      <div>
                        <p className="text-sm text-green-800 font-medium mb-1">✅ File validated successfully!</p>
                        {validationResult.data && (
                          <div className="text-xs text-green-700">
                             <p>Found {validationResult.data?.conversationCount} conversation(s)</p>
                             <p>Format: {validationResult.data?.format}</p>
                             {validationResult.data?.firstTitle && (
                               <p>First conversation: &quot;{validationResult.data.firstTitle}&quot;</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-red-800 font-medium">❌ Validation failed</p>
                        <p className="text-xs text-red-700 mt-1">{validationResult.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Import Button */}
                <Button
                  onClick={handleImport}
                  disabled={!file || !validationResult?.success || isUploading}
                  className="w-full"
                  size="lg"
                >
                  {isUploading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing conversations...
                    </div>
                  ) : (
                    'Import ChatGPT Data'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* What Happens Next */}
            <Card>
              <CardHeader>
                <CardTitle>🔮 What Happens Next?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex gap-3">
                    <span className="text-blue-600">1.</span>
                    <div>
                      <p className="font-medium text-gray-900">Conversation Analysis</p>
                      <p>Each conversation will be analyzed for topics, emotions, entities, and key insights</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-blue-600">2.</span>
                    <div>
                      <p className="font-medium text-gray-900">Smart Organization</p>
                      <p>Conversations will be automatically categorized and tagged for easy discovery</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-blue-600">3.</span>
                    <div>
                      <p className="font-medium text-gray-900">Searchable Knowledge Base</p>
                      <p>Your conversations become part of your searchable personal knowledge graph</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Import Results - Handle both streaming and non-streaming imports */
          <div className="space-y-6">
            {/* Show progress component for streaming imports */}
            {importResult.streaming && importProgress && (
              <ImportProgressComponent
                progress={importProgress}
                fileName={file?.name || 'Unknown file'}
              />
            )}

            {/* Show traditional results for non-streaming imports or streaming completion */}
            {(!importResult.streaming || (importProgress?.status === 'completed' || importProgress?.status === 'error')) && (
              <Card>
                <CardHeader>
                  <CardTitle className={importResult.success ? 'text-green-700' : 'text-red-700'}>
                    {importResult.success ? 
                      (importResult.streaming ? '🎉 Large File Import Complete!' : '🎉 Import Completed!') : 
                      '❌ Import Failed'}
                  </CardTitle>
                  <CardDescription>
                    {importResult.message}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {importResult.success ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {importProgress?.importedItems || importResult.data?.imported || 0}
                          </div>
                          <div className="text-sm text-green-800">Items Imported</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {importProgress?.totalConversations || importResult.data?.preview?.conversationCount || 0}
                          </div>
                          <div className="text-sm text-blue-800">Conversations Processed</div>
                        </div>
                      </div>
                      
                      {((importProgress?.errors && importProgress.errors.length > 0) || 
                        (importResult.data?.errors && importResult.data.errors > 0)) && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            {importProgress?.errors.length || importResult.data?.errors || 0} items had processing errors but were still imported
                          </p>
                        </div>
                      )}

                      <div className="text-center">
                        {!importResult.streaming && (
                          <p className="text-sm text-gray-600 mb-4">
                            Redirecting to dashboard in a few seconds...
                          </p>
                        )}
                        <Button asChild>
                          <Link href="/dashboard">Go to Dashboard Now</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {((importResult.errors && importResult.errors.length > 0) || 
                        (importProgress?.errors && importProgress.errors.length > 0)) && (
                        <div className="space-y-2">
                          <p className="font-medium text-gray-900">Errors encountered:</p>
                          <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                            {(importResult.errors || importProgress?.errors || []).map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={() => {
                          setImportResult(null);
                          setImportProgress(null);
                          setFile(null);
                          setValidationResult(null);
                          setIsPollingProgress(false);
                        }}>
                          Try Again
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/dashboard">Return to Dashboard</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Loading state for streaming imports without progress yet */}
            {importResult.streaming && !importProgress && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Starting Large File Import...</h3>
                    <p className="text-gray-600">
                      Your large file is being processed. This may take a few moments to begin.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}