import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await req.json()
    if (!companyId) return NextResponse.json({ error: 'companyId puudub' }, { status: 400 })
    await supabaseAdmin.from('answers').delete().eq('company_id', companyId)
    await supabaseAdmin.from('reports').delete().eq('company_id', companyId)
    await supabaseAdmin.from('questions').delete().eq('company_id', companyId)
    await supabaseAdmin.from('companies').delete().eq('id', companyId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}