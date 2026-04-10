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
      ? `Sa oled interim juhi tööriist — knowledge transfer spetsialist kes kaardistab ettevõtte võtmeinimesi. Sinu raport on Alari (interim juhi) tööriist, mitte kliendidokument. Ole toores, täpne ja analüütiline.

DISCLAIMER KÕIGILE HINNANGUTELE: Kõik hinnangud põhinevad ainult ühel intervjuul ja on ligikaudsed. Need ei ole lõplikud järeldused.

Intervjueeritav: ${company.person_name}, ${company.person_role}
Ettevõte: ${company.company_name}
Sessioon: ${sessionNumber}
LinkedIn info: ${company.linkedin_info || 'pole'}
Lisainfo: ${company.extra_context || 'pole'}

INTERVJUU:
${qaPairs}

LOO RAPORT selles täpses formaadis:

## Knowledge Transfer Raport — Alari tööriist
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
**Väljakutsed:** [Mis teda väsitab või frustrreerib]

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
[Teemad mis tulid jutus üles aga jäid pinnapealseks. Ainult vastuste põhjal.]`
      : `You are an interim manager's tool — a knowledge transfer specialist mapping key people in a company. Your report is Alar's (interim manager's) working tool, not a client document. Be raw, precise and analytical.

DISCLAIMER ON ALL ASSESSMENTS: All assessments are based on one interview only and are approximate. These are not final conclusions.

Interviewee: ${company.person_name}, ${company.person_role}
Company: ${company.company_name}
Session: ${sessionNumber}
LinkedIn: ${company.linkedin_info || 'none'}
Extra context: ${company.extra_context || 'none'}

INTERVIEW:
${qaPairs}

CREATE REPORT in this exact format:

## Knowledge Transfer Report — Working Tool
**Interviewee:** ${company.person_name}, ${company.person_role}
**Company:** ${company.company_name}
**Session:** ${sessionNumber}
**Date:** ${new Date().toLocaleDateString('en-GB')}

---

### Overview
[3-5 sentences: who is this person, what is their real role, what were the main topics. Facts only from answers.]

---

### Real Work vs Job Title
[What they ACTUALLY do, not what their job title says. What tasks are really in their hands? Who depends on them and why? Based only on their answers.]

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
**Decision style:** [How they make decisions — fast/slow, alone/together]
**Energy sources:** [What gives them energy at work]
**Challenges:** [What tires or frustrates them]

---

### Meaningless Work and Waste
[What they mentioned is pointless, time-consuming or could be delegated. Based only on their answers. If not mentioned — write "Not covered".]

---

### Untapped Strengths
[Where they feel their skills are underused. Based only on their answers. If not mentioned — write "Not covered".]

---

### Answers by Question
**[Question]**
[Substantive summary 2-3 sentences. Clean up speech errors. What they actually said.]

---

### What Was Not Covered
[Topics with no answers. List only.]

---

### What to Explore in Next Session
[Topics that came up but stayed superficial. Based on answers only.]`

    const summaryRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, messages: [{ role: 'user', content: summaryPrompt }] })
    const executiveSummary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''

    const profilePrompt = lang === 'et'
      ? `Analüüsi seda intervjuud ja anna hinnangud skaalal 1-10. Vasta AINULT JSON-ina, mitte midagi muud.

Intervjuu:
${qaPairs}

Vasta täpselt selles formaadis:
{
  "indispensability": <1-10, kui asendamatu on see inimene>,
  "documentation": <1-10, kui hästi on tema teadmised dokumenteeritud>,
  "detail_vs_bigpicture": <1-10, kus 1=ainult detailid, 10=ainult suurpilt>,
  "introvert_vs_extrovert": <1-10, kus 1=väga introvertne, 10=väga ekstravertne>,
  "risk_level": <"KÕRGE" | "KESKMINE" | "MADAL">,
  "key_knowledge": [<3-5 kõige olulisemat teadmist mida ta omab, lühikesed>],
  "disclaimer": "Põhineb ühel intervjuul. Ligikaudne hinnang."
}`
      : `Analyze this interview and give ratings on a scale of 1-10. Respond ONLY with JSON, nothing else.

Interview:
${qaPairs}

Respond in exactly this format:
{
  "indispensability": <1-10, how indispensable is this person>,
  "documentation": <1-10, how well documented is their knowledge>,
  "detail_vs_bigpicture": <1-10, where 1=only details, 10=only big picture>,
  "introvert_vs_extrovert": <1-10, where 1=very introverted, 10=very extroverted>,
  "risk_level": <"HIGH" | "MEDIUM" | "LOW">,
  "key_knowledge": [<3-5 most important pieces of knowledge they hold, short>],
  "disclaimer": "Based on one interview. Approximate assessment."
}`

    const profileRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: profilePrompt }] })
    const profileText = profileRes.content[0].type === 'text' ? profileRes.content[0].text : '{}'
    let profileData = {}
    try { profileData = JSON.parse(profileText.replace(/```json|```/g, '').trim()) } catch { profileData = {} }

    await supabaseAdmin.from('reports').insert({ company_id: companyId, session_number: sessionNumber, executive_summary: executiveSummary, quality_check_notes: JSON.stringify(profileData) })

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
- Grammatiliselt korrektne eesti keel

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
    return NextResponse.json({ success: true, executiveSummary, profileData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}