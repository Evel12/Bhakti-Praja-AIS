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

  return <main className="fixed inset-0 z-[100] h-dvh w-screen max-w-none overflow-hidden bg-[#865B2D]" style={{ width: '100vw', maxWidth: 'none', margin: 0, background: '#865B2D' }}>
    {!loaded && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#EFEFE8] text-sm text-slate-600">Memuat assessment asli...</div>}
    <iframe key={`${user.id}-${generation}`} ref={frameRef} title="Assessment" src={`/assessment-app/index.html?embedded=1#${home}`} onLoad={() => setLoaded(true)} className="block h-full w-full border-0 bg-[#865B2D]" />
  </main>
}
