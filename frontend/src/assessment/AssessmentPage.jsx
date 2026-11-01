import { useState } from 'react'

export default function AssessmentPage({ user }) {
  const [loaded, setLoaded] = useState(false)
  const [generation, setGeneration] = useState(0)
  if (!['admin', 'guru', 'murid'].includes(user.role)) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Akun Anda tidak memiliki akses ke ruang assessment.</div>
  const home = user.role === 'murid' ? '/student' : '/dashboard'
  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">Assessment Pembelajaran</h1><p className="mt-1 text-sm text-slate-500">Ruang tugas, kuis, ujian, dan hasil pembelajaran.</p></div>
      <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => { setLoaded(false); setGeneration(value => value + 1) }}>Muat ulang assessment</button>
    </div>
    {!loaded && <p role="status" className="text-sm text-slate-500">Memuat ruang assessment...</p>}
    <iframe key={`${user.id}-${generation}`} title="Ruang assessment pembelajaran" src={`/assessment-app/?embedded=1#${home}`} onLoad={() => setLoaded(true)} className="block w-full rounded-xl border border-slate-200 bg-white" style={{ height: 'max(720px, calc(100dvh - 220px))' }} />
  </section>
}
