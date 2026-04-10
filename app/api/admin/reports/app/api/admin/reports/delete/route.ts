import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export async function DELETE(req: NextRequest) {
  const { companyId, sessionNumber } = await req.json()
  await supabaseAdmin.from('reports').delete().eq('company_id', companyId).eq('session_number', sessionNumber)
  return NextResponse.json({ success: true })
}