import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const { companyName, slug, personName, personRole, linkedinInfo, extraContext, language } = await req.json()
    const { data: existing } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).single()
    if (existing) return NextResponse.json({ error: 'See slug on juba kasutusel' }, { status: 400 })
    const webPrompt = language === 'et'
      ? `Otsi infot ettevõtte "${companyName}" kohta. Kirjelda lühidalt (3-5 lauset): valdkond, suurus, põhitegevus, turupositsioon. Kui infot pole, kirjuta "Infot ei leitud".`
      : `Research company "${companyName}". Briefly describe (3-5 sentences): industry, size, main activities, market position. If not found, write "No information found".`
    const webRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: webPrompt }] })
    const webResearchText = webRes.content[0].type === 'text' ? webRes.content[0].text : ''
    const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({ slug, company_name: companyName, person_name: personName, person_role: personRole, linkedin_info: linkedinInfo, extra_context: extraContext, language, web_research: webResearchText, status: 'pending' }).select().single()
    if (companyError) throw companyError
    const qPrompt = language === 'et'
      ? `Sa oled knowledge transfer ekspert. Genereeri 8 kalibreerimisvküsimust esimeseks sessiooniks.

Intervjueeritav: ${personName}, ${personRole}
Ettevõte: ${companyName}
Ettevõtte info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'pole'}
Lisainfo: ${extraContext || 'pole'}

EESMÄRK: Esimene sessioon on kalibreerimiseks — tahame mõista KES see inimene on, KUIDAS ta mõtleb ja töötab, mitte ainult mida ta teab.

KÜSIMUSTE STRUKTUUR:
- Küsimused 1-2: Isiklik taust ja motivatsioon. Miks ta tegi valikuid mida tegi? Mis teda ajendab?
- Küsimused 3-4: Tööstiil ja iseloom. Kuidas ta teeb otsuseid? Kuidas meeldib infot jagada — rääkides või kirjutades? Kuidas ta töötab surve all?
- Küsimused 5-6: Ettevõte ja roll. Mis on tema käes mida keegi teine ei tea? Mis on tema kõige suurem saavutus?
- Küsimused 7-8: Sügavam mõtlemine. Mis on tema nägemus tulevikust? Mida ta soovib et järgmine inimene tema kogemusest säilitaks?

REEGLID:
- Küsimused on avatud — ei saa vastata jah/ei
- Küsimused on konkreetsed ja isiklikud, mitte üldised
- Küsimused kutsuvad esile lugusid ja näiteid, mitte faktide loetelu
- Eesti keeles, lühikesed (1 lause)
- Personaliseeri ${personName} rolli ja valdkonna põhjal

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `You are a knowledge transfer expert. Generate 8 calibration questions for the first session.

Interviewee: ${personName}, ${personRole}
Company: ${companyName}
Company info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'none'}
Extra context: ${extraContext || 'none'}

PURPOSE: First session is calibration — we want to understand WHO this person is, HOW they think and work, not just what they know.

QUESTION STRUCTURE:
- Questions 1-2: Personal background and motivation. Why did they make the choices they made? What drives them?
- Questions 3-4: Work style and character. How do they make decisions? Do they prefer sharing knowledge by talking or writing? How do they work under pressure?
- Questions 5-6: Company and role. What do they know that nobody else does? What is their biggest achievement?
- Questions 7-8: Deeper thinking. What is their vision for the future? What do they want the next person to preserve from their experience?

RULES:
- Questions are open — cannot be answered yes/no
- Questions are specific and personal, not generic
- Questions invite stories and examples, not lists of facts
- English, short (1 sentence each)
- Personalize based on ${personName}'s role and field

Respond JSON: {"questions": ["question 1", ...]}`

    const qRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: qPrompt }] })
    const qText = qRes.content[0].type === 'text' ? qRes.content[0].text : '{}'
    const { questions } = JSON.parse(qText.replace(/```json|```/g, '').trim())
    await supabaseAdmin.from('questions').insert(questions.map((q: string, i: number) => ({ company_id: company.id, session_number: 1, question_order: i + 1, question_text: q })))
    return NextResponse.json({ success: true, slug, companyId: company.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Viga' }, { status: 500 })
  }
}