'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent mb-6">
            MindLoom
          </h1>
          <p className="text-2xl text-gray-700 mb-4">
            AI-Powered Personal Knowledge Management
          </p>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Intelligently consolidate, organize, and synthesize your personal data from multiple sources 
            into a unified, searchable, and actionable knowledge base.
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-4">
            <Link href="/auth/signin">Get Started</Link>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🧠 Intelligent Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                AI analyzes and processes every piece of data during import, extracting emotions, topics, 
                entities, and relationships automatically.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 Semantic Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Vector-based search with semantic understanding finds relevant information even when 
                you don't remember the exact words.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                💬 ChatGPT Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Import and analyze your ChatGPT conversations to unlock insights from your AI interactions 
                and track your learning journey.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏷️ Smart Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic tagging, categorization, and relationship mapping creates an organized 
                knowledge graph from your unstructured data.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Insight Generation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                AI synthesizes patterns across your data to generate actionable insights and 
                help you understand trends in your thinking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔐 Privacy First
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Your data stays secure with encrypted storage and no third-party sharing. 
                You maintain full control over your personal information.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-2xl shadow-lg p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Transform Your Personal Data into Knowledge
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join the future of personal knowledge management. Start organizing and understanding 
            your digital life with AI-powered insights.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/auth/signin">Start Free</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
