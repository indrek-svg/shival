import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json([])
  
  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at')

  if (!reports) return NextResponse.json([])

  const reportsWithTranscripts = await Promise.all(
    reports.map(async (report) => {
      const { data: questions } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('company_id', companyId)
        .eq('session_number', report.session_number)
        .order('question_order')

      const { data: answers } = await supabaseAdmin
        .from('answers')
        .select('*')
        .eq('company_id', companyId)
        .eq('session_number', report.session_number)

      const transcript = questions?.map(q => {
        const answer = answers?.find(a => a.question_id === q.id)
        return `KÜSIMUS: ${q.question_text}\nVASTUS: ${answer?.transcript || 'Vastus puudub'}`
      }).join('\n\n') || ''

      return { ...report, transcript }
    })
  )

  return NextResponse.json(reportsWithTranscripts)
}