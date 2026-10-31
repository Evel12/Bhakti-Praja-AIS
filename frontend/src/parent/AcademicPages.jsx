import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Detail, Empty, Field, Page, Pager, QueryState, Table } from '../finance/shared'
import { date, fieldClass, panelClass, secondaryClass, useFinanceQuery } from '../finance/finance'
import { academicSections, days, parentLink, studentStatuses } from './parent'

export function Unavailable({ message }) {
  return <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-semibold text-slate-700">Belum tersedia</p><p className="mt-2 text-sm leading-6 text-slate-500">{message}</p></div>
}

export function AcademicPage({ studentId, section }) {
  const query = useFinanceQuery(`parent/children/${studentId}/${section}`)
  const info = academicSections[section]
  return <Page eyebrow="Portal Wali Murid" title={info.title} subtitle={info.description}>
    <QueryState query={query} loadingLabel="Memuat informasi akademik...">{response => <Unavailable message={response.message} />}</QueryState>
    {section === 'progress' && <div className={panelClass}>
      <h2 className="font-semibold text-slate-900">Informasi Pendukung</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Nilai, kehadiran, dan tugas dapat dipantau ketika informasi telah tersedia.</p>
      <div className="mt-4 flex flex-wrap gap-3">{['grades', 'attendance', 'assignments'].map(key => <Link key={key} className={secondaryClass} to={parentLink(key, studentId)}>{academicSections[key].title}</Link>)}</div>
    </div>}
  </Page>
}

export function ChildInformation({ studentId }) {
  const query = useFinanceQuery(`parent/children/${studentId}`)
  return <Page eyebrow="Portal Wali Murid" title="Informasi Anak" subtitle="Data siswa dan penempatan kelas yang tercatat di sekolah.">
    <QueryState query={query} loadingLabel="Memuat informasi anak...">{({ data: child }) => <>
      <section className={panelClass}><h2 className="mb-5 text-lg font-semibold text-slate-900">{child.name}</h2>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Nomor induk siswa">{child.student_number}</Detail><Detail label="Status siswa">{studentStatuses[child.status] ?? 'Tidak diketahui'}</Detail>
          <Detail label="Jenis kelamin">{{ L: 'Laki-laki', P: 'Perempuan' }[child.gender]}</Detail><Detail label="Tanggal lahir">{date(child.birth_date)}</Detail>
        </dl>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="px-5 pt-5 font-semibold text-slate-900">Penempatan Kelas Aktif</h2>
        {child.placements.length ? <Table headers={['Kelas', 'Konsentrasi keahlian', 'Tahun ajaran', 'Semester']}>{child.placements.map(p => <tr key={p.id}><td>{p.classroom?.name ?? '—'}</td><td>{p.classroom?.study_program?.name ?? '—'}</td><td>{p.academic_year?.name ?? '—'}</td><td>{p.semester?.name ?? 'Seluruh semester'}</td></tr>)}</Table> : <Empty>Belum ada penempatan kelas aktif.</Empty>}
      </section>
    </>}</QueryState>
  </Page>
}

function ScheduleRecords({ studentId, placements }) {
  const [filters, setFilters] = useState({ academic_year_id: '', semester_id: '', page: 1 })
  const params = new URLSearchParams({ page: filters.page, per_page: 15 })
  if (filters.academic_year_id) params.set('academic_year_id', filters.academic_year_id)
  if (filters.semester_id) params.set('semester_id', filters.semester_id)
  const query = useFinanceQuery(`parent/children/${studentId}/schedules?${params}`)
  const years = [...new Map(placements.filter(p => p.academic_year).map(p => [p.academic_year.id, p.academic_year])).values()]
  const semesters = [...new Map(placements.filter(p => p.semester && (!filters.academic_year_id || String(p.academic_year_id) === filters.academic_year_id)).map(p => [p.semester.id, p.semester])).values()]
  return <>
    <div className={`${panelClass} flex flex-wrap gap-4`}>
      <Field label="Tahun ajaran"><select className={fieldClass} value={filters.academic_year_id} onChange={e => setFilters({ academic_year_id: e.target.value, semester_id: '', page: 1 })}><option value="">Semua tahun ajaran</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
      {semesters.length > 0 && <Field label="Semester"><select className={fieldClass} value={filters.semester_id} onChange={e => setFilters({ ...filters, semester_id: e.target.value, page: 1 })}><option value="">Semua semester</option>{semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
    </div>
    <QueryState query={query} loadingLabel="Memuat jadwal pelajaran...">{response => <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {response.data.length ? <Table headers={['Hari / waktu', 'Mata pelajaran', 'Guru', 'Kelas / ruang', 'Periode']}>{response.data.map(s => <tr key={s.id}>
        <td className="whitespace-nowrap"><p className="font-medium">{days[s.day] ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} WIB</p></td>
        <td><p className="font-medium text-slate-900">{s.subject?.name ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{s.subject?.code}</p></td>
        <td>{s.teacher?.name ?? '—'}</td><td><p>{s.classroom?.name ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{s.room?.name ?? 'Ruang belum ditetapkan'}</p></td>
        <td><p>{s.academic_year?.name ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{s.semester?.name ?? '—'}</p></td>
      </tr>)}</Table> : <Empty>Belum ada jadwal pelajaran yang sesuai dengan penempatan kelas dan periode anak.</Empty>}
      <Pager meta={response.meta} onChange={page => setFilters({ ...filters, page })} />
    </div>}</QueryState>
  </>
}

export function SchedulePage({ studentId }) {
  const child = useFinanceQuery(`parent/children/${studentId}`)
  return <Page eyebrow="Portal Wali Murid" title="Jadwal Pelajaran" subtitle="Jadwal aktif sesuai penempatan kelas, tahun ajaran, dan semester anak.">
    <QueryState query={child} loadingLabel="Memuat periode belajar...">{({ data }) => <ScheduleRecords studentId={studentId} placements={data.placements} />}</QueryState>
  </Page>
}
