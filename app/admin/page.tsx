'use client'
import { useState, useEffect } from 'react'
type Company = { id: string; slug: string; company_name: string; person_name: string; person_role: string; status: string; language: string; interview_type: string }
type Report = { executive_summary: string; session_number: number; created_at: string; transcript: string; quality_check_notes: string }
const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ootel', color: 'bg-yellow-100 text-yellow-800' },
  interview_started: { label: 'Intervjuu käib', color: 'bg-blue-100 text-blue-800' },
  report_ready: { label: 'Raport valmis', color: 'bg-green-100 text-green-800' },
  second_session_ready: { label: 'Teine voor valmis', color: 'bg-green-200 text-green-900' },
}
const ADMIN_PASSWORD = 'Teretulemast'
export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successSlug, setSuccessSlug] = useState('')
  const [selectedReport, setSelectedReport] = useState<{ company: Company; reports: Report[] } | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [form, setForm] = useState({ companyName: '', slug: '', personName: '', personRole: '', department: '', specialization: '', yearsInRole: '', personalityNotes: '', interviewContext: '', linkedinInfo: '', extraContext: '', language: 'et', interviewType: '' })
  const fetchCompanies = async () => { const res = await fetch('/api/admin/companies'); if (res.ok) setCompanies(await res.json()) }
  useEffect(() => { if (isLoggedIn) fetchCompanies() }, [isLoggedIn])
  const generateSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const handleLogin = () => { if (password === ADMIN_PASSWORD) { setIsLoggedIn(true) } else { alert('Vale parool') } }
  const handleCreate = async () => {
    if (!form.companyName || !form.slug || !form.personName || !form.personRole) { alert('Täida kõik kohustuslikud väljad'); return }
    if (!form.interviewType) { alert('Vali intervjuu tüüp enne jätkamist'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/create-company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Viga'); return }
      setSuccessSlug(data.slug); setShowForm(false)
      setForm({ companyName: '', slug: '', personName: '', personRole: '', department: '', specialization: '', yearsInRole: '', personalityNotes: '', interviewContext: '', linkedinInfo: '', extraContext: '', language: 'et', interviewType: '' })
      fetchCompanies()
    } catch { alert('Ühenduse viga') } finally { setLoading(false) }
  }
  const handleDelete = async (c: Company) => {
    if (!confirm(`Kustuta ${c.company_name}? Kõik andmed lähevad kaotsi.`)) return
    const res = await fetch('/api/delete-company', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: c.id }) })
    if (res.ok) fetchCompanies(); else alert('Kustutamine ebaõnnestus')
  }
  const handleViewReports = async (c: Company) => {
    const reportsRes = await fetch(`/api/admin/reports?companyId=${c.id}`)
    const reportsData = reportsRes.ok ? await reportsRes.json() : []
    setSelectedReport({ company: c, reports: reportsData })
  }
  const handleRegenerate = async (c: Company, sessionNumber: number) => {
    if (!confirm('Genereeri raport uuesti? Vana raport kustutatakse.')) return
    setRegenerating(true)
    setSelectedReport(prev => prev ? { ...prev, reports: [] } : null)
    try {
      await fetch('/api/admin/reports/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: c.id, sessionNumber }) })
      const res = await fetch('/api/generate-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: c.id, sessionNumber }) })
      if (!res.ok) throw new Error()
      const reportsRes = await fetch(`/api/admin/reports?companyId=${c.id}`)
      const reportsData = reportsRes.ok ? await reportsRes.json() : []
      setSelectedReport({ company: c, reports: reportsData })
    } catch { alert('Viga raporti genereerimisel') } finally { setRegenerating(false) }
  }
  const downloadTranscript = (r: Report) => {
    const blob = new Blob([r.transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transkript-sessioon-${r.session_number}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
  const getProfile = (r: Report) => {
    try { return JSON.parse(r.quality_check_notes || '{}') } catch { return {} }
  }
 const downloadSkillMapPNG = async (company: Company) => {
    try {
      const el = document.getElementById('skill-map-card')
      if (!el) { alert('Kaart ei leitud'); return }
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(el, { backgroundColor: '#1f2937', scale: 2, useCORS: true, allowTaint: true })
      const link = document.createElement('a')
      link.download = `skill-map-${company.person_name}.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch(e) { alert('Viga: ' + e) }
  }
  const downloadSkillMapPDF = async (company: Company) => {
    try {
      const el = document.getElementById('skill-map-card')
      if (!el) { alert('Kaart ei leitud'); return }
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(el, { backgroundColor: '#1f2937', scale: 2, useCORS: true, allowTaint: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`skill-map-${company.person_name}.pdf`)
    } catch(e) { alert('Viga: ' + e) }
  }
  if (!isLoggedIn) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">Sihval Admin</h1>
        <p className="text-gray-400 mb-6 text-sm">Knowledge Transfer Platform</p>
        <input type="password" placeholder="Parool" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:border-blue-500" />
        <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition">Logi sisse</button>
      </div>
    </div>
  )

  if (selectedReport) return (
    <div className="min-h-screen bg-gray-950 text-white">
      {regenerating && (
        <div className="fixed inset-0 bg-gray-950 bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg font-semibold">Genereerin raporti...</p>
            <p className="text-gray-400 text-sm mt-2">~30-60 sekundit</p>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Tagasi</button>
        <h1 className="text-2xl font-bold mb-1">{selectedReport.company.company_name}</h1>
        <p className="text-gray-400 mb-2">{selectedReport.company.person_name} · {selectedReport.company.person_role}</p>
        <span className="inline-block text-xs px-2 py-1 rounded-full mb-8 bg-gray-800 text-gray-400">{selectedReport.company.interview_type === 'skill_building' ? '⚡ Skill Building' : '📋 Knowledge Transfer'}</span>
        {selectedReport.reports.length === 0 && !regenerating && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Raporteid pole veel.</p>
            <button onClick={() => handleRegenerate(selectedReport.company, 1)} disabled={regenerating} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-6 py-3 rounded-lg">⚡ Genereeri raport</button>
          </div>
        )}
        {selectedReport.reports.map((r, i) => {
          const profile = getProfile(r)
          const isSkillBuilding = selectedReport.company.interview_type === 'skill_building'
          const skillMap = profile.skill_map
          const skillLayers = [
            { key: 'identiteet', label: 'Identiteet', color: 'bg-blue-500' },
            { key: 'toorytm', label: 'Töörütm', color: 'bg-purple-500' },
            { key: 'otsusteloogika', label: 'Otsusteloogika', color: 'bg-yellow-500' },
            { key: 'kontekst', label: 'Kontekst', color: 'bg-green-500' },
            { key: 'inimesed', label: 'Inimesed', color: 'bg-orange-500' },
            { key: 'kaitumisjuhised', label: 'Käitumisjuhised', color: 'bg-red-500' },
          ]
          const skillAvg = skillMap ? Math.round(Object.values(skillMap as Record<string, number>).reduce((a, b) => a + b, 0) / Object.values(skillMap as Record<string, number>).length) : 0
          return (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Sessioon {r.session_number} — Raport</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleRegenerate(selectedReport.company, r.session_number)} disabled={regenerating} className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-sm px-4 py-2 rounded-lg">🔄 Genereeri uuesti</button>
                  <button onClick={() => { const blob = new Blob([r.executive_summary], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `raport-${selectedReport.company.person_name}-sessioon-${r.session_number}.txt`; a.click(); URL.revokeObjectURL(url) }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg">⬇️ Lae raport alla</button>
                  <button onClick={() => downloadTranscript(r)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg">⬇️ Transkript</button>
                </div>
              </div>

              {isSkillBuilding && skillMap && (
                <div className="mb-6">
                  <div id="skill-map-card" className="p-6 rounded-xl border border-gray-700 bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-bold text-lg">{selectedReport.company.person_name}</h3>
                        <p className="text-gray-400 text-sm">{selectedReport.company.person_role} · {selectedReport.company.company_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs mb-1">AI Journey tase</p>
                        <span className="text-blue-400 font-bold text-2xl">{profile.ai_journey_level || '–'}<span className="text-gray-500 text-sm">/5</span></span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">⚠️ Põhineb ühel intervjuul. Ligikaudne hinnang.</p>
                    <div className="space-y-3 mb-4">
                      {skillLayers.map(({ key, label, color }) => {
                        const pct = skillMap[key] ?? 0
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <p className="text-gray-300 text-sm w-36 shrink-0">{label}</p>
                            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-3 ${color} rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-gray-300 text-sm w-10 text-right">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="pt-4 border-t border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm">Skill valmidus kokku</p>
                        <p className="text-white font-bold text-lg">{skillAvg}%</p>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: `${skillAvg}%` }}></div>
                      </div>
                    </div>
                    {profile.key_knowledge && profile.key_knowledge.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-400 mb-2">Võtmeteadmised:</p>
                        <div className="flex flex-wrap gap-2">
                          {profile.key_knowledge.map((k: string, i: number) => <span key={i} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-lg">{k}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => downloadSkillMapPNG(selectedReport.company)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg">⬇️ PNG</button>
                    <button onClick={() => downloadSkillMapPDF(selectedReport.company)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg">⬇️ PDF</button>
                  </div>
                </div>
              )}

              {!isSkillBuilding && profile.risk_level && (
                <div className="mb-6 p-4 rounded-xl border border-gray-700 bg-gray-800">
                  <p className="text-xs text-gray-500 mb-3">⚠️ Disclaimer: Põhineb ühel intervjuul. Ligikaudne hinnang.</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Riskitase</p>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${profile.risk_level === 'KÕRGE' || profile.risk_level === 'HIGH' ? 'bg-red-900 text-red-300' : profile.risk_level === 'KESKMINE' || profile.risk_level === 'MEDIUM' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>{profile.risk_level}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Asendamatus</p>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-2 bg-red-500 rounded-full" style={{ width: `${(profile.indispensability || 0) * 10}%` }}></div></div>
                        <span className="text-xs text-gray-300">{profile.indispensability}/10</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Dokumenteeritus</p>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(profile.documentation || 0) * 10}%` }}></div></div>
                        <span className="text-xs text-gray-300">{profile.documentation}/10</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Detailid ↔ Suurpilt</p>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-2 bg-purple-500 rounded-full" style={{ width: `${(profile.detail_vs_bigpicture || 0) * 10}%` }}></div></div>
                        <span className="text-xs text-gray-300">{profile.detail_vs_bigpicture}/10</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Introvert ↔ Ekstravert</p>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-2 bg-green-500 rounded-full" style={{ width: `${(profile.introvert_vs_extrovert || 0) * 10}%` }}></div></div>
                        <span className="text-xs text-gray-300">{profile.introvert_vs_extrovert}/10</span>
                      </div>
                    </div>
                  </div>
                  {profile.key_knowledge && profile.key_knowledge.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 mb-2">Võtmeteadmised:</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.key_knowledge.map((k: string, i: number) => <span key={i} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-lg">{k}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-gray-300 leading-relaxed text-sm prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: r.executive_summary.replace(/^## (.+)$/gm, '<h2 class="text-white text-lg font-bold mt-6 mb-2">$1</h2>').replace(/^### (.+)$/gm, '<h3 class="text-gray-200 text-base font-semibold mt-4 mb-2">$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/^---$/gm, '<hr class="border-gray-700 my-4">').replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-300">$1</li>').replace(/\n\n/g, '<br><br>') }} />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-3xl font-bold">Sihval Admin</h1><p className="text-gray-400 mt-1">Knowledge Transfer Platform</p></div>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition">+ Uus intervjuu</button>
        </div>
        {successSlug && (
          <div className="bg-green-900 border border-green-700 rounded-xl p-4 mb-6">
            <p className="text-green-300 font-semibold mb-1">✓ Intervjuu loodud!</p>
            <div className="flex items-center gap-3">
              <code className="bg-green-950 px-3 py-2 rounded-lg text-green-200 text-sm flex-1">{typeof window !== 'undefined' ? window.location.origin : ''}/interview/{successSlug}</code>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/interview/${successSlug}`); alert('Kopeeritud!') }} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-medium">Kopeeri</button>
            </div>
            <button onClick={() => setSuccessSlug('')} className="text-green-500 text-xs mt-2 hover:text-green-400">Sulge</button>
          </div>
        )}
        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-5">Loo uus intervjuu</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-gray-400 mb-1 block">Ettevõtte nimi *</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value, slug: generateSlug(e.target.value) })} placeholder="nt. Viru Keskus" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Slug (URL) *</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="nt. viru-keskus" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Inimese nimi *</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} placeholder="nt. Raul Mägi" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Roll *</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.personRole} onChange={e => setForm({ ...form, personRole: e.target.value })} placeholder="nt. Tegevjuht" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Osakond</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="nt. Müük" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Spetsialiseerumine</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="nt. B2B müük" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Aega rollis (aastates)</label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.yearsInRole} onChange={e => setForm({ ...form, yearsInRole: e.target.value })} placeholder="nt. 5" /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Keel</label><select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}><option value="et">Eesti keel</option><option value="en">English</option></select></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Intervjuu tüüp *</label><select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.interviewType} onChange={e => setForm({ ...form, interviewType: e.target.value })}><option value="">— Vali tüüp —</option><option value="knowledge_transfer">Teadmussiire</option><option value="skill_building">Skill Building</option></select></div>
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">Iseloom ja käitumine <span className="text-gray-600">(valikuline)</span></label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.personalityNotes} onChange={e => setForm({ ...form, personalityNotes: e.target.value })} placeholder="nt. väga introvertne, eelistab kirjalikku suhtlust" /></div>
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">Intervjuu kontekst <span className="text-gray-600">(valikuline)</span></label><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.interviewContext} onChange={e => setForm({ ...form, interviewContext: e.target.value })} placeholder="nt. lahkub pensionile, uus juht tuleb" /></div>
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">LinkedIn info</label><textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 h-24 resize-none" value={form.linkedinInfo} onChange={e => setForm({ ...form, linkedinInfo: e.target.value })} placeholder="Kopeeri siia LinkedIn profiili tekst..." /></div>
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">Lisainfo / kontekst</label><textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 h-20 resize-none" value={form.extraContext} onChange={e => setForm({ ...form, extraContext: e.target.value })} placeholder="Mida on oluline teada selle inimese kohta..." /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg transition">{loading ? 'Loon... (~30s)' : 'Loo intervjuu'}</button>
              <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-lg transition">Tühista</button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {companies.length === 0 && <div className="text-center py-16 text-gray-500"><p className="text-lg mb-2">Ühtegi intervjuud pole veel loodud</p></div>}
          {companies.map(c => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1"><h3 className="font-semibold text-lg">{c.company_name}</h3><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabels[c.status]?.color || 'bg-gray-700 text-gray-300'}`}>{statusLabels[c.status]?.label || c.status}</span><span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{c.interview_type === 'skill_building' ? '⚡ Skill Building' : '📋 Teadmussiire'}</span></div>
                <p className="text-gray-400 text-sm">{c.person_name} · {c.person_role} · {c.language === 'et' ? '🇪🇪 Eesti' : '🇬🇧 English'}</p>
                <p className="text-gray-600 text-xs mt-1">/interview/{c.slug}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/interview/${c.slug}`); alert('Link kopeeritud!') }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition">Kopeeri link</button>
                {(c.status === 'report_ready' || c.status === 'second_session_ready') && (
                  <button onClick={() => handleViewReports(c)} className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition">Vaata raporti</button>
                )}
                <button onClick={() => handleDelete(c)} className="bg-red-900 hover:bg-red-800 text-red-300 text-sm px-4 py-2 rounded-lg transition">Kustuta</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}