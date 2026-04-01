import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export async function GET() {
  const { data, error } = await supabaseAdmin.from('companies').select('id, slug, company_name, person_name, person_role, status, language, created_at').order('created_at', { ascending: false })
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data)
}
