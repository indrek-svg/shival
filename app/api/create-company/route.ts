import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST(req: NextRequest) {
  try {
    const { companyName, slug, personName, personRole, linkedinInfo, extraContext, language, department, specialization, yearsInRole, personalityNotes, interviewContext, interviewType } = await req.json()
    const { data: existing } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).single()
    if (existing) return NextResponse.json({ error: 'See slug on juba kasutusel' }, { status: 400 })
    const webPrompt = language === 'et'
      ? `Otsi infot ettevõtte "${companyName}" kohta. Kirjelda lühidalt (3-5 lauset): valdkond, suurus, põhitegevus, turupositsioon. Kui infot pole, kirjuta "Infot ei leitud".`
      : `Research company "${companyName}". Briefly describe (3-5 sentences): industry, size, main activities, market position. If not found, write "No information found".`
    const webRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: webPrompt }] })
    const webResearchText = webRes.content[0].type === 'text' ? webRes.content[0].text : ''
    const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({ slug, company_name: companyName, person_name: personName, person_role: personRole, linkedin_info: linkedinInfo, extra_context: extraContext, language, web_research: webResearchText, status: 'pending', interview_type: interviewType })
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

INTERVJUU EESMÄRK:
Eesmärk on kiiresti mõista: kes on tegelikult asendamatud, mis töö on kellegi käes mida keegi teine ei tea, kus on peidetud väärtus ja kus on raiskamine. See on strateegiline teadmiste kaardistamine.

ESIMENE SESSIOON — tähistamise intervjuu:
Inimene peab tundma end turvaliselt ja väärtustatult. Küsimused peavad olema inimlikud ja avatud — mitte ülekuulamine. Eesmärk on luua usaldus ja saada inimene rääkima vabalt.

KÜSIMUSTE STRUKTUUR (10 küsimust):

Küsimus 1 — Jäämurdja (soe, isiklik, lihtne):
Küsi midagi mis paneb inimese muigama ja end mugavalt tundma. Personaliseeri ${personRole} ja ${companyName} põhjal. EI TOHI olla kohe tehniline või survestav.

Küsimused 2-3 — Tööstiil ja iseloom:
Küsi KUIDAS ta töötab, mitte MIDA ta teeb. Arvesta iseloomuinfoga kui on olemas.

Küsimused 4-5 — Tegelik töö ja asendamatus:
Küsi: mis ta teeb mida keegi teine ei tee, räägi olukorrast kus keegi tuli tema juurde probleemiga mida ainult tema oskas lahendada, mis jääks tegemata kui ta homme lahkuks.

Küsimused 6-7 — Mõttetu töö ja delegeerimine:
Küsi: mis on töös mida ta teeb aga mis ei ole tema parim kasutus, mis võiks keegi teine teha, mis protsess vajaks tema hinnangul muutmist.

Küsimus 8 — Kasutamata tugevused:
Kus tunneb ta et tema oskusi ei kasutata piisavalt?

Küsimused 9-10 — Tulevik ja pärand:
Mis on tema visioon? Mida ta tahab et järgmine inimene tema kogemusest säilitaks?

GRAMMATIKA JA STIILI REEGLID:
- Kõik küsimused algavad "Kuidas", "Mis", "Räägi mulle" — mitte kunagi "Kas" või "Kes"
- Kasuta õiget eesti keele grammatikat — käänded, eessõnad ja asesõnad peavad olema õiged
- Iga küsimus kutsub esile loo või konkreetse näite, mitte fakti
- Küsimused on lühikesed (1 lause), selged, eestikeelsed
- Personaliseeri KÕIK küsimused ${personName} rolli, osakonna ja tausta põhjal
- Kui iseloomuinfo on olemas — kohanda küsimuste tooni ja stiili vastavalt

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `You are a world-class knowledge transfer expert combining Chris Voss's calibrated questioning technique, Edgar Schein's Humble Inquiry method, and best practices from organizational psychology.

${contextBlock}

INTERVIEW PURPOSE:
The goal is to quickly understand: who is truly indispensable, what work is held by whom that nobody else knows, where is hidden value and where is waste. This is strategic knowledge mapping.

FIRST SESSION — celebration interview:
The person must feel safe and valued. Questions must be human and open — not an interrogation. The goal is to build trust and get the person talking freely.

QUESTION STRUCTURE (10 questions):

Question 1 — Icebreaker (warm, personal, simple):
Ask something that makes them smile and feel comfortable. Personalize based on ${personRole} and ${companyName}. Must NOT be immediately technical or pressuring.

Questions 2-3 — Work style and character:
Ask HOW they work, not WHAT they do. Consider personality notes if available.

Questions 4-5 — Real work and indispensability:
Ask: what they do that nobody else does, tell me about a time someone came to them with a problem only they could solve, what would be left undone if they left tomorrow.

Questions 6-7 — Meaningless work and delegation:
Ask: what they do that isn't their best use, what someone else could do, what process they think needs changing.

Question 8 — Untapped strengths:
Where do they feel their skills are underused?

Questions 9-10 — Future and legacy:
What is their vision? What do they want the next person to preserve?

GRAMMAR AND STYLE RULES:
- All questions start with "How", "What", "Tell me" — never "Do you", "Did you", or "Who"
- Every question invites a story or specific example, not a fact
- Questions are short (1 sentence), clear, in English
- Personalize ALL questions based on ${personName}'s role, department and background
- If personality notes exist — adapt tone and style accordingly

Respond JSON: {"questions": ["question 1", ...]}`

    let finalQPrompt = qPrompt

