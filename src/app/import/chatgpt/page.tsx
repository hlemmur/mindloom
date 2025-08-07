'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface ImportResult {
  success: boolean;
  data?: {
    sourceId: string;
    imported: number;
    errors: number;
    preview?: any;
  };
  errors?: string[];
  message?: string;
}

export default function ChatGPTImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

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
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceName', sourceName || 'ChatGPT Import');

      const response = await fetch('/api/import/chatgpt', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        errors: ['Failed to import data'],
      });
    } finally {
      setIsUploading(false);
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
        {!importResult ? (
          <div className="space-y-6">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>📋 How to Export Your ChatGPT Data</CardTitle>
                <CardDescription>Follow these steps to get your conversation data from OpenAI</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>Go to <a href="https://platform.openai.com/account" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Account Settings</a></li>
                  <li>Navigate to the "Data Export" section</li>
                  <li>Request an export of your ChatGPT conversation data</li>
                  <li>Wait for the export email (this can take up to 30 days)</li>
                  <li>Download the ZIP file and extract the JSON file(s)</li>
                  <li>Upload the conversation JSON file below</li>
                </ol>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> OpenAI exports can contain multiple JSON files. Upload the one labeled "conversations.json" or similar.
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
                            <p>Found {validationResult.data.conversationCount} conversation(s)</p>
                            <p>Format: {validationResult.data.format}</p>
                            {validationResult.data.firstTitle && (
                              <p>First conversation: "{validationResult.data.firstTitle}"</p>
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
          /* Import Results */
          <Card>
            <CardHeader>
              <CardTitle className={importResult.success ? 'text-green-700' : 'text-red-700'}>
                {importResult.success ? '🎉 Import Completed!' : '❌ Import Failed'}
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
                      <div className="text-2xl font-bold text-green-600">{importResult.data?.imported || 0}</div>
                      <div className="text-sm text-green-800">Items Imported</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{importResult.data?.preview?.conversationCount || 0}</div>
                      <div className="text-sm text-blue-800">Conversations Processed</div>
                    </div>
                  </div>
                  
                  {importResult.data?.errors && importResult.data.errors > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {importResult.data.errors} items had processing errors but were still imported
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-4">
                      Redirecting to dashboard in a few seconds...
                    </p>
                    <Button asChild>
                      <Link href="/dashboard">Go to Dashboard Now</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900">Errors encountered:</p>
                      <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      setImportResult(null);
                      setFile(null);
                      setValidationResult(null);
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
      </div>
    </div>
  );
}