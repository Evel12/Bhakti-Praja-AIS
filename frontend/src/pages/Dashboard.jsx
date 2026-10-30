import {
  useEffect,
  useState
} from 'react'
import { useSchool } from '../school-context'

import {
  CalendarDays,
  BookOpen,
  GraduationCap,
  School,
  UserRound,
  Users,
  RefreshCw
} from 'lucide-react'

import {
  getDashboard
} from '../api'

const iconByResource = {
  students: GraduationCap,
  teachers: UserRound,
  parents: Users,
  classrooms: School,
  subjects: BookOpen,
  departments: School,
  'academic-registrations': CalendarDays,
}

const dayLabels = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
}

const statusLabels = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  graduated: 'Lulus',
  transferred: 'Pindah',
}

export default function Dashboard() {
  const school = useSchool()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const response = await getDashboard()
      setData(response.data)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Gagal memuat dashboard. Periksa koneksi lalu tekan Muat Ulang.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getDashboard()
      .then((response) => { if (active) setData(response.data) })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Gagal memuat dashboard. Periksa koneksi lalu tekan Muat Ulang.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-500">
        Memuat dashboard...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{error}</p>
        <button
          onClick={load}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-700"
        >
          <RefreshCw size={14} />
          Muat Ulang
        </button>
      </div>
    )
  }

  const summary = data?.summary || {}
  const regByStatus = summary.registrations_by_status || {}
  const studentsByStatus = summary.students_by_status || {}
  const levels = summary.classrooms_per_level || []
  const perDay = summary.schedules_per_day || {}

  const maxReg = Math.max(1, ...Object.values(regByStatus))
  const maxDay = Math.max(1, ...Object.values(perDay))

  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            DASHBOARD ADMIN
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Ringkasan Akademik
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pantau data sekolah, periode aktif, dan administrasi akademik dalam satu tempat.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Muat Ulang
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <section aria-label="Identitas sekolah" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">NPSN {school.npsn}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{school.name}</h2>
        <p className="mt-1 text-sm text-slate-600">{school.address}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
          {school.phone && <a href={`tel:${school.phone}`}>{school.phone}</a>}
          {school.email && <a href={`mailto:${school.email}`}>{school.email}</a>}
          {school.sources?.[0] && <a href={school.sources[0].url} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline">Identitas di Kemendikdasmen</a>}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(data?.stats || []).map((stat) => {
          const Icon = iconByResource[stat.resource] || School

          return (
            <div key={stat.resource} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-5 flex justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100">
                  <Icon size={21} className="text-slate-700" />
                </div>
              </div>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Tahun Ajaran Aktif">
          {data?.active_academic_year ? (
            <>
              <p className="text-2xl font-bold">{data.active_academic_year.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {String(data.active_academic_year.start_date || '').slice(0, 10)}
                {' — '}
                {String(data.active_academic_year.end_date || '').slice(0, 10)}
              </p>
            </>
          ) : (
            <Empty text="Belum ada tahun ajaran aktif." />
          )}
        </InfoCard>

        <InfoCard title="Semester Aktif">
          {data?.active_semester ? (
            <>
              <p className="text-2xl font-bold">{data.active_semester.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {data.active_semester.period || data.active_semester.academic_year?.name || '-'}
              </p>
            </>
          ) : (
            <Empty text="Belum ada semester aktif." />
          )}
        </InfoCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <InfoCard title="Registrasi per Status">
          {Object.keys(regByStatus).length === 0 ? (
            <Empty text="Belum ada registrasi." />
          ) : (
            <div className="space-y-3">
              {Object.entries(regByStatus).map(([status, total]) => (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-600">{statusLabels[status] || status}</span>
                    <span className="font-bold text-slate-900">{total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${Math.round((total / maxReg) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </InfoCard>

        <InfoCard title="Siswa per Status">
          {Object.keys(studentsByStatus).length === 0 ? (
            <Empty text="Belum ada data siswa." />
          ) : (
            <div className="space-y-2 text-sm">
              {Object.entries(studentsByStatus).map(([status, total]) => (
                <div key={status} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">{statusLabels[status] || status}</span>
                  <span className="font-bold text-slate-900">{total}</span>
                </div>
              ))}
            </div>
          )}
        </InfoCard>

        <InfoCard title="Jadwal Aktif per Hari">
          {Object.keys(perDay).length === 0 ? (
            <Empty text="Belum ada jadwal aktif." />
          ) : (
            <div className="space-y-3">
              {Object.entries(dayLabels).map(([day, label]) => {
                const total = perDay[day] || 0
                if (!total) return null
                return (
                  <div key={day}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-bold text-slate-900">{total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{ width: `${Math.round((total / maxDay) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </InfoCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Kelas per Tingkat">
          {levels.length === 0 ? (
            <Empty text="Belum ada data kelas." />
          ) : (
            <div className="space-y-2 text-sm">
              {levels.map((row) => (
                <div key={row.level} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Tingkat {row.level}</span>
                  <span className="font-bold text-slate-900">{row.total} kelas</span>
                </div>
              ))}
            </div>
          )}
        </InfoCard>

        <InfoCard title="Ringkasan Lainnya">
          <div className="space-y-2 text-sm">
            <Row label="Konsentrasi keahlian" value={summary.study_programs ?? 0} />
            <Row label="Penempatan kelas aktif" value={summary.active_class_assignments ?? 0} />
            <Row label="Jadwal aktif" value={summary.active_schedules ?? 0} />
          </div>
        </InfoCard>
      </div>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="mb-4 text-sm font-semibold text-slate-500">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  )
}

function Empty({ text }) {
  return <p className="text-sm text-slate-400">{text || 'Belum ada data.'}</p>
}