if (interviewType === 'skill_building') {
  finalQPrompt = language === 'et'
    ? `Sa oled AI kasutuselevõtu ekspert. Sinu ülesanne on genereerida 10 küsimust esimeseks kalibreerimise sessiooniks.

${contextBlock}

SESSIOON 1 EESMÄRK:
Kaardistada kes see inimene on, mis on tema tegelik töö ja mis on tema AI tase. Ei küsita protsesside kohta — küsitakse töörütmi, otsuste ja aja kohta.

KÜSIMUSTE STRUKTUUR:

Küsimused 1-4 — AI tase:
1. Kas kasutad AI-d oma töös praegu?
   Näide: ChatGPT, Claude, Copilot, Gemini — kas oled proovinud või kasutad regulaarselt?
2. Mis tööriista kasutad ja kui tihti?
   Näide: iga päev, kord nädalas, harva — ja kas telefonis, arvutis või mõlemas?
3. Mis on see koht kus AI sind on aidanud?
   Näide: kirjutamine, info otsimine, e-kirjad — midagi mis tuli kasuks?
4. Mis on see koht kus oled proovinud aga ei töötanud?
   Näide: andis vale vastuse, ei saanud aru mida tahtsid, vastus oli liiga üldine?

Küsimused 5-7 — Identiteet:
5. Mis on sinu töös see osa mida keegi teine sinu organisatsioonis ei tee?
   Näide: minul on see müük — keegi teine ei tea kuidas suurtele klientidele läheneda.
6. Mis on see info mis on ainult sinu peas ja kusagil kirjas pole?
   Näide: klientide eripärad, varasemate läbirääkimiste taust, kellele helistada.
7. Kui keegi uus hakkab sinuga koostööd tegema, mida sa neile esimese nädalaga selgitad?
   Näide: kuidas töötame, mis on meie kultuur, mida ootan — see mis ametijuhendis kirjas pole.

Küsimused 8-9 — Töörütm:
8. Kirjelda eelmist nädalat — mis võttis rohkem aega kui ootasid?
   Näide: kohtumised, e-kirjad, aruanded, mõni konkreetne ülesanne mis venitas.
9. Mis on see töö mis kordub iga nädal sama moodi?
   Näide: raportid, koosolekud, klientidele vastamine, arvete kontroll.

Küsimus 10 — Otsusteloogika:
10. Mis on otsus mida teed korduvalt ja mis on sinu kriteeriumid?
    Näide: minul on uus päring — vaatan käivet, võlgu, valdkonda — ja siis tean kas võtame vastu.

REEGLID:
- Iga küsimus on eraldi lause
- Iga küsimus sisaldab konkreetset näidet
- Küsimused algavad "Kas", "Mis", "Kirjelda" — lühikesed ja selged
- Personaliseeri ${personName} rolli põhjal

Vasta JSON: {"questions": ["küsimus koos näitega", ...]}`
    : `You are an AI adoption expert. Generate 10 questions for a first calibration session.

${contextBlock}

SESSION 1 GOAL:
Map who this person is, what their real work looks like, and what their AI level is.

QUESTION STRUCTURE:

Questions 1-4 — AI level:
1. Do you currently use AI in your work?
2. Which tool do you use and how often?
3. Where has AI helped you?
4. Where have you tried it but it didn't work?

Questions 5-7 — Identity:
5. What part of your work does nobody else in your organization do?
6. What knowledge exists only in your head and is written down nowhere?
7. When someone new starts working with you, what do you explain in the first week?

Questions 8-9 — Work rhythm:
8. Describe last week — what took more time than expected?
9. What work repeats every week in the same way?

Question 10 — Decision logic:
10. What decision do you make repeatedly and what are your criteria?

RULES:
- Each question is one sentence with a concrete example
- Personalize based on ${personName}'s role

Respond JSON: {"questions": ["question with example", ...]}`
}

const qRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: finalQPrompt }] })
const qText = qRes.content[0].type === 'text' ? qRes.content[0].text : '{}'
const { questions } = JSON.parse(qText.replace(/```json|```/g, '').trim())
    const qText = qRes.content[0].type === 'text' ? qRes.content[0].text : '{}'
    const { questions } = JSON.parse(qText.replace(/```json|```/g, '').trim())
    await supabaseAdmin.from('questions').insert(questions.map((q: string, i: number) => ({ company_id: company.id, session_number: 1, question_order: i + 1, question_text: q })))
    return NextResponse.json({ success: true, slug, companyId: company.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Viga' }, { status: 500 })
  }
}