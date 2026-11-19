import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createResource, updateResource, deleteResource } from '../api'
import { Alert, Dialog, Field, Select } from './academic-ui'
import { allRecords, inputClass, primaryClass, secondaryClass, localDate, message } from './academic-data'

const days = [['monday', 'Senin'], ['tuesday', 'Selasa'], ['wednesday', 'Rabu'], ['thursday', 'Kamis'], ['friday', 'Jumat'], ['saturday', 'Sabtu'], ['sunday', 'Minggu']]
const titles = { 'class-students': 'Pembagian Kelas', 'academic-registrations': 'Registrasi Akademik', 'teaching-loads': 'Beban Mengajar', schedules: 'Jadwal Pembelajaran' }
const explanations = { 'class-students': 'Pilih kelas dan semester, lalu centang siswa yang akan ditempatkan. Riwayat penempatan tetap tersimpan.', 'academic-registrations': 'Daftarkan siswa pada semester terpilih, kemudian setujui atau tolak registrasinya langsung dari daftar.', 'teaching-loads': 'Tentukan mata pelajaran, guru, dan jumlah jam mingguan untuk kelas yang dipilih.', schedules: 'Susun pelajaran per hari. Kelas dan periode mengikuti pilihan di atas; benturan guru, kelas, dan ruang diperiksa server.' }
const statusLabels = { active: 'Aktif', inactive: 'Nonaktif', pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }

