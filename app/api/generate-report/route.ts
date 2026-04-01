import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const { companyId, sessionNumber } = await req.json()
    const { data: company } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).single()
    if (!company) throw new Error('Ettevõtet ei leitud')
    const { data: questions } = await supabaseAdmin.from('questions').select('*').eq('company_id', companyId).eq('session_number', sessionNumber).order('question_order')
    const { data: answers } = await supabaseAdmin.from('answers').select('*').eq('company_id', companyId).eq('session_number', sessionNumber)
    const qaPairs = questions?.map(q => { const a = answers?.find(a => a.question_id === q.id); return `KÜSIMUS: ${q.question_text}\nVASTUS: ${a?.transcript || 'Vastus puudub'}` }).join('\n\n') || ''
    const lang = company.language
    const summaryPrompt = lang === 'et'
      ? `Sa oled knowledge transfer spetsialist. Sinu ülesanne on teha professionaalne kokkuvõte intervjuust.

REEGLID:
1. Puhasta kõnevead ja kordused — kirjuta selge eesti keeles
2. Iga vastuse kohta tee sisuline kokkuvõte (2-4 lauset) — mitte kopeeri transkripti
3. Kui vastus puudub — kirjuta "Ei käsitletud"
4. EI TOHI lisada asju mida inimene EI öelnud
5. "Mida järgmises sessioonis uurida" — ainult teemad mis tulid jutus üles aga jäid pinnapealseks
6. EI TOHI välja mõelda soovitusi, skoore ega hinnanguid

Intervjueeritav: ${company.person_name}, ${company.person_role}
Ettevõte: ${company.company_name}
Sessioon: ${sessionNumber}

INTERVJUU:
${qaPairs}

LOO RAPORT selles formaadis:

## Knowledge Transfer Raport
**Intervjueeritav:** ${company.person_name}, ${company.person_role}
**Ettevõte:** ${company.company_name}
**Sessioon:** ${sessionNumber}

---

### Kokkuvõte
[3-5 lauset: kes on see inimene, mis on tema roll, mis olid sessiooni peateemad. Ainult faktid.]

---

### Vastused küsimuste kaupa

[Iga küsimuse kohta:]
**[Küsimus]**
[Sisuline kokkuvõte 2-4 lausega. Puhasta kõnevead. Kirjuta mida ta sisuliselt ütles, mitte kopeeri sõna-sõnalt.]

---

### Peamised teemad mis tulid välja
[3-5 punkti — mis olid kõige olulisemad asjad mida ta mainis]

---

### Mis jäi katmata
[Teemad millele vastus puudus või oli liiga lühike. Ainult loetelu.]

---

### Mida järgmises sessioonis uurida
[Teemad mis tulid jutus üles aga jäid pinnapealseks — nende põhjal mida ta ütles. Mitte välja mõeldud soovitused.]`
      : `You are a knowledge transfer specialist. Create a professional summary of this interview.

RULES:
1. Clean up speech errors and repetitions — write clear English
2. For each answer write a substantive summary (2-4 sentences) — do not copy the transcript
3. If answer missing — write "Not covered"
4. DO NOT add things the person did NOT say
5. "What to explore next" — only topics that came up but stayed superficial
6. DO NOT invent recommendations, scores or judgments

Interviewee: ${company.person_name}, ${company.person_role}
Company: ${company.company_name}
Session: ${sessionNumber}

INTERVIEW:
${qaPairs}

CREATE REPORT in this format:

## Knowledge Transfer Report
**Interviewee:** ${company.person_name}, ${company.person_role}
**Company:** ${company.company_name}
**Session:** ${sessionNumber}

---

### Overview
[3-5 sentences: who is this person, their role, what were the main topics. Facts only.]

---

### Answers by Question

**[Question]**
[Substantive summary 2-4 sentences. Clean up speech errors. Write what they meant, not a word-for-word copy.]

---

### Key Themes That Emerged
[3-5 points — most important things they mentioned]

---

### What Was Not Covered
[Topics with no or very brief answers. List only.]

---

### What to Explore in Next Session
[Topics that came up but stayed superficial — based on what they said. No invented recommendations.]`

    const summaryRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: summaryPrompt }] })
    const executiveSummary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''
    await supabaseAdmin.from('reports').insert({ company_id: companyId, session_number: sessionNumber, executive_summary: executiveSummary })
    const nextPrompt = lang === 'et'
      ? `Loo 15 süvaintervjuu küsimust teiseks sessiooniks ${company.person_name} jaoks (${company.person_role}, ${company.company_name}).

Esimese sessiooni vastused:
${qaPairs}

REEGLID:
- Küsimused peavad põhinema sellel mida ta ÜTLES — mine sügavamale nendesse teemadesse
- Personaliseeri tema konkreetse rolli ja vastuste põhjal
- EI TOHI küsida asju mida ta juba täielikult kattis
- Teemad: kliendisuhted, meeskond, otsused, strateegia, kirjutamata reeglid
- Eesti keeles, lühikesed ja konkreetsed

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `Create 15 deep-dive questions for session 2 with ${company.person_name} (${company.person_role}, ${company.company_name}).

First session answers:
${qaPairs}

RULES:
- Build on what they SAID — go deeper into those specific topics
- Personalize based on their specific answers
- DO NOT ask about things already covered fully
- Topics: client relationships, team, decisions, strategy, unwritten rules
- English, short and specific

Respond JSON: {"questions": ["question 1", ...]}`

    const nextRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: nextPrompt }] })
    const nextText = nextRes.content[0].type === 'text' ? nextRes.content[0].text : '{}'
    const { questions: nextQs } = JSON.parse(nextText.replace(/```json|```/g, '').trim())
    await supabaseAdmin.from('questions').insert(nextQs.map((q: string, i: number) => ({ company_id: companyId, session_number: 2, question_order: i + 1, question_text: q })))
    await supabaseAdmin.from('companies').update({ status: 'report_ready' }).eq('id', companyId)
    return NextResponse.json({ success: true, executiveSummary })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}