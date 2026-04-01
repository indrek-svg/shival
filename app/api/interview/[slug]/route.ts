import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !company) {
    return NextResponse.json({ error: 'Intervjuud ei leitud' }, { status: 404 })
  }

  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('company_id', company.id)
    .order('session_number')
    .order('question_order')

  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('executive_summary')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    company,
    questions: questions || [],
    report: report?.executive_summary || null
  })
}