export default function AcademicWorkspace({ resource }) {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({})
  const [items, setItems] = useState([])
  const [year, setYear] = useState(params.get('academic_year_id') || '')
  const [semester, setSemester] = useState(params.get('semester_id') || '')
  const [classroom, setClassroom] = useState(params.get('classroom_id') || '')
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [showCandidates, setShowCandidates] = useState(false)
  const roster = resource === 'class-students'
  const registrations = resource === 'academic-registrations'
  const schedule = resource === 'schedules'
  async function reload() { setItems(await allRecords(resource)) }
  useEffect(() => {
    let alive = true
    const lookups = ['academic-years', 'semesters', 'classrooms', ...(roster || registrations ? ['students'] : ['teachers', 'subjects', 'rooms'])]
    Promise.all([allRecords(resource), ...lookups.map(allRecords)]).then(([records, ...lists]) => {
      if (!alive) return
      const result = Object.fromEntries(lookups.map((key, i) => [key, lists[i]]))
      setData(result); setItems(records)
      const currentYear = params.get('academic_year_id') || result['academic-years'].find(y => y.status === 'active')?.id || ''
      setYear(String(currentYear))
      const currentSemester = params.get('semester_id') || result.semesters.find(s => String(s.academic_year_id) === String(currentYear) && s.status === 'active')?.id || ''
      setSemester(String(currentSemester))
    }).catch(e => { if (alive) setError(message(e)) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // Context is initialized once. Changes below are local and reflected in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource])
  function context(nextYear, nextSemester, nextClassroom) {
    setYear(nextYear); setSemester(nextSemester); setClassroom(nextClassroom); setSelected([]); setShowCandidates(false); setNotice(''); setError('')
    setParams({ ...(nextYear ? { academic_year_id: nextYear } : {}), ...(nextSemester ? { semester_id: nextSemester } : {}), ...(nextClassroom ? { classroom_id: nextClassroom } : {}) }, { replace: true })
  }
  const semesters = (data.semesters || []).filter(s => String(s.academic_year_id) === String(year))
  const classes = (data.classrooms || []).filter(c => String(c.academic_year_id) === String(year))
  const ready = Boolean(year && semester && (registrations || classroom))
  const visible = items.filter(i => (String(i.semester_id ?? '') === String(semester) || (roster && i.semester_id == null && String(i.academic_year_id) === String(year))) && (registrations || String(i.classroom_id) === String(classroom)))
  const classInfo = classes.find(c => String(c.id) === String(classroom))
  const samePeriod = i => String(i.academic_year_id) === String(year) && (i.semester_id == null || String(i.semester_id) === String(semester))
  const available = (data.students || []).filter(student => student.status === 'active' && student.name.toLowerCase().includes(search.toLowerCase()) && !items.some(i => i.student_id === student.id && samePeriod(i) && (!roster || i.status === 'active')))
  const nameOf = (target, id) => data[target]?.find(record => String(record.id) === String(id))?.name || '—'
  function toggle(id) { setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]) }
  async function addSelected() {
    if (!ready || !selected.length) return
    setBusy(true); setError(''); setNotice('')
    const failed = [], succeeded = []
    // Each existing API request is independent. Partial successes are reported explicitly.
    for (const id of selected) {
      try {
        const existing = roster && items.find(i => i.student_id === id && String(i.classroom_id) === String(classroom) && String(i.semester_id ?? '') === String(semester) && String(i.academic_year_id) === String(year))
        const payload = { student_id: id, academic_year_id: year, semester_id: semester, ...(roster ? { classroom_id: classroom, status: 'active', assigned_at: localDate() } : { status: 'pending', registered_at: localDate() }) }
        if (existing) await updateResource(resource, existing.id, payload)
        else await createResource(resource, payload)
        succeeded.push(id)
      } catch (e) { failed.push(`${nameOf('students', id)}: ${message(e)}`) }
    }
    setSelected(old => old.filter(id => !succeeded.includes(id)))
    setNotice(succeeded.length ? `${succeeded.length} siswa berhasil ${roster ? 'ditempatkan' : 'didaftarkan'}.` : '')
    setError(failed.join(' '))
    try { await reload() } catch (e) { setError(previous => `${previous} ${message(e)}`) } finally { setBusy(false) }
  }
  async function status(item, next) {
    if (!window.confirm(`${statusLabels[next]}: ${nameOf('students', item.student_id)}?`)) return
    setBusy(true); setError(''); setNotice('')
    try { await updateResource(resource, item.id, { status: next }); await reload(); setNotice('Status diperbarui.') }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  function open(item = null, day = 'monday', teacher = '') {
    setError(''); setNotice('')
    setForm(item ? { ...item, start_time: item.start_time?.slice(0, 5), end_time: item.end_time?.slice(0, 5), room_id: item.room_id || '' } : { teacher_id: teacher, subject_id: '', classroom_id: classroom, semester_id: semester, academic_year_id: year, status: 'active', weekly_hours: 2, day, start_time: '07:00', end_time: '08:00', room_id: '' })
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const payload = schedule ? { subject_id: form.subject_id, classroom_id: classroom, teacher_id: form.teacher_id, room_id: form.room_id || null, day: form.day, start_time: form.start_time, end_time: form.end_time, semester_id: semester, academic_year_id: year, status: form.status } : { teacher_id: form.teacher_id, subject_id: form.subject_id, classroom_id: classroom, semester_id: semester, weekly_hours: Number(form.weekly_hours), status: form.status }
      if (form.id) await updateResource(resource, form.id, payload)
      else await createResource(resource, payload)
      setForm(null); setNotice('Penugasan tersimpan.'); await reload()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function remove(item) {
    if (!window.confirm('Hapus penugasan ini?')) return
    setBusy(true); setError('')
    try { await deleteResource(resource, item.id); await reload() } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <section className="space-y-5"><div><h1 className="text-3xl font-bold">{titles[resource]}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{explanations[resource]}</p></div>{!form && <Alert>{error}</Alert>}<Alert success>{notice}</Alert>
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3"><Select label="1. Tahun ajaran" disabled={busy || loading} value={year} items={data['academic-years']} onChange={v => context(v, '', '')} /><Select label="2. Semester" disabled={busy || !year} value={semester} items={semesters} onChange={v => context(year, v, classroom)} />{!registrations && <Select label="3. Kelas" disabled={busy || !year} value={classroom} items={classes} onChange={v => context(year, semester, v)} />}</div>
    {loading ? <p role="status">Memuat ruang kerja...</p> : !ready ? <p className="rounded-2xl bg-slate-100 p-6 text-sm text-slate-600">Pilih {registrations ? 'tahun ajaran dan semester' : 'tahun ajaran, semester, dan kelas'} untuk memulai. Data periode dan kelas dibuat melalui menu administrasi.</p> : <>
      {classInfo && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-50 p-4"><p className="text-sm text-teal-900"><strong>{classInfo.name}</strong> · Wali kelas: {classInfo.homeroom_teacher?.name || 'Belum ditetapkan'}</p><Link to="/classrooms" className="text-sm font-semibold text-teal-800 underline">Atur wali kelas</Link></div>}
      {roster || registrations ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{roster ? 'Anggota kelas' : 'Daftar registrasi'} ({visible.length})</h2><button className={primaryClass} disabled={busy} onClick={() => { setShowCandidates(!showCandidates); setSelected([]) }}>{showCandidates ? 'Tutup pemilihan' : roster ? 'Pilih siswa untuk kelas' : 'Daftarkan siswa'}</button></div>
        {showCandidates && <div className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5"><Field label="Cari siswa aktif"><input className={inputClass} placeholder="Nama siswa" value={search} onChange={e => setSearch(e.target.value)} /></Field><p className="text-xs text-slate-500">{roster ? 'Siswa dengan penempatan aktif pada periode yang sama tidak ditawarkan. Nonaktifkan penempatan lama sebelum memindahkan siswa.' : 'Siswa yang sudah memiliki registrasi pada semester ini tidak ditawarkan.'}</p><div className="max-h-72 space-y-2 overflow-y-auto">{available.map(student => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"><input type="checkbox" disabled={busy} checked={selected.includes(student.id)} onChange={() => toggle(student.id)} /><span className="text-sm">{student.name}<span className="ml-2 text-slate-400">{student.student_number}</span></span></label>)}{!available.length && <p className="text-sm text-slate-500">Tidak ada siswa yang sesuai.</p>}</div><button disabled={busy || !selected.length} className={primaryClass} onClick={addSelected}>{busy ? 'Memproses...' : `${roster ? 'Tempatkan' : 'Daftarkan'} ${selected.length} siswa`}</button></div>}
        <div className="divide-y rounded-2xl border border-slate-200 bg-white">{visible.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{nameOf('students', item.student_id)}</p><p className="mt-1 text-xs text-slate-500">{statusLabels[item.status]}{item.registration_number ? ` · ${item.registration_number}` : ''}</p></div><div className="flex flex-wrap gap-2">{roster ? <button disabled={busy} onClick={() => status(item, item.status === 'active' ? 'inactive' : 'active')} className={secondaryClass}>{item.status === 'active' ? 'Nonaktifkan penempatan' : 'Aktifkan kembali'}</button> : <>{item.status !== 'approved' && <button disabled={busy} onClick={() => status(item, 'approved')} className={primaryClass}>Setujui</button>}{item.status !== 'rejected' && <button disabled={busy} onClick={() => status(item, 'rejected')} className={secondaryClass}>Tolak</button>}{item.status !== 'cancelled' && <button disabled={busy} onClick={() => status(item, 'cancelled')} className={secondaryClass}>Batalkan</button>}</>}</div></article>)}{!visible.length && <p className="p-6 text-sm text-slate-500">Belum ada data pada periode ini.</p>}</div>
      </> : schedule ? <><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Agenda mingguan · {classInfo?.name}</h2><button className={primaryClass} disabled={busy} onClick={() => open()}>Tambah pelajaran</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{days.map(([day, label]) => <section key={day} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-bold">{label}</h3><button aria-label={`Tambah pelajaran ${label}`} className="rounded-lg px-3 py-1 text-teal-800 hover:bg-teal-50" onClick={() => open(null, day)}>+ Tambah</button></div>{visible.filter(item => item.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(item => <article key={item.id} className={`rounded-xl border p-3 ${item.status === 'active' ? 'border-teal-100 bg-teal-50/50' : 'border-slate-100 bg-slate-50'}`}><p className="text-xs font-semibold text-teal-800">{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)} · {statusLabels[item.status]}</p><h4 className="mt-1 font-semibold">{nameOf('subjects', item.subject_id)}</h4><p className="mt-1 text-sm text-slate-600">{nameOf('teachers', item.teacher_id)}<br />Ruang: {nameOf('rooms', item.room_id)}</p><div className="mt-3 flex gap-3"><button disabled={busy} onClick={() => open(item)} className="text-sm font-semibold text-teal-800">Ubah</button><button disabled={busy} onClick={() => remove(item)} className="text-sm text-red-700">Hapus</button></div></article>)}{!visible.some(item => item.day === day) && <p className="py-4 text-xs text-slate-400">Belum ada pelajaran.</p>}</section>)}</div></> : <><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Penugasan guru · {classInfo?.name}</h2><button disabled={busy} className={primaryClass} onClick={() => open()}>Tugaskan guru</button></div><div className="grid gap-4 md:grid-cols-2">{[...new Set(visible.map(i => i.teacher_id))].map(id => {
        const loads = visible.filter(i => i.teacher_id === id)
        return <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-bold">{nameOf('teachers', id)}</h3><p className="mt-1 text-sm text-slate-500">{loads.filter(i => i.status === 'active').reduce((sum, i) => sum + Number(i.weekly_hours), 0)} jam aktif / minggu di kelas ini</p><div className="mt-4 divide-y">{loads.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="text-sm">{nameOf('subjects', item.subject_id)} · {item.weekly_hours} jam · {statusLabels[item.status]}</span><div className="flex gap-3"><button disabled={busy} onClick={() => open(item)} className="text-sm text-teal-800">Ubah</button><button disabled={busy} onClick={() => remove(item)} className="text-sm text-red-700">Hapus</button></div></div>)}</div><button className="mt-3 text-sm font-semibold text-teal-800" onClick={() => open(null, 'monday', id)}>+ Mata pelajaran lain</button></article>
      })}{!visible.length && <p className="p-6 text-sm text-slate-500">Belum ada penugasan guru.</p>}</div></>}
    </>}
    {form && <Dialog title={schedule ? 'Atur pelajaran' : 'Tugaskan guru'} onClose={() => setForm(null)} busy={busy}><form onSubmit={save} className="space-y-4"><Alert>{error}</Alert><p className="rounded-xl bg-slate-50 p-3 text-sm">{classInfo?.name} · {semesters.find(s => String(s.id) === String(semester))?.name}</p><Select required label="Mata pelajaran" items={(data.subjects || []).filter(s => !s.study_program_id || s.study_program_id === classInfo?.study_program_id || s.id === form.subject_id)} value={form.subject_id} onChange={v => setForm({ ...form, subject_id: v })} /><Select required label="Guru" items={(data.teachers || []).filter(t => t.status === 'active' || t.id === form.teacher_id)} value={form.teacher_id} onChange={v => setForm({ ...form, teacher_id: v })} />{schedule ? <><Field label="Hari"><select className={inputClass} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>{days.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><div className="grid grid-cols-2 gap-4"><Field label="Mulai"><input required type="time" className={inputClass} value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></Field><Field label="Selesai"><input required type="time" className={inputClass} value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></Field></div><Select label="Ruang (opsional)" value={form.room_id} items={data.rooms} onChange={v => setForm({ ...form, room_id: v })} /></> : <Field label="Jam mengajar per minggu"><input required type="number" min={1} max={168} className={inputClass} value={form.weekly_hours} onChange={e => setForm({ ...form, weekly_hours: e.target.value })} /></Field>}<Field label="Status"><select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></Field><button disabled={busy} className={primaryClass}>{busy ? 'Menyimpan...' : 'Simpan penugasan'}</button></form></Dialog>}
  </section>
}
