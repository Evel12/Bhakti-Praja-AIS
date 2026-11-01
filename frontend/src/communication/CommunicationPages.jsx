import { useState } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import api from '../api'
import { Back, Empty, Field, Modal, Notice, Page, Pager, QueryState } from '../finance/shared'
import { buttonClass, date, errorText, fieldClass, financeApi, panelClass, secondaryClass, useFinanceQuery } from '../finance/finance'

const audiences = { all: 'Semua peran', admin: 'Administrator', guru: 'Guru', murid: 'Siswa', wali_murid: 'Wali murid' }
const categories = { announcement: 'Pengumuman', payment_reminder: 'Pengingat pembayaran' }

function AnnouncementForm({ announcement, onClose, onSaved }) {
  const [form, setForm] = useState({ title: announcement?.title ?? '', content: announcement?.content ?? '', target_role: announcement?.target_role ?? 'all' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { const response = announcement ? await financeApi.patch(`announcements/${announcement.id}`, form) : await financeApi.post('announcements', form); onSaved(response.message) }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <Modal title={announcement ? 'Ubah Pengumuman' : 'Buat Pengumuman'} busy={busy} onClose={onClose}><form onSubmit={save} className="space-y-4"><Notice>{error}</Notice>
    <Field label="Judul pengumuman"><input autoFocus required name="title" maxLength={255} value={form.title} onChange={change} disabled={busy} className={fieldClass} /></Field>
    <Field label="Penerima"><select name="target_role" value={form.target_role} onChange={change} disabled={busy} className={fieldClass}>{Object.entries(audiences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Isi pengumuman" hint="Pengumuman sistem ditampilkan sebagai teks biasa."><textarea required rows={7} name="content" maxLength={20000} value={form.content} onChange={change} disabled={busy} className={fieldClass} /></Field>
    <button disabled={busy} className={`${buttonClass} w-full`}>{busy ? 'Menyimpan...' : 'Simpan pengumuman'}</button>
  </form></Modal>
}

function Announcements({ admin }) {
  const [page, setPage] = useState(1)
  const query = useFinanceQuery(`announcements?page=${page}&per_page=15`)
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function remove() {
    setBusy(true); setError('')
    try { const { data } = await api.delete(`/member4/announcements/${deleting.id}`); setDeleting(null); setSuccess(data.message); setPage(1); query.reload() }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <Page eyebrow="Komunikasi Sekolah" title="Pengumuman" subtitle="Informasi akademik dan administrasi sekolah untuk peran Anda." action={admin && <button className={buttonClass} onClick={() => setEditor({})}>Buat pengumuman</button>}>
    <Notice success>{success}</Notice><QueryState query={query} loadingLabel="Memuat pengumuman...">{response => <div className="space-y-4">{response.data.length ? response.data.map(item => <article key={item.id} className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="inline-block rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{audiences[item.target_role]}</span><h2 className="mt-3 break-words text-lg font-semibold text-slate-900"><Link to={`/communication/announcements/${item.id}`} className="hover:text-teal-700">{item.title}</Link></h2><p className="mt-1 text-xs text-slate-400">{date(item.created_at, true)} WIB</p></div>{admin && <div className="flex gap-2"><button className={secondaryClass} onClick={() => setEditor(item)}>Ubah</button><button className="rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50" onClick={() => { setError(''); setDeleting(item) }}>Hapus</button></div>}</div>
      <p className="break-words whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.content}</p>
    </article>) : <div className={panelClass}><Empty>Belum ada pengumuman untuk Anda.</Empty></div>}<Pager meta={response.meta} onChange={setPage} /></div>}</QueryState>
    {editor && <AnnouncementForm announcement={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={message => { setEditor(null); setSuccess(message); query.reload() }} />}
    {deleting && <Modal title="Hapus Pengumuman?" busy={busy} onClose={() => setDeleting(null)}><div className="space-y-4"><Notice>{error}</Notice><p className="text-sm leading-6 text-slate-600">Pengumuman “{deleting.title}” dan notifikasi terkait akan dihapus dari aplikasi.</p><button className={`${buttonClass} w-full`} disabled={busy} onClick={remove}>{busy ? 'Menghapus...' : 'Konfirmasi hapus'}</button></div></Modal>}
  </Page>
}

function AnnouncementDetail() {
  const { id } = useParams()
  const query = useFinanceQuery(`announcements/${id}`)
  return <Page eyebrow="Komunikasi Sekolah" title="Detail Pengumuman"><Back to="/communication/announcements">Daftar pengumuman</Back><QueryState query={query} loadingLabel="Memuat pengumuman...">{({ data }) => <article className={`${panelClass} space-y-4`}><span className="text-xs font-medium text-teal-700">{audiences[data.target_role]}</span><h2 className="break-words text-xl font-semibold text-slate-900">{data.title}</h2><p className="text-xs text-slate-400">{date(data.created_at, true)} WIB</p><p className="break-words whitespace-pre-wrap text-sm leading-7 text-slate-600">{data.content}</p></article>}</QueryState></Page>
}

function Notifications() {
  const [filters, setFilters] = useState({ is_read: '', category: '', page: 1 })
  const params = new URLSearchParams({ page: filters.page, per_page: 15 })
  if (filters.is_read !== '') params.set('is_read', filters.is_read)
  if (filters.category) params.set('category', filters.category)
  const query = useFinanceQuery(`notifications?${params}`, { refreshOnFocus: true })
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const change = e => setFilters({ ...filters, [e.target.name]: e.target.value, page: 1 })
  async function read(id) {
    setBusy(id); setError('')
    try { const result = await financeApi.patch(`notifications/${id}/read`, {}); setSuccess(result.message); query.reload() }
    catch (e) { setError(errorText(e)) } finally { setBusy(null) }
  }
  return <Page eyebrow="Komunikasi Sekolah" title="Pusat Notifikasi" subtitle="Pengumuman dan pengingat dalam aplikasi yang ditujukan kepada akun Anda.">
    <Notice>{error}</Notice><Notice success>{success}</Notice><div className={`${panelClass} flex flex-wrap gap-4`}>
      <Field label="Status baca"><select name="is_read" value={filters.is_read} onChange={change} className={fieldClass}><option value="">Semua status</option><option value="0">Belum dibaca</option><option value="1">Sudah dibaca</option></select></Field>
      <Field label="Kategori"><select name="category" value={filters.category} onChange={change} className={fieldClass}><option value="">Semua kategori</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    </div><QueryState query={query} loadingLabel="Memuat notifikasi...">{response => <div className="space-y-4">{response.data.length ? response.data.map(item => <article key={item.id} className={`${panelClass} space-y-4 ${item.is_read ? '' : 'border-l-4 border-l-teal-600'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-teal-700">{categories[item.category] ?? 'Informasi sekolah'} · {item.is_read ? 'Sudah dibaca' : 'Belum dibaca'}</p><h2 className="mt-2 break-words font-semibold text-slate-900">{item.title}</h2><p className="mt-1 text-xs text-slate-400">{date(item.created_at, true)} WIB</p></div>{!item.is_read && <button className={secondaryClass} disabled={busy !== null} onClick={() => read(item.id)}>{busy === item.id ? 'Menyimpan...' : 'Tandai sudah dibaca'}</button>}</div>
      <p className="break-words whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.message}</p>
      {item.category === 'announcement' && <Link className="inline-block text-sm font-medium text-teal-700 hover:underline" to={`/communication/announcements/${item.source_id}`}>Lihat pengumuman →</Link>}
      {item.category === 'payment_reminder' && <Link className="inline-block text-sm font-medium text-teal-700 hover:underline" to={`/finance/invoices/${item.source_id}`}>Lihat tagihan →</Link>}
    </article>) : <div className={panelClass}><Empty>Belum ada notifikasi yang sesuai.</Empty></div>}<Pager meta={response.meta} onChange={page => setFilters({ ...filters, page })} /></div>}</QueryState>
  </Page>
}

export default function CommunicationPages({ user }) {
  return <Routes><Route index element={<Navigate to="/communication/announcements" replace />} /><Route path="announcements" element={<Announcements admin={user.role === 'admin'} />} /><Route path="announcements/:id" element={<AnnouncementDetail />} /><Route path="notifications" element={<Notifications />} /><Route path="*" element={<Navigate to="/communication/announcements" replace />} /></Routes>
}
