'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
type Company = { id: string; company_name: string; person_name: string; person_role: string; language: string; status: string }
type Question = { id: string; question_text: string; question_order: number; session_number: number }
type Stage = 'loading' | 'preview' | 'welcome' | 'recording' | 'processing' | 'report' | 'error' | 'free_recording'
export default function InterviewPage() {
  const params = useParams()
  const slug = params.slug as string
  const [stage, setStage] = useState<Stage>('loading')
  const [company, setCompany] = useState<Company | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [isRecording, setIsRecording] = useState(false)
  const [report, setReport] = useState('')
  const [nextSessionQuestions, setNextSessionQuestions] = useState<Question[]>([])
  const [error, setError] = useState('')
  const [processingMessage, setProcessingMessage] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const MAX_FREE_SECONDS = 90 * 60
  const t = (et: string, en: string) => company?.language === 'en' ? en : et
  useEffect(() => { loadCompanyData() }, [slug])
  const loadCompanyData = async () => {
    try {
      const res = await fetch(`/api/interview/${slug}`)
      if (!res.ok) throw new Error('Intervjuud ei leitud')
      const data = await res.json()
      setCompany(data.company)
      if (data.company.status === 'report_ready' || data.company.status === 'second_session_ready') {
        setReport(data.report || '')
        const s2 = data.questions.filter((q: Question) => q.session_number === 2)
        setNextSessionQuestions(s2)
        setStage('report')
        return
      }
      const s1 = data.questions.filter((q: Question) => q.session_number === 1)
      setQuestions(s1)
      setEditableQuestions(s1)
      setStage('preview')
    } catch (e: any) { setError(e.message); setStage('error') }
  }
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(1000)
      setIsRecording(true)
    } catch { alert(t('Palun luba mikrofon brauseris.', 'Please allow microphone access.')) }
  }
  const startFreeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(1000)
      setIsRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s + 1 >= MAX_FREE_SECONDS) { stopFreeRecording(); return s }
          return s + 1
        })
      }, 1000)
    } catch { alert(t('Palun luba mikrofon brauseris.', 'Please allow microphone access.')) }
  }
  const stopFreeRecording = async () => {
    if (!mediaRecorderRef.current || !company) return
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    await new Promise<void>(resolve => { mediaRecorderRef.current!.onstop = () => resolve(); mediaRecorderRef.current!.stop() })
    streamRef.current?.getTracks().forEach(t => t.stop())
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    setProcessingMessage(t('Töötleme salvestust... ~30-60 sekundit', 'Processing recording... ~30-60 seconds'))
    setStage('processing')
    const fd = new FormData()
    fd.append('audio', blob, 'answer.webm')
    fd.append('companyId', company.id)
    fd.append('questionId', questions[0]?.id || '')
    fd.append('sessionNumber', sessionNumber.toString())
    fd.append('language', company.language)
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      await generateReport()
    } catch { setError(t('Salvestuse töötlemine ebaõnnestus.', 'Failed to process recording.')); setStage('error') }
  }
  const stopAndTranscribe = async () => {
    if (!mediaRecorderRef.current || !company) return
    setIsRecording(false)
    await new Promise<void>(resolve => { mediaRecorderRef.current!.onstop = () => resolve(); mediaRecorderRef.current!.stop() })
    streamRef.current?.getTracks().forEach(t => t.stop())
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const q = editableQuestions[currentQuestionIndex]
    setProcessingMessage(t('Salvestan vastust...', 'Saving your answer...'))
    setStage('processing')
    const fd = new FormData()
    fd.append('audio', blob, 'answer.webm')
    fd.append('companyId', company.id)
    fd.append('questionId', q.id)
    fd.append('sessionNumber', sessionNumber.toString())
    fd.append('language', company.language)
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      if (currentQuestionIndex < editableQuestions.length - 1) { setCurrentQuestionIndex(p => p + 1); setStage('recording') }
      else { await generateReport() }
    } catch { setStage('recording') }
  }
  const generateReport = async () => {
    if (!company) return
    setProcessingMessage(t('Genereerime raporti... ~30 sekundit', 'Generating report... ~30 seconds'))
    setStage('processing')
    try {
      const res = await fetch('/api/generate-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, sessionNumber }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReport(data.executiveSummary)
      const res2 = await fetch(`/api/interview/${slug}`)
      const data2 = await res2.json()
      setNextSessionQuestions(data2.questions.filter((q: Question) => q.session_number === 2))
      setStage('report')
    } catch (e: any) { setError(e.message); setStage('error') }
  }
  const startSecondSession = async () => {
    const res = await fetch(`/api/interview/${slug}`)
    const data = await res.json()
    const s2 = data.questions.filter((q: Question) => q.session_number === 2)
    setQuestions(s2); setEditableQuestions(s2); setSessionNumber(2); setCurrentQuestionIndex(0); setStage('preview')
  }
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const progress = editableQuestions.length > 0 ? (currentQuestionIndex / editableQuestions.length) * 100 : 0
  const q = editableQuestions[currentQuestionIndex]
  if (stage === 'loading') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-400">Laadin...</p></div></div>
  if (stage === 'error') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-red-400 text-xl">{error}</p></div>
  if (stage === 'preview') return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-2xl">📋</span></div>
          <h1 className="text-3xl font-bold mb-2">{t(`Tere, ${company?.person_name}`, `Hello, ${company?.person_name}`)}</h1>
          <p className="text-gray-400 mb-1">{company?.company_name} · {company?.person_role}</p>
          <p className="text-gray-500 text-sm">{sessionNumber === 1 ? t('Sessioon 1 · ~10-15 min', 'Session 1 · ~10-15 min') : t('Sessioon 2 · ~30-40 min', 'Session 2 · ~30-40 min')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{t('Siin on küsimused mida sinult küsitakse', 'Here are the questions you will be asked')}</h2>
          <p className="text-gray-500 text-sm mb-5">{t('Saad küsimusi muuta enne vastamist. Klõpsa küsimusel et muuta.', 'You can edit questions before answering. Click a question to edit.')}</p>
          <div className="space-y-3">
            {editableQuestions.map((q, i) => (
              <div key={q.id} className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold text-sm mt-0.5 shrink-0">{i + 1}.</span>
                  {editingIndex === i ? (
                    <div className="flex-1">
                      <textarea className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-500 border border-gray-600" rows={3} value={q.question_text} onChange={e => { const updated = [...editableQuestions]; updated[i] = { ...updated[i], question_text: e.target.value }; setEditableQuestions(updated) }} onBlur={() => setEditingIndex(null)} autoFocus />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-start justify-between gap-2">
                      <p className="text-gray-200 text-sm leading-relaxed">{q.question_text}</p>
                      <button onClick={() => setEditingIndex(i)} className="text-gray-500 hover:text-blue-400 text-xs shrink-0 mt-0.5">✏️</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold text-sm mt-0.5 shrink-0">{editableQuestions.length + 1}.</span>
                <p className="text-gray-400 text-sm italic">{t('Kas soovid ise midagi lisada mida me ei küsinud?', 'Is there anything you would like to add that we did not ask?')}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => setStage('welcome')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">
            🎙️ {t('Intervjueeritav vastab ise →', 'Interviewee answers themselves →')}
          </button>
          <button onClick={() => setStage('free_recording')} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-lg px-10 py-4 rounded-2xl transition w-full">
            🎤 {t('Intervjueerija salvestab vestluse →', 'Interviewer records conversation →')}
          </button>
        </div>
      </div>
    </div>
  )
  if (stage === 'free_recording') return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-2xl">🎤</span></div>
          <h1 className="text-2xl font-bold mb-2">{t('Vaba salvestus', 'Free recording')}</h1>
          <p className="text-gray-400 text-sm">{t('Intervjueerija küsib küsimusi ise. Salvestame kogu vestluse.', 'Interviewer asks questions themselves. We record the full conversation.')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('Küsimuste viide', 'Question reference')}</h3>
          <div className="space-y-2">
            {editableQuestions.map((q, i) => (
              <div key={q.id} className="flex gap-2 text-sm">
                <span className="text-purple-400 font-bold shrink-0">{i + 1}.</span>
                <p className="text-gray-300">{q.question_text}</p>
              </div>
            ))}
          </div>
        </div>
        {!isRecording ? (
          <button onClick={startFreeRecording} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">
            🎙️ {t('Alusta salvestust', 'Start recording')}
          </button>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400 font-bold text-2xl">{formatTime(recordingSeconds)}</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">{t(`Maksimaalne aeg: 90 min`, `Maximum time: 90 min`)}</p>
            <button onClick={stopFreeRecording} className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">
              ⏹ {t('Lõpeta salvestus ja genereeri raport', 'Stop recording and generate report')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
  if (stage === 'welcome') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><span className="text-2xl">🎙️</span></div>
        <h1 className="text-3xl font-bold text-white mb-2">{t('Valmis alustama?', 'Ready to start?')}</h1>
        <p className="text-gray-400 mb-8 text-sm">{t('Üks küsimus korraga. Vajuta "Alusta" ja räägi vastus.', 'One question at a time. Press "Start" and speak your answer.')}</p>
        <button onClick={() => setStage('recording')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">{t('Alusta →', 'Start →')}</button>
      </div>
    </div>
  )
  if (stage === 'processing') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-300 text-lg">{processingMessage}</p></div></div>
  if (stage === 'recording' && q) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="h-1 bg-gray-800"><div className="h-1 bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full">
          <p className="text-gray-500 text-sm text-center mb-6">{t(`Küsimus ${currentQuestionIndex + 1} / ${editableQuestions.length + 1}`, `Question ${currentQuestionIndex + 1} / ${editableQuestions.length + 1}`)}</p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
            <p className="text-white text-xl leading-relaxed text-center">
              {currentQuestionIndex === editableQuestions.length ? t('Kas soovid ise midagi lisada mida me ei küsinud?', 'Is there anything you would like to add that we did not ask?') : q.question_text}
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            {!isRecording
              ? <button onClick={startRecording} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full max-w-sm">🎙️ {t('Alusta vastamist', 'Start answering')}</button>
              : <div className="w-full max-w-sm"><div className="flex items-center justify-center gap-2 mb-4"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div><span className="text-red-400 font-medium">{t('Salvestamine...', 'Recording...')}</span></div><button onClick={stopAndTranscribe} className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">⏹ {t('Lõpeta ja järgmine', 'Stop and next')}</button></div>}
          </div>
        </div>
      </div>
    </div>
  )
  if (stage === 'report') return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10"><div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-2xl">✓</span></div><h1 className="text-3xl font-bold mb-2">{t('Intervjuu on valmis!', 'Interview complete!')}</h1><p className="text-gray-400">{company?.person_name} · {company?.company_name}</p></div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6"><h2 className="text-xl font-semibold mb-4">Executive Summary</h2><div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{report}</div></div>
        <div className="flex gap-3 mb-8"><button onClick={() => window.print()} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition">🖨️ {t('Salvesta PDF', 'Save as PDF')}</button></div>
        {nextSessionQuestions.length > 0 && (
          <div className="bg-blue-950 border border-blue-800 rounded-2xl p-6 mb-4">
            <h3 className="text-lg font-semibold mb-2">{t('Teine sessioon — küsimuste eelvaade', 'Second session — question preview')}</h3>
            <p className="text-blue-300 text-sm mb-4">{t('Põhjalikum intervjuu ~30-40 minutit.', 'Deeper interview ~30-40 minutes.')}</p>
            <div className="space-y-2 mb-5">
              {nextSessionQuestions.slice(0, 5).map((q, i) => (
                <div key={q.id} className="flex gap-2 text-sm">
                  <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                  <p className="text-blue-200">{q.question_text}</p>
                </div>
              ))}
              {nextSessionQuestions.length > 5 && <p className="text-blue-400 text-sm">+{nextSessionQuestions.length - 5} {t('küsimust veel...', 'more questions...')}</p>}
            </div>
            <button onClick={startSecondSession} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl transition w-full mb-3">{t('Alusta teist sessiooni →', 'Start second session →')}</button>
            <div className="text-center">
              <p className="text-blue-400 text-xs mb-1">{t('Ei pea kohe tegema — broneeri aeg:', 'No need to do it now — schedule a time:')}</p>
              <a href="https://calendly.com" target="_blank" className="text-blue-300 text-sm underline hover:text-blue-200">{t('📅 Broneeri järgmine sessioon kalendrist', '📅 Book next session in calendar')}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
  return null
}