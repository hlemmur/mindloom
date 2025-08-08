import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    const result = await query('SELECT NOW() as current_time, version() as db_version');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.code || 'Unknown error',
    }, { status: 500 });
  }
}