import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json([])
  const { data } = await supabaseAdmin.from('reports').select('*').eq('company_id', companyId).order('created_at')
  return NextResponse.json(data || [])
}