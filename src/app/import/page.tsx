'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function ImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import Data Sources</h1>
              <p className="text-sm text-gray-600 mt-1">
                Connect and import your personal data to start building your knowledge base
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Import Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* ChatGPT Import */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  💬
                </div>
                ChatGPT Conversations
              </CardTitle>
              <CardDescription>
                Import your ChatGPT conversation history to analyze your AI interactions and extract insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                   <strong>What you&apos;ll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Conversation analysis and categorization</li>
                    <li>Topic and entity extraction</li>
                    <li>Question and insight identification</li>
                    <li>Searchable conversation history</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>Required:</strong> Export your ChatGPT data from OpenAI and upload the JSON file
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href="/import/chatgpt">Import ChatGPT Data</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Personal Notes */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  📝
                </div>
                Personal Notes
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
              </CardTitle>
              <CardDescription>
                Import notes from Notion, Obsidian, markdown files, or plain text documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                  <strong>What you'll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Note organization and tagging</li>
                    <li>Cross-note relationship mapping</li>
                    <li>Content summarization</li>
                    <li>Idea and concept extraction</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                   <strong>Supported:</strong> Markdown, TXT, Notion exports, Obsidian vaults
                </div>
              </div>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Email Data */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  📧
                </div>
                Email Archive
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
              </CardTitle>
              <CardDescription>
                Import and analyze your email history to extract important conversations and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                   <strong>What you&apos;ll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Contact and relationship mapping</li>
                    <li>Important email identification</li>
                    <li>Topic and project tracking</li>
                    <li>Communication pattern analysis</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                   <strong>Supported:</strong> Gmail, Outlook, MBOX exports
                </div>
              </div>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Health Data */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  🏥
                </div>
                Health Data
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
              </CardTitle>
              <CardDescription>
                Import health and wellness data to understand patterns in your physical and mental health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                   <strong>What you&apos;ll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Health trend analysis</li>
                    <li>Mood and energy correlations</li>
                    <li>Activity and sleep patterns</li>
                    <li>Health goal tracking</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                   <strong>Supported:</strong> Apple Health, Google Fit, fitness apps
                </div>
              </div>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  📱
                </div>
                Social Media
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
              </CardTitle>
              <CardDescription>
                Import your social media posts and interactions to understand your digital social patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                   <strong>What you&apos;ll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Content theme analysis</li>
                    <li>Engagement pattern insights</li>
                    <li>Interest evolution tracking</li>
                    <li>Social network mapping</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>Supported:</strong> Twitter, LinkedIn, Instagram exports
                </div>
              </div>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Custom API */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  🔌
                </div>
                Custom API
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
              </CardTitle>
              <CardDescription>
                Connect custom data sources through API integrations or webhook endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="text-sm text-gray-600">
                  <strong>What you'll get:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Real-time data synchronization</li>
                    <li>Custom data format support</li>
                    <li>Automated import scheduling</li>
                    <li>Developer-friendly integration</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                   <strong>Features:</strong> REST APIs, webhooks, custom schemas
                </div>
              </div>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <div className="mt-12 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Need Help Getting Started?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📚 Getting Your Data</h3>
              <p className="text-sm text-gray-600 mb-3">
                Most platforms offer data export features. We'll walk you through the process for each supported platform.
              </p>
              <Button variant="outline" size="sm">View Export Guides</Button>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">🔒 Privacy & Security</h3>
              <p className="text-sm text-gray-600 mb-3">
                Your data is encrypted and stored securely. We never share your personal information with third parties.
              </p>
              <Button variant="outline" size="sm">Learn About Security</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}