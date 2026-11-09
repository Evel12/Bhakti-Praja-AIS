import { useEffect, useRef, useState } from 'react'

const HOME_BY_ROLE = { murid: '/student', guru: '/dashboard', admin: '/dashboard' }

export default function AssessmentPage({ user }) {
  const [loaded, setLoaded] = useState(false)
  const [generation, setGeneration] = useState(0)
  const frameRef = useRef(null)
  const roles = ['admin', 'guru', 'murid']
  if (!roles.includes(user.role)) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Akun Anda tidak memiliki akses ke ruang assessment.</div>
  const home = HOME_BY_ROLE[user.role] || '/dashboard'

  // Hand the authenticated AIS session to the embedded assessment app
  // when it signals that it is ready (embedded SSO bridge).
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type !== 'assessment-ready' || event.source !== frameRef.current?.contentWindow) return
      event.source.postMessage({
        type: 'ais-session',
        token: localStorage.getItem('ais_token'),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      }, window.location.origin)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [user, generation])

  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">Assessment Pembelajaran</h1><p className="mt-1 text-sm text-slate-500">Ruang tugas, kuis, ujian, dan hasil pembelajaran.</p></div>
      <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => { setLoaded(false); setGeneration(value => value + 1) }}>Muat ulang assessment</button>
    </div>
    {!loaded && <p role="status" className="text-sm text-slate-500">Memuat ruang assessment...</p>}
    <iframe key={`${user.id}-${generation}`} ref={frameRef} title="Ruang assessment pembelajaran" src={`/assessment-app/?embedded=1#${home}`} onLoad={() => setLoaded(true)} className="block w-full rounded-xl border border-slate-200 bg-white" style={{ height: 'max(720px, calc(100dvh - 220px))' }} />
  </section>
}
