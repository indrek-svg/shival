import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const companyId = formData.get('companyId') as string
    const questionId = formData.get('questionId') as string
    const sessionNumber = parseInt(formData.get('sessionNumber') as string) || 1
    const language = formData.get('language') as string || 'et'
    if (!audioFile) return NextResponse.json({ error: 'Audio fail puudub' }, { status: 400 })
    const transcription = await openai.audio.transcriptions.create({ file: audioFile, model: 'whisper-1', language: language === 'et' ? 'et' : 'en' })
    await supabaseAdmin.from('answers').insert({ company_id: companyId, question_id: questionId, session_number: sessionNumber, transcript: transcription.text })
    await supabaseAdmin.from('companies').update({ status: 'interview_started' }).eq('id', companyId)
    return NextResponse.json({ transcript: transcription.text })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
