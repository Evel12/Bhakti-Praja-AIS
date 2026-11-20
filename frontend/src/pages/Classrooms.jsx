import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createResource, updateResource, deleteResource } from '../api'
import { Alert, Dialog, Field, Select } from './academic-ui'
import { allRecords, inputClass, primaryClass, secondaryClass, message } from './academic-data'

const levelMap = { X: '10', XI: '11', XII: '12', 10: '10', 11: '11', 12: '12' }
const levelLabels = { 10: 'X', 11: 'XI', 12: 'XII' }

function normalizeLevel(value) {
  const key = String(value ?? '').trim().toUpperCase()
  return levelMap[key] || String(value ?? '').trim()
}

function formatLevelLabel(value) {
  const normalized = normalizeLevel(value)
  return levelLabels[normalized] || value || '—'
}

export default function Classrooms() {
  const [data, setData] = useState({ classrooms: [], teachers: [], years: [], programs: [], placements: [] })
  const [year, setYear] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try {
      const [classrooms, teachers, years, programs, placements] = await Promise.all(['classrooms', 'teachers', 'academic-years', 'study-programs', 'class-students'].map(allRecords))
      setData({ classrooms, teachers, years, programs, placements })
    } catch (e) { setError(message(e)) } finally { setLoading(false) }
  }
  useEffect(() => {
    // Initial fetch shares the explicit reload path used after a save.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [])
  function open(item = null) {
    setError(''); setNotice('')
    setForm(item ? { ...item, level: normalizeLevel(item.level) || '10', homeroom_teacher_id: item.homeroom_teacher_id || '' } : { name: '', level: '10', study_program_id: '', academic_year_id: year || data.years.find(y => y.status === 'active')?.id || '', homeroom_teacher_id: '', status: 'active' })
  }
  function close() {
    setForm(null)
    setError('')
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const payload = {
        name: form.name,
        level: form.level,
        study_program_id: form.study_program_id,
        academic_year_id: form.academic_year_id,
        homeroom_teacher_id: form.homeroom_teacher_id || null,
        status: form.status,
      }
      if (form.id) await updateResource('classrooms', form.id, payload)
      else await createResource('classrooms', payload)
      setForm(null); setNotice('Kelas tersimpan.'); await load()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function assign(item, teacher) {
    setBusy(true); setError(''); setNotice('')
    try { await updateResource('classrooms', item.id, { homeroom_teacher_id: teacher || null }); setNotice(`Wali kelas ${item.name} diperbarui.`); await load() }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function remove(item) {
    if (!window.confirm(`Hapus kelas ${item.name}? Data yang masih digunakan tidak dapat dihapus.`)) return
    setBusy(true); setError(''); setNotice('')
    try { await deleteResource('classrooms', item.id); setNotice(`Kelas ${item.name} berhasil dihapus.`); await load() } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const classes = data.classrooms.filter(c => (!year || String(c.academic_year_id) === String(year)) && c.name.toLowerCase().includes(search.toLowerCase()))
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Kelas & Wali Kelas</h1><p className="mt-2 text-sm text-slate-500">Wali kelas adalah guru yang ditugaskan pada kelas, bukan peran akun baru. Pilih guru langsung pada kartu kelas.</p></div><button disabled={loading} onClick={() => open()} className={primaryClass}>Buat kelas</button></div>{!form && <Alert>{error}</Alert>}<Alert success>{notice}</Alert><div className="grid gap-4 sm:grid-cols-2"><Select label="Tahun ajaran" value={year} onChange={setYear} items={data.years} empty="Semua tahun ajaran" /><Field label="Cari kelas"><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama kelas" /></Field></div>
    {loading ? <p role="status">Memuat kelas...</p> : <div className="grid gap-4 xl:grid-cols-2">{classes.map(item => {
      const count = new Set(data.placements.filter(p => p.classroom_id === item.id && p.status === 'active').map(p => p.student_id)).size
      return <article key={item.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{item.name}</h2><p className="mt-1 text-sm text-slate-500">Tingkat {formatLevelLabel(item.level)} · {item.study_program?.name} · {item.academic_year?.name}</p></div><span className="text-xs text-slate-500">{item.status === 'active' ? 'Aktif' : 'Nonaktif'}</span></div><Select label="Wali kelas" disabled={busy} value={item.homeroom_teacher_id || ''} onChange={value => assign(item, value)} items={data.teachers.filter(t => t.status === 'active' || t.id === item.homeroom_teacher_id)} empty="Belum ditetapkan" /><p className="text-sm text-slate-600">{count} siswa aktif dalam penempatan kelas</p><div className="flex flex-wrap gap-3"><Link className={primaryClass} to={`/class-students?classroom_id=${item.id}&academic_year_id=${item.academic_year_id}`}>Atur siswa</Link><Link className={secondaryClass} to={`/schedules?classroom_id=${item.id}&academic_year_id=${item.academic_year_id}`}>Jadwal</Link><button disabled={busy} onClick={() => open(item)} className={secondaryClass}>Pengaturan</button><button disabled={busy} onClick={() => remove(item)} className="px-2 text-sm text-red-700">Hapus</button></div></article>
    })}{!classes.length && <p className="rounded-xl bg-white p-6 text-slate-500">Belum ada kelas yang sesuai. Buat kelas setelah menyiapkan tahun ajaran dan konsentrasi keahlian.</p>}</div>}
    {form && <Dialog title={form.id ? 'Pengaturan kelas' : 'Buat kelas'} onClose={close} busy={busy}><form onSubmit={save} className="space-y-4"><Alert>{error}</Alert><div className="grid gap-4 sm:grid-cols-2"><Field label="Nama kelas"><input autoFocus required maxLength={50} placeholder="Contoh: X AKL 1" className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Tingkat"><select className={inputClass} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>{[['10', '10 (X)'], ['11', '11 (XI)'], ['12', '12 (XII)']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}{form.level && !['10', '11', '12'].includes(form.level) && <option value={form.level}>{form.level}</option>}</select></Field></div><Select label="Tahun ajaran" required value={form.academic_year_id} items={data.years} onChange={v => setForm({ ...form, academic_year_id: v })} /><Select label="Konsentrasi keahlian" required value={form.study_program_id} items={data.programs} onChange={v => setForm({ ...form, study_program_id: v })} /><Select label="Wali kelas (opsional)" value={form.homeroom_teacher_id} items={data.teachers.filter(t => t.status === 'active' || t.id === form.homeroom_teacher_id)} onChange={v => setForm({ ...form, homeroom_teacher_id: v })} /><Field label="Status"><select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></Field><p className="text-xs text-slate-500">Setelah kelas dibuat, gunakan Atur siswa untuk memilih anggota kelas sekaligus.</p><button disabled={busy} className={primaryClass}>{busy ? 'Menyimpan...' : 'Simpan kelas'}</button></form></Dialog>}
  </section>
}
