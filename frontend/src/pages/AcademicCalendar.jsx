import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { createResource, updateResource, deleteResource } from '../api'
import { Alert, Dialog, Field, Select } from './academic-ui'
import { allRecords, inputClass, primaryClass, secondaryClass, localDate, message } from './academic-data'

export default function AcademicCalendar() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [data, setData] = useState({ events: [], years: [], semesters: [] })
  const [year, setYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    setLoading(true)
    try {
      const [events, years, semesters] = await Promise.all(['academic-calendars', 'academic-years', 'semesters'].map(allRecords))
      setData({ events, years, semesters })
    } catch (e) { setError(message(e)) } finally { setLoading(false) }
  }
  useEffect(() => {
    // Initial fetch shares the explicit reload path used after a save.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [])
  function open(date = localDate(), event = null) {
    setError(''); setNotice('')
    const defaultYear = year || data.years.find(y => date >= y.start_date?.slice(0, 10) && date <= y.end_date?.slice(0, 10))?.id || data.years.find(y => y.status === 'active')?.id || ''
    setForm(event ? { ...event, start_date: event.start_date.slice(0, 10), end_date: event.end_date.slice(0, 10), semester_id: event.semester_id || '' } : { name: '', description: '', start_date: date, end_date: date, academic_year_id: defaultYear, semester_id: '' })
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const payload = { ...form, semester_id: form.semester_id || null }
      if (form.id) await updateResource('academic-calendars', form.id, payload)
      else await createResource('academic-calendars', payload)
      setForm(null); setNotice('Kegiatan tersimpan.'); await load()
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!window.confirm(`Hapus kegiatan ${form.name}?`)) return
    setBusy(true); setError('')
    try { await deleteResource('academic-calendars', form.id); setForm(null); setNotice('Kegiatan dihapus.'); await load() }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1))
  const events = data.events.filter(e => !year || String(e.academic_year_id) === String(year))
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Kalender Akademik</h1><p className="mt-2 text-sm text-slate-500">Klik tanggal untuk membuat kegiatan. Klik kegiatan untuk mengubahnya.</p></div><button disabled={loading || !data.years.length} className={primaryClass} onClick={() => open()}><Plus size={16} className="mr-2 inline" />Buat kegiatan</button></div>
    {!form && <Alert>{error}</Alert>}<Alert success>{notice}</Alert>
    {!loading && !data.years.length && <p className="text-sm text-amber-800">Buat tahun ajaran di menu Tahun Ajaran terlebih dahulu.</p>}
    <div className="flex flex-wrap items-end justify-between gap-4"><Select label="Tahun ajaran" value={year} onChange={setYear} items={data.years} empty="Semua tahun ajaran" /><div className="flex items-center gap-2"><button aria-label="Bulan sebelumnya" className={secondaryClass} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><h2 className="min-w-36 text-center font-semibold">{month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h2><button aria-label="Bulan berikutnya" className={secondaryClass} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button><button className={secondaryClass} onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hari ini</button></div></div>
    {loading ? <p role="status">Memuat kalender...</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><div className="min-w-[650px]"><div className="grid grid-cols-7 border-b bg-slate-50">{['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => <div key={day} className="p-3 text-center text-xs font-semibold text-slate-500">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map(date => {
      const key = localDate(date), today = key === localDate()
      return <div key={key} className={`min-h-28 min-w-0 border-b border-r border-slate-200 p-2 ${date.getMonth() !== month.getMonth() ? 'bg-slate-50 text-slate-400' : ''}`}><button disabled={!data.years.length} aria-label={`Buat kegiatan ${key}`} className={`mb-2 grid h-8 w-8 place-items-center rounded-full text-sm hover:bg-teal-100 ${today ? 'bg-slate-900 text-white' : ''}`} onClick={() => open(key)}>{date.getDate()}</button><div className="space-y-1">{events.filter(e => key >= e.start_date.slice(0, 10) && key <= e.end_date.slice(0, 10)).map(event => <button key={event.id} title={event.name} onClick={() => open(key, event)} className="block w-full break-words rounded bg-teal-50 p-1.5 text-left text-xs font-medium text-teal-900 hover:bg-teal-100">{event.name}</button>)}</div></div>
    })}</div></div></div>}
    {form && <Dialog title={form.id ? 'Ubah kegiatan' : 'Buat kegiatan'} busy={busy} onClose={() => setForm(null)}><form onSubmit={save} className="space-y-4"><Alert>{error}</Alert><Field label="Nama kegiatan"><input autoFocus required maxLength={150} className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Mulai"><input required type="date" className={inputClass} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} /></Field><Field label="Selesai"><input required type="date" min={form.start_date} className={inputClass} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field></div><Select required label="Tahun ajaran" value={form.academic_year_id} items={data.years} onChange={value => setForm({ ...form, academic_year_id: value, semester_id: '' })} /><Select label="Semester (opsional)" value={form.semester_id} items={data.semesters.filter(s => String(s.academic_year_id) === String(form.academic_year_id))} onChange={value => setForm({ ...form, semester_id: value })} empty="Seluruh tahun ajaran" /><Field label="Keterangan (opsional)"><textarea className={inputClass} rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><div className="flex justify-between gap-3">{form.id ? <button disabled={busy} type="button" className="text-sm font-semibold text-red-700" onClick={remove}>Hapus kegiatan</button> : <span />}<button disabled={busy} className={primaryClass}>{busy ? 'Menyimpan...' : 'Simpan kegiatan'}</button></div></form></Dialog>}
  </section>
}
