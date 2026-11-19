import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { mountAssessmentApp } from '@assessment/integration/mountEmbedded.js'
import { getToken } from '../api'
import { useAssessmentShell } from './useAssessmentShell'

function toAssessmentSubpath(location) {
  const stripped = location.pathname.replace(/^\/assessment/, '') || '/'
  return `${stripped}${location.search || ''}`
}

export default function AssessmentHost({ user }) {
  const containerRef = useRef(null)
  const bridgeRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const locationPathnameRef = useRef(location.pathname)
  const { setUnreadCount, setExamMode } = useAssessmentShell()
  const [mounting, setMounting] = useState(true)
  const [mountError, setMountError] = useState('')
  const [retryTick, setRetryTick] = useState(0)

  const initialSubpathRef = useRef(toAssessmentSubpath(location))
  const lastVuePathRef = useRef('')

  useEffect(() => {
    navigateRef.current = navigate
    locationPathnameRef.current = location.pathname
  }, [navigate, location.pathname])

  useEffect(() => {
    let active = true
    const el = containerRef.current
    if (!el) return undefined

    mountAssessmentApp(el, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      aisToken: getToken(),
      initialSubpath: initialSubpathRef.current,
      onRouteChange(fullPath) {
        if (!active) return
        const hadPriorRoute = Boolean(lastVuePathRef.current)
        lastVuePathRef.current = fullPath
        const targetUrl = fullPath === '/' ? '/assessment' : `/assessment${fullPath}`
        const isBaseEntry = locationPathnameRef.current.replace(/\/+$/, '') === '/assessment'
        navigateRef.current(targetUrl, { replace: !hadPriorRoute && isBaseEntry })
      },
      onUnreadChange(count) {
        if (active) setUnreadCount(count)
      },
      onExamModeChange(isExam) {
        if (active) setExamMode(Boolean(isExam))
      },
      onUnauthorized() {
        window.dispatchEvent(new Event('ais-session-expired'))
      },
    })
      .then((bridge) => {
        if (!active) {
          bridge.destroy()
          return
        }
        bridgeRef.current = bridge
        setMounting(false)
      })
      .catch((err) => {
        if (!active) return
        setMountError(err?.message || 'Ruang assessment belum dapat dimuat.')
        setMounting(false)
      })

    return () => {
      active = false
      bridgeRef.current?.destroy()
      bridgeRef.current = null
      setExamMode(false)
      setUnreadCount(0)
    }
  }, [user.id, user.name, user.email, user.role, retryTick, setExamMode, setUnreadCount])

  useEffect(() => {
    const nextSubpath = toAssessmentSubpath({ pathname: location.pathname, search: location.search })
    initialSubpathRef.current = nextSubpath
    if (!bridgeRef.current) return
    if (nextSubpath === lastVuePathRef.current) return
    lastVuePathRef.current = nextSubpath
    bridgeRef.current.navigateTo(nextSubpath)
  }, [location.pathname, location.search])

  if (mountError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Gagal memuat ruang assessment</p>
        <p className="mt-1">{mountError}</p>
        <button
          type="button"
          onClick={() => {
            setMounting(true)
            setMountError('')
            setRetryTick((n) => n + 1)
          }}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Coba muat ulang
        </button>
      </div>
    )
  }

  return (
    <div className="relative min-w-0">
      {mounting && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Memuat ruang assessment & LMS...
        </div>
      )}
      <div ref={containerRef} className="assessment-root" hidden={mounting} />
    </div>
  )
}
