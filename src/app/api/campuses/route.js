import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toIlikeSearchPattern } from '@/lib/params';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchPattern = toIlikeSearchPattern(searchParams.get('q'));

    let sql = `SELECT id, name, short_name, city, province FROM campuses`;
    const params = [];

    if (searchPattern) {
      sql += ` WHERE name ILIKE $1 ESCAPE '\\' OR short_name ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR province ILIKE $1 ESCAPE '\\'`;
      params.push(searchPattern);
    }

    sql += ` ORDER BY name ASC`;

    const result = await query(sql, params);
    return NextResponse.json({ campuses: result.rows });
  } catch (error) {
    console.error('Error fetching campuses:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar kampus' },
      { status: 500 }
    );
  }
}
