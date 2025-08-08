import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    console.log('Testing network connectivity...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    // Test different connection formats
    const testUrls = [
      process.env.DATABASE_URL,
      'postgresql://postgres:nemdob-cozhe0-viNsoh@db.cyxefcyyrjhvizofrsyc.supabase.co:5432/postgres?sslmode=require',
      'postgresql://postgres:nemdob-cozhe0-viNsoh@db.cyxefcyyrjhvizofrsyc.supabase.co:5432/postgres?sslmode=disable',
      'postgresql://postgres.cyxefcyyrjhvizofrsyc:nemdob-cozhe0-viNsoh@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
    ];

    const results = [];

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      if (!url) continue;

      try {
        console.log(`Testing URL ${i + 1}: ${url.substring(0, 50)}...`);
        
        const pool = new Pool({
          connectionString: url,
          connectionTimeoutMillis: 5000, // 5 second timeout
          max: 1, // single connection
        });

        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        client.release();
        await pool.end();

        results.push({
          url: `URL ${i + 1}`,
          success: true,
          result: result.rows[0],
        });

        // If one works, we can stop
        break;

      } catch (error) {
        results.push({
          url: `URL ${i + 1}`,
          success: false,
          error: error.message,
          code: error.code,
        });
      }
    }

    return NextResponse.json({
      success: results.some(r => r.success),
      results,
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION,
    });

  } catch (error) {
    console.error('Network test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}