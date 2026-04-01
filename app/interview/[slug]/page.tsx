'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
type Company = { id: string; company_name: string; person_name: string; person_role: string; language: string; status: string }
type Question = { id: string; question_text: string; question_order: number; session_number: number }
type Stage = 'loading' | 'welcome' | 'recording' | 'processing' | 'report' | 'error'
export default function InterviewPage() {
  const params = useParams()
  const slug = params.slug as string
  const [stage, setStage] = useState<Stage>('loading')
  const [company, setCompany] = useState<Company | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [isRecording, setIsRecording] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const [processingMessage, setProcessingMessage] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
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
        if (data.company.status === 'second_session_ready') {
          setSessionNumber(2)
          setQuestions(data.questions.filter((q: Question) => q.session_number === 2))
        } else { setStage('report'); return }
      }
      const s1 = data.questions.filter((q: Question) => q.session_number === sessionNumber)
      setQuestions(s1)
      setStage('welcome')
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
  const stopAndTranscribe = async () => {
    if (!mediaRecorderRef.current || !company) return
    setIsRecording(false)
    await new Promise<void>(resolve => { mediaRecorderRef.current!.onstop = () => resolve(); mediaRecorderRef.current!.stop() })
    streamRef.current?.getTracks().forEach(t => t.stop())
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const q = questions[currentQuestionIndex]
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
      if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(p => p + 1); setStage('recording') }
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
      setStage('report')
    } catch (e: any) { setError(e.message); setStage('error') }
  }
  const startSecondSession = async () => {
    const res = await fetch(`/api/interview/${slug}`)
    const data = await res.json()
    setQuestions(data.questions.filter((q: Question) => q.session_number === 2))
    setSessionNumber(2); setCurrentQuestionIndex(0); setStage('welcome')
  }
  const progress = questions.length > 0 ? (currentQuestionIndex / questions.length) * 100 : 0
  const q = questions[currentQuestionIndex]
  if (stage === 'loading') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-400">Laadin...</p></div></div>
  if (stage === 'error') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-red-400 text-xl">{error}</p></div>
  if (stage === 'welcome') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><span className="text-2xl">🎙️</span></div>
        <h1 className="text-3xl font-bold text-white mb-2">{t(`Tere, ${company?.person_name}`, `Hello, ${company?.person_name}`)}</h1>
        <p className="text-gray-400 mb-2">{company?.company_name} · {company?.person_role}</p>
        <p className="text-gray-500 text-sm mb-8">{sessionNumber === 1 ? t('Sessioon 1 · ~10-15 min · 8 küsimust', 'Session 1 · ~10-15 min · 8 questions') : t('Sessioon 2 · ~30-40 min · 15 küsimust', 'Session 2 · ~30-40 min · 15 questions')}</p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 text-left"><p className="text-gray-300 text-sm leading-relaxed">{t('Kuuled küsimuse, vajutad "Alusta" ja räägid vastuse. Iga vastus salvestatakse automaatselt.', 'Read the question, press "Start" and speak your answer. Each answer saves automatically.')}</p></div>
        <button onClick={() => setStage('recording')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">{t('Alusta intervjuud →', 'Start interview →')}</button>
      </div>
    </div>
  )
  if (stage === 'processing') return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-300 text-lg">{processingMessage}</p></div></div>
  if (stage === 'recording' && q) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="h-1 bg-gray-800"><div className="h-1 bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full">
          <p className="text-gray-500 text-sm text-center mb-6">{t(`Küsimus ${currentQuestionIndex + 1} / ${questions.length}`, `Question ${currentQuestionIndex + 1} / ${questions.length}`)}</p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8"><p className="text-white text-xl leading-relaxed text-center">{q.question_text}</p></div>
          <div className="flex flex-col items-center gap-4">
            {!isRecording ? <button onClick={startRecording} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full max-w-sm">🎙️ {t('Alusta vastamist', 'Start answering')}</button> :
            <div className="w-full max-w-sm"><div className="flex items-center justify-center gap-2 mb-4"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div><span className="text-red-400 font-medium">{t('Salvestamine...', 'Recording...')}</span></div><button onClick={stopAndTranscribe} className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg px-10 py-4 rounded-2xl transition w-full">⏹ {t('Lõpeta ja järgmine', 'Stop and next')}</button></div>}
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
        <div className="bg-blue-950 border border-blue-800 rounded-2xl p-6 text-center"><h3 className="text-lg font-semibold mb-2">{t('Teine sessioon on valmis', 'Second session ready')}</h3><p className="text-blue-300 text-sm mb-4">{t('Põhjalikum intervjuu ~30-40 minutit.', 'Deeper interview ~30-40 minutes.')}</p><button onClick={startSecondSession} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl transition">{t('Alusta teist sessiooni →', 'Start second session →')}</button></div>
      </div>
    </div>
  )
  return null
}
