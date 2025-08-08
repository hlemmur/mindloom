'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ProcessingStatus } from '@/components/processing-status';
import { KnowledgeItem, DataSource } from '@/lib/types';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalSources: 0,
    processingItems: 0,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadDashboardData();
    }
  }, [status]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load recent knowledge items
      const itemsResponse = await fetch('/api/knowledge-items?limit=10');
      if (itemsResponse.ok) {
        const itemsResult = await itemsResponse.json();
        setKnowledgeItems(itemsResult.data?.items || []);
        setStats(prev => ({ ...prev, totalItems: itemsResult.data?.total || 0 }));
      }

      // Load data sources
      const sourcesResponse = await fetch('/api/data-sources');
      if (sourcesResponse.ok) {
        const sourcesResult = await sourcesResponse.json();
        const sources = sourcesResult.data || [];
        setDataSources(sources);
        setStats(prev => ({
          ...prev,
          totalSources: sources.length,
          processingItems: sources.filter((s: DataSource) => s.sync_status === 'syncing').length,
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch('/api/knowledge-items/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setKnowledgeItems(result.data?.items || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">MindLoom Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {session?.user?.name || session?.user?.email}
              </span>
              <Button variant="outline" onClick={() => signOut({ callbackUrl: '/' })}>
                Logout
              </Button>
              <Button variant="outline" onClick={() => router.push('/import')}>
                Import Data
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalItems}</div>
              <p className="text-sm text-gray-500">Knowledge items stored</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Data Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.totalSources}</div>
              <p className="text-sm text-gray-500">Connected sources</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.processingItems}</div>
              <p className="text-sm text-gray-500">Items being processed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle>Search Your Knowledge</CardTitle>
                <CardDescription>
                  Use semantic search to find information across all your imported data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    placeholder="What would you like to find?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit">Search</Button>
                </form>
              </CardContent>
            </Card>

            {/* Recent Items */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Knowledge Items</CardTitle>
                <CardDescription>
                  {searchQuery ? `Search results for "${searchQuery}"` : 'Your latest imported content'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {knowledgeItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="mb-4">
                      {searchQuery ? 'No results found' : 'No knowledge items yet'}
                    </p>
                    {!searchQuery && (
                      <Button asChild>
                        <Link href="/import">Import Your First Data Source</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {knowledgeItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 mb-1">
                              {item.title || 'Untitled'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {item.content.slice(0, 200)}
                              {item.content.length > 200 && '...'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                              {item.categories && item.categories.length > 0 && (
                                <div className="flex gap-1">
                                  {item.categories.slice(0, 3).map((category, i) => (
                                    <span
                                      key={i}
                                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded"
                                    >
                                      {category}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className={`w-2 h-2 rounded-full ${
                              item.processing_status === 'completed' ? 'bg-green-500' :
                              item.processing_status === 'processing' ? 'bg-yellow-500' :
                              item.processing_status === 'error' ? 'bg-red-500' :
                              'bg-gray-400'
                            }`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Data Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {dataSources.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">No data sources connected</p>
                    <Button asChild size="sm" className="w-full">
                      <Link href="/import">Connect First Source</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dataSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {source.source_name || source.source_type.toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {source.source_type}
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          source.sync_status === 'completed' ? 'bg-green-500' :
                          source.sync_status === 'syncing' ? 'bg-yellow-500' :
                          source.sync_status === 'error' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                      </div>
                    ))}
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link href="/import">Add More Sources</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Status */}
            <ProcessingStatus />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href="/import/chatgpt">📄 Import ChatGPT</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href="/search">🔍 Advanced Search</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href="/insights">💡 View Insights</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}