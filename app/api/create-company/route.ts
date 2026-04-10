import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const { companyName, slug, personName, personRole, linkedinInfo, extraContext, language, department, specialization, yearsInRole } = await req.json()
    const { data: existing } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).single()
    if (existing) return NextResponse.json({ error: 'See slug on juba kasutusel' }, { status: 400 })
    const webPrompt = language === 'et'
      ? `Otsi infot ettevõtte "${companyName}" kohta. Kirjelda lühidalt (3-5 lauset): valdkond, suurus, põhitegevus, turupositsioon. Kui infot pole, kirjuta "Infot ei leitud".`
      : `Research company "${companyName}". Briefly describe (3-5 sentences): industry, size, main activities, market position. If not found, write "No information found".`
    const webRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: webPrompt }] })
    const webResearchText = webRes.content[0].type === 'text' ? webRes.content[0].text : ''
    const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({ slug, company_name: companyName, person_name: personName, person_role: personRole, linkedin_info: linkedinInfo, extra_context: extraContext, language, web_research: webResearchText, status: 'pending' }).select().single()
    if (companyError) throw companyError
    const contextBlock = language === 'et'
      ? `Intervjueeritav: ${personName}
Roll: ${personRole}${department ? `\nOsakond: ${department}` : ''}${specialization ? `\nSpetsialiseerumine: ${specialization}` : ''}${yearsInRole ? `\nAega rollis: ${yearsInRole} aastat` : ''}
Ettevõte: ${companyName}
Ettevõtte info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'pole'}
Lisainfo: ${extraContext || 'pole'}`
      : `Interviewee: ${personName}
Role: ${personRole}${department ? `\nDepartment: ${department}` : ''}${specialization ? `\nSpecialization: ${specialization}` : ''}${yearsInRole ? `\nYears in role: ${yearsInRole}` : ''}
Company: ${companyName}
Company info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'none'}
Extra context: ${extraContext || 'none'}`

    const qPrompt = language === 'et'
      ? `Sa oled maailmatasemel knowledge transfer ekspert, kelle küsimused ühendavad Chris Vossi kalibreeritud küsimuste tehnika, Edgar Scheini Humble Inquiry meetodi ja organisatsioonipsühholoogia parima praktika.

${contextBlock}

EESMÄRK: See on ESIMENE sessioon — tähistamise intervjuu. Inimene peab tundma end turvaliselt ja väärtustatult, mitte ülekuulatuna. Tahame mõista KES see inimene on, KUIDAS ta mõtleb, mis teda motiveerib ja kus on tema tegelik väärtus organisatsioonis.

KÜSIMUSTE STRUKTUUR (10 küsimust):

Küsimus 1 — Jäämurdja (inimlik, lihtne, avab vestluse):
Küsi midagi mis paneb inimese rääkima oma teekonnast — mitte CV faktid vaid tähenduslikud valikud. Näide tüübist: "Mis sind sellele teele tõi?" aga personaliseeri ${personRole} põhjal.

Küsimused 2-3 — Tööstiil ja iseloom:
Küsi kuidas ta töötab, mitte mida ta teeb. Näide tüübist: "Kuidas sa eelistad infot teistele edasi anda?" või "Mis sind tööl kõige rohkem energiaga laeb?" — aga konkteetsemalt tema rolli kontekstis.

Küsimused 4-5 — Tegelik töö ja väärtus:
Alari tagasiside põhjal — too välja päris töö, mitte ametinimetus. Küsi: mis ta teeb mida keegi teine ei tee, kes käib tema juurde küsimas ja miks, mis on see asi mis jääks tegemata kui ta lahkuks.

Küsimused 6-7 — Mõttetu töö ja delegeerimine:
Alari tagasiside: too välja raiskamine ja halb tööjaotus. Küsi: mis on töös mida ta teeb aga mis ei ole tema parim kasutus, mis võiks keegi teine teha, mis protsess vajaks muutmist.

Küsimus 8 — Kasutamata tugevused:
Kus tunneb ta et tema oskusi ei kasutata piisavalt? Mis valdkonnas looks ta rohkem väärtust kui praegu?

Küsimused 9-10 — Tulevik ja pärand:
Mis on tema visioon? Mida ta tahab et järgmine inimene tema kogemusest säilitaks? Mis on see üks asi mida ta soovib oleks teistmoodi?

REEGLID:
- Kõik küsimused algavad "Kuidas", "Mis", "Räägi mulle" — mitte kunagi "Kas"
- Iga küsimus kutsub esile loo või konkreetse näite, mitte fakti
- Küsimused on lühikesed (1 lause), selged, eesti keeles
- Personaliseeri KÕIK küsimused ${personName} rolli, osakonna ja tausta põhjal — mitte üldised
- Kui info puudub, kasuta ettevõtte infot ja rolli nime

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `You are a world-class knowledge transfer expert combining Chris Voss's calibrated questioning technique, Edgar Schein's Humble Inquiry method, and best practices from organizational psychology.

${contextBlock}

PURPOSE: This is the FIRST session — a celebration interview. The person must feel safe and valued, not interrogated. We want to understand WHO this person is, HOW they think, what motivates them, and where their real value lies in the organization.

QUESTION STRUCTURE (10 questions):

Question 1 — Icebreaker (human, simple, opens conversation):
Ask something that makes them talk about their journey — not CV facts but meaningful choices. Personalize based on ${personRole}.

Questions 2-3 — Work style and character:
Ask HOW they work, not WHAT they do. Personalize to their role context.

Questions 4-5 — Real work and value:
Based on interim manager feedback — surface real work, not job title. Ask: what they do that nobody else does, who comes to them for help and why, what would be left undone if they left.

Questions 6-7 — Meaningless work and delegation:
Surface waste and poor work distribution. Ask: what they do that isn't their best use, what someone else could do, what process needs changing.

Question 8 — Untapped strengths:
Where do they feel their skills are underused? What area would they create more value in than currently?

Questions 9-10 — Future and legacy:
What is their vision? What do they want the next person to preserve? What one thing do they wish had been different?

RULES:
- All questions start with "How", "What", "Tell me" — never "Do you" or "Did you"
- Every question invites a story or specific example, not a fact
- Questions are short (1 sentence), clear, in English
- Personalize ALL questions based on ${personName}'s role, department and background
- If info is missing, use company info and role name

Respond JSON: {"questions": ["question 1", ...]}`

    const qRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: qPrompt }] })
    const qText = qRes.content[0].type === 'text' ? qRes.content[0].text : '{}'
    const { questions } = JSON.parse(qText.replace(/```json|```/g, '').trim())
    await supabaseAdmin.from('questions').insert(questions.map((q: string, i: number) => ({ company_id: company.id, session_number: 1, question_order: i + 1, question_text: q })))
    return NextResponse.json({ success: true, slug, companyId: company.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Viga' }, { status: 500 })
  }
}