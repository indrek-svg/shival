import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const { companyName, slug, personName, personRole, linkedinInfo, extraContext, language, department, specialization, yearsInRole, personalityNotes, interviewContext } = await req.json()
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
Roll: ${personRole}${department ? `\nOsakond: ${department}` : ''}${specialization ? `\nSpetsialiseerumine: ${specialization}` : ''}${yearsInRole ? `\nAega rollis: ${yearsInRole} aastat` : ''}${personalityNotes ? `\nIseloom ja käitumine: ${personalityNotes}` : ''}${interviewContext ? `\nIntervjuu kontekst: ${interviewContext}` : ''}
Ettevõte: ${companyName}
Ettevõtte info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'pole'}
Lisainfo: ${extraContext || 'pole'}`
      : `Interviewee: ${personName}
Role: ${personRole}${department ? `\nDepartment: ${department}` : ''}${specialization ? `\nSpecialization: ${specialization}` : ''}${yearsInRole ? `\nYears in role: ${yearsInRole}` : ''}${personalityNotes ? `\nPersonality and behavior: ${personalityNotes}` : ''}${interviewContext ? `\nInterview context: ${interviewContext}` : ''}
Company: ${companyName}
Company info: ${webResearchText}
LinkedIn: ${linkedinInfo || 'none'}
Extra context: ${extraContext || 'none'}`

    const qPrompt = language === 'et'
      ? `Sa oled maailmatasemel knowledge transfer ekspert. Sinu küsimused ühendavad Chris Vossi kalibreeritud küsimuste tehnika, Edgar Scheini Humble Inquiry meetodi ja organisatsioonipsühholoogia parima praktika.

${contextBlock}

INTERVJUU EESMÄRK (interim juhi vaade):
Interim juht läheb ettevõttesse ja peab kiiresti mõistma: kes on tegelikult asendamatud, mis töö on kellegi käes mida keegi teine ei tea, kus on peidetud väärtus ja kus on raiskamine. See ei ole tavaline HR intervjuu — see on strateegiline teadmiste kaardistamine.

ESIMENE SESSIOON — tähistamise intervjuu:
Inimene peab tundma end turvaliselt ja väärtustatult. Küsimused peavad olema inimlikud ja avatud — mitte ülekuulamine. Eesmärk on luua usaldus ja saada inimene rääkima vabalt.

KÜSIMUSTE STRUKTUUR (10 küsimust):

Küsimus 1 — Jäämurdja (soe, isiklik, lihtne):
Küsi midagi mis paneb inimese muigama ja end mugavalt tundma. Näiteks mis talle selle töö juures meeldib, mis teda hommikul üles ajab, või mis on olnud kõige põnevam projekt. Personaliseeri ${personRole} ja ${companyName} põhjal. EI TOHI olla kohe tehniline või survestav.

Küsimused 2-3 — Tööstiil ja iseloom:
Küsi KUIDAS ta töötab, mitte MIDA ta teeb. Näiteks kuidas ta eelistab infot jagada, kuidas ta töötab surve all, mis talle energiat annab. Arvesta iseloomuinfoga kui on olemas.

Küsimused 4-5 — Tegelik töö ja asendamatus:
Too välja päris töö, mitte ametinimetus. Küsi: mis ta teeb mida keegi teine ei tee, räägi olukorrast kus keegi tuli tema juurde probleemiga mida ainult tema oskas lahendada, mis jääks tegemata kui ta homme lahkuks.

Küsimused 6-7 — Mõttetu töö ja delegeerimine:
Too välja raiskamine ja halb tööjaotus. Küsi: mis on töös mida ta teeb aga mis ei ole tema parim kasutus, mis võiks keegi teine teha, mis protsess vajaks tema hinnangul muutmist.

Küsimus 8 — Kasutamata tugevused:
Kus tunneb ta et tema oskusi ei kasutata piisavalt? Mis valdkonnas looks ta rohkem väärtust kui praeguses rollis?

Küsimused 9-10 — Tulevik ja pärand:
Mis on tema visioon ettevõtte jaoks? Mida ta tahab et järgmine inimene tema kogemusest säilitaks? Mis on see üks asi mida ta soovib oleks teistmoodi?

GRAMMATIKA JA STIILI REEGLID:
- Kõik küsimused algavad "Kuidas", "Mis", "Räägi mulle" — mitte kunagi "Kas" või "Kes"
- Kasuta õiget eesti keele grammatikat — käänded, eessõnad ja asesõnad peavad olema õiged
- "juurde" mitte "juures" kui räägid kellegi poole pöördumisest
- Iga küsimus kutsub esile loo või konkreetse näite, mitte fakti
- Küsimused on lühikesed (1 lause), selged, eestikeelsed
- Personaliseeri KÕIK küsimused ${personName} rolli, osakonna ja tausta põhjal
- Kui iseloomuinfo on olemas — kohanda küsimuste tooni ja stiili vastavalt

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `You are a world-class knowledge transfer expert combining Chris Voss's calibrated questioning technique, Edgar Schein's Humble Inquiry method, and best practices from organizational psychology.

${contextBlock}

INTERVIEW PURPOSE (interim manager perspective):
An interim manager enters a company and needs to quickly understand: who is truly indispensable, what work is held by whom that nobody else knows, where is hidden value and where is waste. This is not a standard HR interview — it is strategic knowledge mapping.

FIRST SESSION — celebration interview:
The person must feel safe and valued. Questions must be human and open — not an interrogation. The goal is to build trust and get the person talking freely.

QUESTION STRUCTURE (10 questions):

Question 1 — Icebreaker (warm, personal, simple):
Ask something that makes them smile and feel comfortable. Personalize based on ${personRole} and ${companyName}. Must NOT be immediately technical or pressuring.

Questions 2-3 — Work style and character:
Ask HOW they work, not WHAT they do. Consider personality notes if available.

Questions 4-5 — Real work and indispensability:
Surface real work, not job title. Ask: what they do that nobody else does, tell me about a time someone came to them with a problem only they could solve, what would be left undone if they left tomorrow.

Questions 6-7 — Meaningless work and delegation:
Surface waste and poor work distribution. Ask: what they do that isn't their best use, what someone else could do, what process they think needs changing.

Question 8 — Untapped strengths:
Where do they feel their skills are underused? What area would they create more value in?

Questions 9-10 — Future and legacy:
What is their vision for the company? What do they want the next person to preserve? What one thing do they wish had been different?

GRAMMAR AND STYLE RULES:
- All questions start with "How", "What", "Tell me" — never "Do you", "Did you", or "Who"
- Every question invites a story or specific example, not a fact
- Questions are short (1 sentence), clear, in English
- Personalize ALL questions based on ${personName}'s role, department and background
- If personality notes exist — adapt tone and style accordingly

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