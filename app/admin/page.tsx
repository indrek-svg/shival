'use client'
import { useState, useEffect } from 'react'
type Company = { id: string; slug: string; company_name: string; person_name: string; person_role: string; status: string; language: string }
type Report = { executive_summary: string; session_number: number; created_at: string; transcript: string }
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
  const [form, setForm] = useState({ companyName: '', slug: '', personName: '', personRole: '', linkedinInfo: '', extraContext: '', language: 'et' })
  const fetchCompanies = async () => { const res = await fetch('/api/admin/companies'); if (res.ok) setCompanies(await res.json()) }
  useEffect(() => { if (isLoggedIn) fetchCompanies() }, [isLoggedIn])
  const generateSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const handleLogin = () => { if (password === ADMIN_PASSWORD) { setIsLoggedIn(true) } else { alert('Vale parool') } }
  const handleCreate = async () => {
    if (!form.companyName || !form.slug || !form.personName || !form.personRole) { alert('Täida kõik kohustuslikud väljad'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/create-company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Viga'); return }
      setSuccessSlug(data.slug); setShowForm(false)
      setForm({ companyName: '', slug: '', personName: '', personRole: '', linkedinInfo: '', extraContext: '', language: 'et' })
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
  const downloadTranscript = (r: Report) => {
    const blob = new Blob([r.transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transkript-sessioon-${r.session_number}.txt`
    a.click()
    URL.revokeObjectURL(url)
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
      <div className="max-w-4xl mx-auto px-6 py-10">
        <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Tagasi</button>
        <h1 className="text-2xl font-bold mb-1">{selectedReport.company.company_name}</h1>
        <p className="text-gray-400 mb-8">{selectedReport.company.person_name} · {selectedReport.company.person_role}</p>
        {selectedReport.reports.length === 0 && <p className="text-gray-500">Raporteid pole veel.</p>}
        {selectedReport.reports.map((r, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sessioon {r.session_number} — Raport</h2>
              <div className="flex gap-2">
                <button onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<pre style="font-family:sans-serif;padding:2rem;white-space:pre-wrap">${r.executive_summary}</pre>`); w?.print() }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg">🖨️ Prindi / PDF</button>
                <button onClick={() => downloadTranscript(r)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg">⬇️ Transkript</button>
              </div>
            </div>
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{r.executive_summary}</div>
          </div>
        ))}
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
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">LinkedIn info</label><textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 h-24 resize-none" value={form.linkedinInfo} onChange={e => setForm({ ...form, linkedinInfo: e.target.value })} placeholder="Kopeeri siia LinkedIn profiili tekst..." /></div>
              <div className="col-span-2"><label className="text-sm text-gray-400 mb-1 block">Lisainfo / kontekst</label><textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 h-20 resize-none" value={form.extraContext} onChange={e => setForm({ ...form, extraContext: e.target.value })} placeholder="Mida on oluline teada..." /></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Keel</label><select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}><option value="et">Eesti keel</option><option value="en">English</option></select></div>
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
                <div className="flex items-center gap-3 mb-1"><h3 className="font-semibold text-lg">{c.company_name}</h3><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabels[c.status]?.color || 'bg-gray-700 text-gray-300'}`}>{statusLabels[c.status]?.label || c.status}</span></div>
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