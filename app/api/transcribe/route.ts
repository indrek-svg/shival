import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const companyId = formData.get('companyId') as string
    const questionId = formData.get('questionId') as string
    const sessionNumber = parseInt(formData.get('sessionNumber') as string) || 1
    const language = formData.get('language') as string || 'et'
    const isFreeRecording = formData.get('freeRecording') === 'true'
    if (!audioFile) return NextResponse.json({ error: 'Audio fail puudub' }, { status: 400 })
    const transcription = await openai.audio.transcriptions.create({ file: audioFile, model: 'whisper-1', language: language === 'et' ? 'et' : 'en' })
    let finalTranscript = transcription.text
    if (isFreeRecording && transcription.text.length > 100) {
      const cleanPrompt = language === 'et'
        ? `Sa oled intervjuu analüütik. Sinu ülesanne on rikastada transkripti — mitte kustutada, vaid kategoriseerida ja lisada psühholoogilisi tähelepanekuid.

KATEGORISEERI tekst kolme sektsiooni:

**[INTERVJUU SISU]**
Kõik mis puudutab tööd, rolli, ettevõtet, teadmisi, kogemusi, protsesse, meeskonda, strateegiaid. Kirjuta puhtalt ja selgelt, eemalda ainult täitesõnad ("ee", "noh", "nii-öelda").

**[ISELOOMUINFO]**
Psühholoogilised tähelepanekud vastuste põhjal:
- Kus ta vastas kohe ja enesekindlalt vs kus kõhkles või pehmendas
- Mida ta ise spontaanselt tõstatas ilma et küsiti
- Kuidas ta räägib — lühidalt/pikalt, konkreetselt/üldiselt, näidetega/abstraktselt
- Mis teemal ta naeratas, naeratas, muutus tõsisemaks
- Mis teemasid ta vältas või muutis kiiresti
- Kehakeel sõnades (kui mainis)

**[VASTUOLUD JA TÄHELEPANEKUD]**
- Kus ta ütles eri kohtades vastupidist
- Mida ta EI öelnud kuigi küsimus seda eeldas (nt küsiti meeskonnast, rääkis ainult iseendast)
- Mis jäi poolikuks või ebaselgeks
- Mis tekitas küsimusi

**[KÕRVALINE — välja jäetud]**
Lühike loetelu mis eemaldati ja miks (nt "2 min jutt ühisest tuttavast — ei ole tööga seotud")

REEGLID:
- Ära muuda sisu — ainult organiseeri ja lisa tähelepanekud
- Tähelepanekud peavad põhinema transkriptil, mitte oletustel
- Kui midagi pole selge — märgi küsimusena

Transkript:
${transcription.text}

Tagasta struktureeritud analüüs.`
        : `You are an interview analyst. Your task is to enrich the transcript — not delete, but categorize and add psychological observations.

CATEGORIZE text into four sections:

**[INTERVIEW CONTENT]**
Everything about work, role, company, knowledge, experience, processes, team, strategies. Write clearly, remove only filler words ("um", "uh", "you know").

**[CHARACTER INSIGHTS]**
Psychological observations based on answers:
- Where they answered immediately and confidently vs where they hesitated or softened
- What they spontaneously raised without being asked
- How they speak — briefly/at length, concretely/generally, with examples/abstractly
- What topics made them smile, laugh, become more serious
- What topics they avoided or quickly changed
- Body language in words (if mentioned)

**[CONTRADICTIONS AND OBSERVATIONS]**
- Where they said opposite things in different parts
- What they did NOT say even though the question implied it (e.g. asked about team, only talked about themselves)
- What remained incomplete or unclear
- What raised questions

**[OFF-TOPIC — removed]**
Brief list of what was removed and why (e.g. "2 min talk about mutual acquaintance — not work related")

RULES:
- Do not change content — only organize and add observations
- Observations must be based on transcript, not assumptions
- If something is unclear — mark it as a question

Transcript:
${transcription.text}

Return structured analysis.`

      const cleanRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: cleanPrompt }] })
      finalTranscript = cleanRes.content[0].type === 'text' ? cleanRes.content[0].text : transcription.text
    }
    await supabaseAdmin.from('answers').insert({ company_id: companyId, question_id: questionId, session_number: sessionNumber, transcript: finalTranscript })
    await supabaseAdmin.from('companies').update({ status: 'interview_started' }).eq('id', companyId)
    return NextResponse.json({ transcript: finalTranscript })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}