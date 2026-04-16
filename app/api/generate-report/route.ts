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
    const interviewType = company.interview_type || 'knowledge_transfer'

    let summaryPrompt = ''

    if (interviewType === 'skill_building') {
      summaryPrompt = lang === 'et'
        ? `Sa oled AI kasutuselevõtu ekspert kes kaardistab inimese tööd ja AI valmisolekut. Sinu raport on meie sisemine tööriist järgmise sessiooni ettevalmistamiseks.

Intervjueeritav: ${company.person_name}, ${company.person_role}
Ettevõte: ${company.company_name}
Sessioon: ${sessionNumber}
Lisainfo: ${company.extra_context || 'pole'}

INTERVJUU:
${qaPairs}

KRIITILISED REEGLID:
- Kirjuta AINULT seda mida intervjueeritav ütles
- Ära lisa soovitusi mida ta ei maininud
- Ära hinda ega järjesta inimest negatiivselt
- Puhasta kõnevead aga säilita mõte täpselt

LOO RAPORT selles täpses formaadis:

## Skill Building Raport — Sessioon ${sessionNumber}
**Intervjueeritav:** ${company.person_name}, ${company.person_role}
**Ettevõte:** ${company.company_name}
**Kuupäev:** ${new Date().toLocaleDateString('et-EE')}

---

### Kes see inimene on
[3-5 lauset. Roll tegelikkuses vs ametinimetus. Tööstiil. Kultuur mida esindab. Ainult transkriptist tulev info.]

---

### AI Journey tase
**Tase:** [1-5]
[Üks lause mis tööriista kasutab või miks pole kasutanud.]

Tase 1 — AI tutvustamine (pole kunagi kasutanud)
Tase 2 — AI katsetamine (proovinud mõned korrad)
Tase 3 — AI rakendamine (kasutab regulaarselt, konkreetsed kasutusjuhud)
Tase 4 — AI lõimimine (AI on osa igapäevasest töövoogust)
Tase 5 — AI juhtimine (ehitab ja optimeerib AI töövoogu aktiivselt)

---

### Tegelik töö
[Standalone statements formaadis. Iga punkt on iseseisev lause mida teine AI saab ilma kontekstita mõista.
Näide: "${company.person_name} vaatab iga uue päringu puhul kolme asja: ettevõtte käive, võlgade olemasolu ja valdkond."]

---

### Korduvad otsused ja loogika
[Konkreetsed otsused mis mainiti. Kriteeriumid mida kasutab. Standalone statements.]

---

### Madal rippuv vili
[1-3 konkreetset kohta kus AI saaks kohe aidata. Ainult see mida inimene ise mainis kui ajamahukat või korduvat.
Formaat: "X tegevus võtab Y aega — AI saab seda toetada nii: Z"]

---

### Mis jäi katmata
[Mis teemad vajaksid süvendamist. Mis küsimustele ei saanud vastust. Konkreetsed augud kaardistuses.]

---

### Vastused küsimuste kaupa
[Iga küsimuse kohta:]
**[Küsimus]**
[Sisuline kokkuvõte 2-3 lausega. Puhasta kõnevead. Mida ta sisuliselt ütles.]

---

### Sessioon 2 ettevalmistus
[3 adaptiivsed küsimust mis tulenevad AINULT sellest transkriptist. Mine sügavamale teemadesse mis jäid poolikuks.
Formaat: küsimus + näide]`
        : `You are an AI adoption expert mapping a person's work and AI readiness. This report is our internal tool for preparing the next session.

Interviewee: ${company.person_name}, ${company.person_role}
Company: ${company.company_name}
Session: ${sessionNumber}
Extra context: ${company.extra_context || 'none'}

INTERVIEW:
${qaPairs}

CRITICAL RULES:
- Write ONLY what the interviewee said
- Do not add recommendations they did not mention
- Do not negatively assess or rank the person
- Clean up speech errors but preserve meaning exactly

CREATE REPORT in this exact format:

## Skill Building Report — Session ${sessionNumber}
**Interviewee:** ${company.person_name}, ${company.person_role}
**Company:** ${company.company_name}
**Date:** ${new Date().toLocaleDateString('en-GB')}

---

### Who This Person Is
[3-5 sentences. Real role vs job title. Work style. Culture they represent. Only info from transcript.]

---

### AI Journey Level
**Level:** [1-5]
[One sentence about which tool they use or why they haven't used AI.]

Level 1 — AI Introduction (never used)
Level 2 — AI Exploration (tried a few times)
Level 3 — AI Application (uses regularly, specific use cases)
Level 4 — AI Integration (AI is part of daily workflow)
Level 5 — AI Leadership (actively builds and optimizes AI workflows)

---

### Real Work
[Standalone statements format. Each point is a self-contained sentence another AI can understand without context.]

---

### Recurring Decisions and Logic
[Specific decisions mentioned. Criteria used. Standalone statements.]

---

### Low-Hanging Fruit
[1-3 specific areas where AI could help immediately. Only what the person mentioned as time-consuming or repetitive.
Format: "X activity takes Y time — AI can support this by: Z"]

---

### What Was Not Covered
[Topics needing more depth. Questions without answers. Specific gaps in mapping.]

---

### Answers by Question
**[Question]**
[Substantive summary 2-3 sentences. Clean up speech errors. What they actually said.]

---

### Session 2 Preparation
[3 adaptive questions from THIS transcript only. Go deeper into topics left incomplete.
Format: question + example]`
    } else {
      summaryPrompt = lang === 'et'
        ? `Sa oled knowledge transfer spetsialist kes kaardistab ettevõtte võtmeinimesi. Sinu raport on juhi tööriist, mitte kliendidokument. Ole toores, täpne ja analüütiline.

DISCLAIMER KÕIGILE HINNANGUTELE: Kõik hinnangud põhinevad ainult ühel intervjuul ja on ligikaudsed. Need ei ole lõplikud järeldused.

Intervjueeritav: ${company.person_name}, ${company.person_role}
Ettevõte: ${company.company_name}
Sessioon: ${sessionNumber}
LinkedIn info: ${company.linkedin_info || 'pole'}
Lisainfo: ${company.extra_context || 'pole'}

INTERVJUU:
${qaPairs}

LOO RAPORT selles täpses formaadis:

## Knowledge Transfer Raport
**Intervjueeritav:** ${company.person_name}, ${company.person_role}
**Ettevõte:** ${company.company_name}
**Sessioon:** ${sessionNumber}
**Kuupäev:** ${new Date().toLocaleDateString('et-EE')}

---

### Kokkuvõte
[3-5 lauset: kes on see inimene, mis on tema tegelik roll, mis olid sessiooni peateemad. Ainult faktid vastuste põhjal.]

---

### Päris töö vs ametinimetus
[Mida ta TEGELIKULT teeb, mitte mis on ametinimetuse järgi tema töö. Mis ülesanded on tegelikult tema käes? Kellele ta on asendamatu ja miks? Põhine ainult tema vastustel.]

---

### Asendamatuse riskianalüüs
⚠️ *Disclaimer: Põhineb ühel intervjuul. Ligikaudne hinnang.*

**Riskitase:** [KÕRGE / KESKMINE / MADAL] — [1-2 lauset miks]

**Mis läheks kaotsi kui ta lahkuks:**
[Loetelu konkreetsetest asjadest mida ta mainis]

**Mis on dokumenteeritud:**
[Mis on tema sõnul juba kirjas või teistele teada]

**Mis ei ole dokumenteeritud:**
[Mis on ainult tema peas]

---

### Tööstiil ja iseloom
⚠️ *Disclaimer: Põhineb ühel intervjuul ja on ligikaudne.*

**Suhtlusstiil:** [Kuidas ta eelistab infot jagada ja vastu võtta]
**Otsustusstiil:** [Kuidas ta teeb otsuseid — kiiresti/aeglaselt, üksi/koos]
**Energiaallikad:** [Mis talle tööl energiat annab]
**Väljakutsed:** [Mis teda väsitab või frustreerib]
**Emotsionaalne toon:** [Kus ta oli enesekindel, kus kõhkles]

---

### Vastuolud ja tähelepanekud
⚠️ *Disclaimer: Tõlgendused põhinevad ühel intervjuul.*

[Kus ta ütles eri kohtades vastupidist. Mida ta EI öelnud kuigi küsimus seda eeldas. Kui vastuolusid pole — kirjuta "Ei tuvastatud selgeid vastuolusid".]

---

### Mõttetu töö ja raiskamine
[Mis ta ise mainis et on mõttetu, aeganõudev või võiks delegeerida. Ainult tema vastuste põhjal. Kui ei maininud — kirjuta "Ei käsitletud".]

---

### Kasutamata tugevused
[Kus ta ise tunneb et tema oskusi ei kasutata piisavalt. Ainult tema vastuste põhjal. Kui ei maininud — kirjuta "Ei käsitletud".]

---

### Vastused küsimuste kaupa
[Iga küsimuse kohta:]
**[Küsimus]**
[Sisuline kokkuvõte 2-3 lausega. Puhasta kõnevead. Mida ta sisuliselt ütles.]

---

### Mis jäi katmata
[Teemad millele vastus puudus. Loetelu.]

---

### Mida järgmises sessioonis uurida
[Teemad mis tulid jutus üles aga jäid pinnapealseks. Vastuolud mida tuleks selgitada.]`
        : `You are a knowledge transfer specialist mapping key people in a company. Your report is a manager's working tool, not a client document. Be raw, precise and analytical.

DISCLAIMER ON ALL ASSESSMENTS: All assessments are based on one interview only and are approximate. These are not final conclusions.

Interviewee: ${company.person_name}, ${company.person_role}
Company: ${company.company_name}
Session: ${sessionNumber}
LinkedIn: ${company.linkedin_info || 'none'}
Extra context: ${company.extra_context || 'none'}

INTERVIEW:
${qaPairs}

CREATE REPORT in this exact format:

## Knowledge Transfer Report
**Interviewee:** ${company.person_name}, ${company.person_role}
**Company:** ${company.company_name}
**Session:** ${sessionNumber}
**Date:** ${new Date().toLocaleDateString('en-GB')}

---

### Overview
[3-5 sentences: who is this person, what is their real role, what were the main topics. Facts only from answers.]

---

### Real Work vs Job Title
[What they ACTUALLY do, not what their job title says. Based only on their answers.]

---

### Indispensability Risk Analysis
⚠️ *Disclaimer: Based on one interview. Approximate assessment.*

**Risk level:** [HIGH / MEDIUM / LOW] — [1-2 sentences why]

**What would be lost if they left:**
[List of specific things they mentioned]

**What is documented:**
[What they said is already written down or known by others]

**What is not documented:**
[What exists only in their head]

---

### Work Style and Character
⚠️ *Disclaimer: Based on one interview. Approximate.*

**Communication style:** [How they prefer to share and receive information]
**Decision style:** [How they make decisions]
**Energy sources:** [What gives them energy at work]
**Challenges:** [What tires or frustrates them]
**Emotional tone:** [Where they were confident, where they hesitated]

---

### Contradictions and Observations
⚠️ *Disclaimer: Interpretations based on one interview.*

[Where they said opposite things. What they did NOT say. If no contradictions — write "No clear contradictions identified".]

---

### Meaningless Work and Waste
[What they mentioned is pointless or time-consuming. If not mentioned — write "Not covered".]

---

### Untapped Strengths
[Where they feel underused. If not mentioned — write "Not covered".]

---

### Answers by Question
**[Question]**
[Substantive summary 2-3 sentences. Clean up speech errors.]

---

### What Was Not Covered
[Topics with no answers. List only.]

---

### What to Explore in Next Session
[Topics that came up but stayed superficial. Contradictions to clarify.]`
    }

    const summaryRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, messages: [{ role: 'user', content: summaryPrompt }] })
    const executiveSummary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''

    const profilePrompt = lang === 'et'
      ? `Analüüsi seda intervjuud ja anna hinnangud. Vasta AINULT JSON-ina, mitte midagi muud.

Intervjuu tüüp: ${interviewType}
Intervjuu:
${qaPairs}

Vasta täpselt selles formaadis:
{
  "indispensability": <1-10, kui asendamatu on see inimese teadmus>,
  "documentation": <1-10, kui hästi on tema teadmised dokumenteeritud>,
  "detail_vs_bigpicture": <1-10, kus 1=ainult detailid, 10=ainult suurpilt>,
  "introvert_vs_extrovert": <1-10, kus 1=väga introvertne, 10=väga ekstravertne>,
  "risk_level": <"KÕRGE" | "KESKMINE" | "MADAL">,
  "ai_journey_level": <1-5, ainult skill_building puhul, muul juhul null>,
  "key_knowledge": [<3-5 kõige olulisemat teadmist mida ta omab, lühikesed>],
  "skill_map": {
    "identiteet": <0-100>,
    "toorytm": <0-100>,
    "otsusteloogika": <0-100>,
    "kontekst": <0-100>,
    "inimesed": <0-100>,
    "kaitumisjuhised": <0-100>
  },
  "disclaimer": "Põhineb ühel intervjuul. Ligikaudne hinnang."
}`
      : `Analyze this interview and give ratings. Respond ONLY with JSON, nothing else.

Interview type: ${interviewType}
Interview:
${qaPairs}

Respond in exactly this format:
{
  "indispensability": <1-10, how indispensable is their knowledge>,
  "documentation": <1-10, how well documented is their knowledge>,
  "detail_vs_bigpicture": <1-10, where 1=only details, 10=only big picture>,
  "introvert_vs_extrovert": <1-10, where 1=very introverted, 10=very extroverted>,
  "risk_level": <"HIGH" | "MEDIUM" | "LOW">,
  "ai_journey_level": <1-5, only for skill_building, otherwise null>,
  "key_knowledge": [<3-5 most important pieces of knowledge they hold, short>],
  "skill_map": {
    "identiteet": <0-100>,
    "toorytm": <0-100>,
    "otsusteloogika": <0-100>,
    "kontekst": <0-100>,
    "inimesed": <0-100>,
    "kaitumisjuhised": <0-100>
  },
  "disclaimer": "Based on one interview. Approximate assessment."
}`

    const profileRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: profilePrompt }] })
    const profileText = profileRes.content[0].type === 'text' ? profileRes.content[0].text : '{}'
    let profileData = {}
    try { profileData = JSON.parse(profileText.replace(/```json|```/g, '').trim()) } catch { profileData = {} }

    await supabaseAdmin.from('reports').insert({ company_id: companyId, session_number: sessionNumber, executive_summary: executiveSummary, quality_check_notes: JSON.stringify(profileData) })

    const nextPrompt = lang === 'et'
      ? `Loo 15 süvaintervjuu küsimust teiseks sessiooniks ${company.person_name} jaoks (${company.person_role}, ${company.company_name}).

Intervjuu tüüp: ${interviewType}
Esimese sessiooni vastused:
${qaPairs}

REEGLID:
- Küsimused peavad põhinema sellel mida ta ÜTLES — mine sügavamale nendesse teemadesse
- Personaliseeri tema konkreetse rolli ja vastuste põhjal
- EI TOHI küsida asju mida ta juba täielikult kattis
- Kui skill_building: fokuseeri töörütmile, konkreetsetele ülesannetele ja AI konteksti gapidele
- Kui knowledge_transfer: fokuseeri kliendisuhted, meeskond, otsused, strateegia, kirjutamata reeglid
- Eesti keeles, lühikesed ja konkreetsed, iga küsimus eraldi lause koos näitega

Vasta JSON: {"questions": ["küsimus 1", ...]}`
      : `Create 15 deep-dive questions for session 2 with ${company.person_name} (${company.person_role}, ${company.company_name}).

Interview type: ${interviewType}
First session answers:
${qaPairs}

RULES:
- Build on what they SAID — go deeper into those specific topics
- Personalize based on their specific answers
- DO NOT ask about things already covered fully
- If skill_building: focus on work rhythm, specific tasks and AI context gaps
- If knowledge_transfer: focus on client relationships, team, decisions, strategy, unwritten rules
- English, short and specific, each question one sentence with an example

Respond JSON: {"questions": ["question 1", ...]}`

    const nextRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: nextPrompt }] })
    const nextText = nextRes.content[0].type === 'text' ? nextRes.content[0].text : '{}'
    const { questions: nextQs } = JSON.parse(nextText.replace(/```json|```/g, '').trim())
    await supabaseAdmin.from('questions').insert(nextQs.map((q: string, i: number) => ({ company_id: companyId, session_number: 2, question_order: i + 1, question_text: q })))
    await supabaseAdmin.from('companies').update({ status: 'report_ready' }).eq('id', companyId)
    return NextResponse.json({ success: true, executiveSummary, profileData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}