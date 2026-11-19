import { Suspense, lazy } from 'react'
import AdminAssessmentOverview from './AdminAssessmentOverview'

const AssessmentHost = lazy(() => import('./AssessmentHost'))
const ALLOWED_ROLES = ['admin', 'guru', 'murid']

export default function AssessmentPage({ user }) {
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        Akun Anda tidak memiliki akses ke ruang assessment.
      </div>
    )
  }

  if (user.role === 'admin') {
    return <AdminAssessmentOverview user={user} />
  }

  return (
    <Suspense
      fallback={
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Menyiapkan ruang assessment...
        </div>
      }
    >
      <AssessmentHost user={user} />
    </Suspense>
  )
}
