import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const HOME_BY_ROLE = { murid: '/student', guru: '/dashboard', admin: '/dashboard' }

export default function AssessmentPage({ user }) {
  const [loaded, setLoaded] = useState(false)
  const [generation, setGeneration] = useState(0)
  const frameRef = useRef(null)
  const navigate = useNavigate()
  const roles = ['admin', 'guru', 'murid']
  if (!roles.includes(user.role)) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Akun Anda tidak memiliki akses ke ruang assessment.</div>
  const home = HOME_BY_ROLE[user.role] || '/dashboard'
  const frameUrl = new URL('/assessment-app/index.html', window.location.origin)
  frameUrl.searchParams.set('embedded', '1')
  frameUrl.hash = home
  const sendSession = (target) => target?.postMessage({
    type: 'ais-session',
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }, window.location.origin)

  // Hand the authenticated AIS session to the embedded assessment app
  // when it signals that it is ready (embedded SSO bridge).
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === 'assessment-ready') {
        sendSession(event.source)
      } else if (event.data?.type === 'assessment-navigate' && event.data?.path === '/lms' && ['admin', 'guru', 'murid'].includes(user.role)) {
        navigate('/lms')
      } else if (event.data?.type === 'assessment-navigate' && event.data?.path === '/') {
        navigate('/')
      } else if (event.data?.type === 'ais-logout') {
        window.dispatchEvent(new Event('assessment-logout-request'))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [user, generation, navigate])

  function handleFrameLoad() {
    setLoaded(true)
    // The child posts its ready message during startup; answer here too in
    // case that message arrived before the parent listener was attached.
    sendSession(frameRef.current?.contentWindow)
  }

  return <main className="fixed inset-0 z-[100] h-dvh w-screen max-w-none overflow-hidden bg-[#f6f8fc]" style={{ width: '100vw', maxWidth: 'none', margin: 0, background: '#f6f8fc' }}>
    {!loaded && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#f6f8fc] text-sm text-slate-600">Memuat assessment asli...</div>}
    <iframe key={`${user.id}-${generation}`} ref={frameRef} title="Assessment" src={frameUrl.toString()} onLoad={handleFrameLoad} className="block h-full w-full border-0 bg-[#f6f8fc]" />
  </main>
}

