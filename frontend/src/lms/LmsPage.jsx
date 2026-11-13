import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const button = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
const secondary = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const asDate = value => new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
const date = value => value ? asDate(value).toLocaleString('id-ID') : '—'
function Field({ label, children }) { return <label className="grid gap-1 text-sm font-medium text-slate-700">{label}{children}</label> }
function Panel({ title, children }) { return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">{title}</h2>{children}</section> }
function Empty({ children }) { return <p className="text-sm text-slate-500">{children}</p> }
function Fields({ fields, submit, label, busy, initial = {} }) {
  return <form className="grid gap-3" onSubmit={event => { event.preventDefault(); submit(Object.fromEntries(new FormData(event.currentTarget))) }}>
    {fields.map(([name, title, type = 'text']) => <Field key={name} label={title}>{type === 'textarea' ? <textarea name={name} className={input} required defaultValue={initial[name] || ''} /> : <input name={name} className={input} type={type} required defaultValue={initial[name] || ''} />}</Field>)}
    <button className={button} disabled={busy}>{label}</button>
  </form>
}

export default function LmsPage({ user }) {
  const teacher = user.role === 'guru'
  const student = user.role === 'murid'
  const parent = user.role === 'wali_murid'
  const allowed = teacher || student || parent
  const [children, setChildren] = useState([])
  const [child, setChild] = useState('')
  const [courses, setCourses] = useState([])
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('materials')
  const [models, setModels] = useState({ models: ['qwen3.8:27b'], default: 'qwen3.8:27b' })
  const [model, setModel] = useState('qwen3.8:27b')
  const [schedules, setSchedules] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const busy = working || loading
  const [quiz, setQuiz] = useState(null)
  const [reviewed, setReviewed] = useState(false)
  const [answers, setAnswers] = useState({})
  const [attendance, setAttendance] = useState({})
  const [meeting, setMeeting] = useState(new Date().toLocaleDateString('en-CA'))
  const requestVersion = useRef(0)
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])
  const params = useMemo(() => parent ? { student_id: child } : {}, [parent, child])
  const message = err => err.response?.data?.message || 'Layanan belum dapat diakses. Coba kembali.'

  const loadDetail = useCallback(async (id = selectedRef.current) => {
    if (!id) return
    const version = ++requestVersion.current
    const response = await api.get(`/lms/courses/${id}`, { params })
    if (version === requestVersion.current) setDetail(response.data.data)
  }, [params])

  async function load() {
    const [courseRes, scheduleRes] = await Promise.all([api.get('/lms/courses', { params }), api.get('/lms/schedules', { params })])
    setCourses(courseRes.data.data); setSchedules(scheduleRes.data.data)
    return courseRes.data.data
  }

  useEffect(() => {
    if (!parent) return
    let active = true
    async function readChildren() {
      const items = []
      let page = 1, last = 1
      do {
        const res = await api.get('/member4/parent/children', { params: { page, per_page: 100 } })
        items.push(...res.data.data)
        last = res.data.meta.last_page
        page++
      } while (page <= last && active)
      return items
    }
    readChildren().then(items => {
      if (!active) return
      setChildren(items)
      if (items[0]) setChild(String(items[0].id))
    }).catch(err => { if (active) setError(message(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [parent])

  useEffect(() => {
    if (!allowed || (parent && !child)) { setLoading(false); return }
    let active = true
    setLoading(true); setDetail(null); setSelected(''); setQuiz(null); setError('')
    Promise.all([api.get('/lms/courses', { params }), api.get('/lms/schedules', { params }), teacher ? api.get('/lms/models') : null]).then(([c, s, m]) => {
      if (!active) return
      setCourses(c.data.data); setSchedules(s.data.data)
      if (m) { setModels(m.data.data); setModel(m.data.data.default) }
      if (c.data.data[0]) setSelected(String(c.data.data[0].id))
    }).catch(err => { if (active) setError(message(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; requestVersion.current++ }
  }, [allowed, teacher, parent, child, params])

  useEffect(() => {
    setDetail(null); setQuiz(null); setAttendance({})
    if (selected) loadDetail(selected).catch(err => setError(message(err)))
    return () => { requestVersion.current++ }
  }, [selected, child, loadDetail])

  // Poll only while there are active generation jobs, including after a page reload.
  useEffect(() => {
    if (!detail?.drafts.some(d => ['queued', 'processing'].includes(d.status))) return
    const timer = setInterval(() => loadDetail().catch(err => setError(message(err))), 3000)
    return () => clearInterval(timer)
  }, [detail, selected, child, loadDetail])

  async function act(operation, success = 'Perubahan tersimpan.') {
    setBusy(true); setError(''); setNotice('')
    try { await operation(); await load(); await loadDetail(); setNotice(success) }
    catch (err) { setError(message(err)) }
    finally { setBusy(false) }
  }

  async function download(m) {
    await act(async () => {
      const res = await api.get(`/lms/materials/${m.id}/download`, { params, responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const link = document.createElement('a'); link.href = url; link.download = m.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'Materi diunduh.')
  }

  async function openQuiz(id) {
    setBusy(true); setError('')
    try { const res = await api.get(`/lms/drafts/${id}`, { params }); setQuiz(res.data.data); setReviewed(false); setAnswers({}) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  function editQuestion(index, key, value) {
    setReviewed(false)
    setQuiz(old => ({ ...old, reviewed_at: null, draft: { ...old.draft, questions: old.draft.questions.map((q, i) => i === index ? { ...q, [key]: value } : q) } }))
  }

  if (!allowed) return <p role="alert">LMS tersedia untuk guru, murid, dan wali murid.</p>
  const tabs = [['materials', 'Materi'], ['assignments', 'Tugas'], ['quizzes', 'Kuis AI'], ['attendance', 'Absensi'], ['progress', 'Progres & Nilai'], ['announcements', 'Pengumuman'], ['schedules', 'Jadwal']]
  const names = Object.fromEntries((detail?.members || []).map(m => [m.id, m.name]))
  return <main className="min-w-0 space-y-5">
    <header><h1 className="text-2xl font-bold text-slate-900">Pembelajaran LMS</h1><p className="mt-1 text-sm text-slate-500">Course, materi, tugas, dan perkembangan belajar.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    {parent && <Field label="Anak"><select className={input} value={child} onChange={e => setChild(e.target.value)}><option value="">Pilih anak</option>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    {loading && <p role="status">Memuat pembelajaran...</p>}
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <Panel title="Course saya"><div className="grid gap-2">{courses.map(c => <button key={c.id} className={`${secondary} text-left ${String(c.id) === selected ? 'ring-2 ring-slate-700' : ''}`} onClick={() => setSelected(String(c.id))}>{c.name}</button>)}{!courses.length && <Empty>Belum ada course yang diikuti.</Empty>}</div></Panel>
        {teacher && <Panel title="Buat course"><Fields busy={busy} fields={[["name", "Nama course"], ["description", "Deskripsi", "textarea"]]} label="Buat course" submit={data => act(async () => { const res = await api.post('/lms/courses', data); setSelected(String(res.data.data.id)) })} /></Panel>}
        {student && <Panel title="Gabung course"><Fields busy={busy} fields={[["code", "Kode dari guru"]]} label="Gabung" submit={data => act(async () => { const res = await api.post('/lms/join', data); setSelected(String(res.data.data.id)) })} /></Panel>}
      </aside>
      <div className="min-w-0 space-y-5">
        {detail && <><Panel title={detail.info.name}><p className="whitespace-pre-wrap text-sm text-slate-600">{detail.info.description}</p>{teacher && <><p className="text-sm">Kode bergabung: <strong className="font-mono">{detail.info.code}</strong></p><details><summary className="cursor-pointer text-sm">Edit course</summary><Fields key={detail.info.id} busy={busy} initial={detail.info} fields={[["name", "Nama course"], ["description", "Deskripsi", "textarea"]]} label="Simpan course" submit={data => act(() => api.patch(`/lms/courses/${selected}`, data))} /></details></>}</Panel>
          <nav aria-label="Bagian pembelajaran" className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} className={tab === id ? button : secondary} aria-pressed={tab === id} onClick={() => { setTab(id); setQuiz(null) }}>{label}</button>)}</nav>
          {tab === 'materials' && <Panel title="Materi PDF">
            {teacher && <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const f = data.get('file'); if (!f.size || f.size > 10 * 1024 * 1024) { setError('Pilih PDF maksimal 10 MB.'); return } act(() => api.post(`/lms/courses/${selected}/materials`, data, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Materi berhasil diunggah.') }}>
              <Field label="Dokumen PDF (maksimal 10 MB)"><input name="file" type="file" accept="application/pdf,.pdf" required className={input} /></Field>
              <Field label="Akses"><select name="visibility" className={input}><option value="public">Publik untuk anggota course</option><option value="private">Privat untuk guru</option></select></Field><button disabled={busy} className={button}>Unggah materi</button>
            </form>}
            {!detail.materials.length && <Empty>Belum ada materi tersedia.</Empty>}
            {detail.materials.map(m => <article className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3" key={m.id}><span className="min-w-0 flex-1 break-words">{m.name}</span><button className={secondary} disabled={busy} onClick={() => download(m)}>Unduh PDF</button>{teacher ? <select aria-label={`Akses ${m.name}`} className={`${input} max-w-40`} value={m.visibility} disabled={busy} onChange={e => act(() => api.patch(`/lms/materials/${m.id}`, { visibility: e.target.value }))}><option value="public">Publik</option><option value="private">Privat</option></select> : student && <button disabled={busy || detail.reads.some(r => r.material_id === m.id)} className={secondary} onClick={() => act(() => api.post(`/lms/materials/${m.id}/read`))}>{detail.reads.some(r => r.material_id === m.id) ? 'Sudah dibaca' : 'Tandai dibaca'}</button>}</article>)}
          </Panel>}
          {tab === 'assignments' && <Panel title="Tugas pembelajaran">
            {teacher && <details><summary className="cursor-pointer">Buat tugas</summary><Fields busy={busy} fields={[["title", "Judul tugas"], ["instructions", "Petunjuk", "textarea"], ["due_at", "Batas pengumpulan (waktu lokal)", "datetime-local"]]} label="Buat tugas" submit={data => act(() => api.post(`/lms/courses/${selected}/assignments`, { ...data, due_at: new Date(data.due_at).toISOString() }))} /></details>}
            {!detail.assignments.length && <Empty>Belum ada tugas.</Empty>}
            {detail.assignments.map(a => <article key={a.id} className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold">{a.title} ? {a.status}</h3>{teacher && a.status !== 'closed' && <button className={secondary} disabled={busy} onClick={() => act(() => api.post(`/lms/assignments/${a.id}/status`, { status: a.status === 'draft' ? 'published' : 'closed' }))}>{a.status === 'draft' ? 'Terbitkan tugas' : 'Tutup tugas'}</button>}<p className="whitespace-pre-wrap text-sm">{a.instructions}</p><p className="text-sm text-slate-500">Tenggat: {date(a.due_at)}</p>
              {student && a.status === 'published' && !detail.submissions.some(s => s.assignment_id === a.id && s.grade !== null) && asDate(a.due_at) > new Date() && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); act(() => api.post(`/lms/assignments/${a.id}/submit`, data, { headers: { 'Content-Type': 'multipart/form-data' } })) }}><Field label="Jawaban tugas"><textarea name="answer" className={input} defaultValue={detail.submissions.find(s => s.assignment_id === a.id)?.answer || ''} /></Field><Field label="Berkas jawaban (PDF, Word, TXT, ZIP; maksimal 10 MB)"><input type="file" name="file" accept=".pdf,.doc,.docx,.txt,.zip" className={input} /></Field><button className={button} disabled={busy}>Kumpulkan jawaban</button></form>}
              {detail.submissions.filter(s => s.assignment_id === a.id).map(s => <div className="space-y-2 rounded-lg bg-slate-50 p-3" key={s.id}><p className="text-sm font-medium">{names[s.user_id] || 'Murid'} · {date(s.updated_at)}</p><p className="whitespace-pre-wrap text-sm">{s.answer}</p>{s.file_name && <button className={secondary} disabled={busy} onClick={() => act(async () => { const res = await api.get(`/lms/submissions/${s.id}/download`, { params, responseType: 'blob' }); const url = URL.createObjectURL(res.data); const link = document.createElement('a'); link.href = url; link.download = s.file_name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }, 'Berkas jawaban diunduh.')}>Unduh {s.file_name}</button>}<p className="text-sm">Nilai: {s.grade ?? 'Belum dinilai'} {s.feedback && `· ${s.feedback}`}</p>{teacher && <Fields busy={busy} initial={s} fields={[["grade", "Nilai (0–100)", "number"], ["feedback", "Umpan balik", "textarea"]]} label="Simpan nilai" submit={data => act(() => api.patch(`/lms/submissions/${s.id}/grade`, data))} />}</div>)}
            </article>)}
          </Panel>}
          {tab === 'attendance' && <Panel title="Absensi pertemuan">
            {teacher && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); act(() => api.post(`/lms/courses/${selected}/attendance`, { meeting_date: meeting, records: detail.members.map(m => ({ user_id: m.id, status: attendance[m.id] || detail.attendance.find(a => a.user_id === m.id && a.meeting_date === meeting)?.status || 'hadir' })) })) }}><Field label="Tanggal pertemuan"><input className={input} type="date" required value={meeting} onChange={e => { setMeeting(e.target.value); setAttendance({}) }} /></Field>{detail.members.map(m => <Field key={m.id} label={m.name}><select className={input} value={attendance[m.id] || detail.attendance.find(a => a.user_id === m.id && a.meeting_date === meeting)?.status || 'hadir'} onChange={e => setAttendance({ ...attendance, [m.id]: e.target.value })}>{['hadir', 'izin', 'sakit', 'alpa'].map(s => <option key={s}>{s}</option>)}</select></Field>)}<button className={button} disabled={busy || !detail.members.length}>Simpan absensi</button></form>}
            {!detail.attendance.length && <Empty>Belum ada catatan absensi.</Empty>}{detail.attendance.map(a => <p className="text-sm" key={a.id}>{a.meeting_date} · {names[a.user_id] || 'Murid'} · <strong>{a.status}</strong></p>)}
          </Panel>}
          {tab === 'progress' && <Panel title="Progres & nilai course"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Murid', 'Materi dibaca', 'Progres', 'Tugas dikumpulkan', 'Hadir', 'Rata-rata nilai'].map(t => <th key={t} className="whitespace-nowrap p-2">{t}</th>)}</tr></thead><tbody>{detail.progress.map(p => <tr key={p.user_id}>{[p.name, `${p.read}/${p.total}`, `${p.percentage}%`, p.submitted, p.present, p.average_grade ?? 'Belum dinilai'].map((v, i) => <td className="p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div>{!detail.progress.length && <Empty>Belum ada anggota course.</Empty>}{detail.results.map(r => <p className="text-sm" key={r.id}>{names[r.user_id]} · Kuis #{r.draft_id} · Nilai {r.grade}</p>)}</Panel>}
          {tab === 'announcements' && <Panel title="Pengumuman course">{teacher && <Fields busy={busy} fields={[["title", "Judul"], ["content", "Isi pengumuman", "textarea"]]} label="Kirim pengumuman" submit={data => act(() => api.post(`/lms/courses/${selected}/announcements`, data))} />}{!detail.announcements.length && <Empty>Belum ada pengumuman.</Empty>}{detail.announcements.map(a => <article className="border-t border-slate-100 pt-3" key={a.id}><h3 className="font-semibold">{a.title}</h3><p className="whitespace-pre-wrap text-sm">{a.content}</p><p className="text-xs text-slate-500">{date(a.created_at)}</p></article>)}</Panel>}
          {tab === 'quizzes' && <Panel title="Kuis dari materi PDF">
            {teacher && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); act(() => api.post(`/lms/materials/${data.material}/generate`, { model, question_count: Number(data.question_count) }), 'Pembuatan soal masuk antrean. Status diperbarui otomatis.') }}><Field label="Materi sumber"><select name="material" className={input} required><option value="">Pilih PDF</option>{detail.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Model AI"><select className={input} value={model} onChange={e => setModel(e.target.value)}>{models.models.map(m => <option key={m}>{m}</option>)}</select></Field><Field label="Jumlah soal (1–50)"><input type="number" min="1" max="50" name="question_count" defaultValue="5" className={input} required /></Field><button disabled={busy || !detail.materials.length} className={button}>Buat soal dengan AI</button></form>}
            {!detail.drafts.length && <Empty>Belum ada kuis tersedia.</Empty>}{detail.drafts.map(d => <article key={d.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3"><div className="flex-1"><p className="text-sm font-semibold">Kuis #{d.id} · {d.question_count} soal</p><p className="text-xs text-slate-500">{teacher && `${d.model} · `}{({ queued: 'Dalam antrean', processing: 'Sedang dibuat', draft: 'Draft perlu ditinjau', published: 'Terbit', closed: 'Ditutup', failed: 'Gagal' })[d.status]}{d.deadline && ` · ${date(d.deadline)}`}</p>{d.error && <p className="text-sm text-red-700">{d.error}</p>}</div>{['draft', 'published', 'closed'].includes(d.status) && <button className={secondary} disabled={busy} onClick={() => openQuiz(d.id)}>{teacher ? 'Tinjau kuis' : 'Buka kuis'}</button>}{teacher && d.status === 'published' && <button className={secondary} disabled={busy} onClick={() => act(() => api.post(`/lms/drafts/${d.id}/close`))}>Tutup kuis</button>}{teacher && d.status === 'failed' && <button className={secondary} disabled={busy} onClick={() => act(() => api.post(`/lms/materials/${d.material_id}/generate`, { model: d.model, question_count: d.question_count }))}>Coba kembali</button>}</article>)}
            {quiz?.draft && <div className="space-y-4 rounded-xl border border-slate-300 p-4">
              {teacher && quiz.status === 'draft' ? <Field label="Judul kuis"><input className={input} value={quiz.draft.title} onChange={e => { setReviewed(false); setQuiz({ ...quiz, reviewed_at: null, draft: { ...quiz.draft, title: e.target.value } }) }} /></Field> : <h3 className="font-semibold">{quiz.draft.title}</h3>}
              {quiz.draft.questions.map((q, i) => <fieldset key={i} className="space-y-3 border-t border-slate-200 pt-3"><legend className="font-semibold">Soal {i + 1}</legend>{teacher && quiz.status === 'draft' ? <Field label="Pertanyaan"><textarea className={input} value={q.question} onChange={e => editQuestion(i, 'question', e.target.value)} /></Field> : <p>{q.question}</p>}{q.options.map((o, j) => teacher && quiz.status === 'draft' ? <Field key={j} label={`Opsi ${String.fromCharCode(65 + j)}`}><input className={input} value={o} onChange={e => editQuestion(i, 'options', q.options.map((value, k) => k === j ? e.target.value : value))} /></Field> : <label key={j} className="flex gap-2 text-sm"><input type="radio" name={`question-${i}`} disabled={!student || quiz.status !== 'published' || detail.results.some(r => r.draft_id === quiz.id)} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} />{o}</label>)}{teacher && <><Field label="Kunci jawaban"><select disabled={quiz.status !== 'draft'} className={input} value={q.correct_index} onChange={e => editQuestion(i, 'correct_index', Number(e.target.value))}>{q.options.map((_, j) => <option key={j} value={j}>{String.fromCharCode(65 + j)}</option>)}</select></Field><Field label="Pembahasan"><textarea disabled={quiz.status !== 'draft'} className={input} value={q.explanation} onChange={e => editQuestion(i, 'explanation', e.target.value)} /></Field></>}</fieldset>)}
              {teacher && quiz.status === 'draft' && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Saya telah meninjau semua soal, opsi, kunci, dan pembahasan.</label><button className={button} disabled={busy} onClick={() => act(async () => { await api.patch(`/lms/drafts/${quiz.id}`, { draft: quiz.draft, reviewed }); const res = await api.get(`/lms/drafts/${quiz.id}`); setQuiz(res.data.data) })}>Simpan draft & tinjauan</button><Fields busy={busy || !quiz.reviewed_at || !reviewed} fields={[["deadline", "Batas pengerjaan kuis (waktu lokal)", "datetime-local"]]} label="Publikasikan kuis" submit={data => act(async () => { await api.post(`/lms/drafts/${quiz.id}/publish`, { deadline: new Date(data.deadline).toISOString() }); setQuiz(null) })} /></>}
              {student && quiz.status === 'published' && !detail.results.some(r => r.draft_id === quiz.id) && <button className={button} disabled={busy || Object.keys(answers).length !== quiz.question_count} onClick={() => act(async () => { const res = await api.post(`/lms/drafts/${quiz.id}/answers`, { answers: quiz.draft.questions.map((_, i) => answers[i]) }); setQuiz(null); setNotice(`Nilai kuis: ${res.data.data.grade}`) }, 'Jawaban kuis tersimpan. Lihat nilai pada Progres & Nilai.')}>Kumpulkan kuis</button>}
            </div>}
          </Panel>}
        </>}
        {(tab === 'schedules' || !detail) && <Panel title="Jadwal pembelajaran">{!schedules.length && <Empty>Belum ada jadwal aktif.</Empty>}{schedules.map(s => <article className="border-t border-slate-100 py-3 text-sm" key={s.id}><strong>{s.subject?.name}</strong><p>{s.day} · {s.start_time}–{s.end_time} · {s.classroom?.name} · {s.room?.name} · {s.teacher?.name}</p></article>)}</Panel>}
      </div>
    </div>
  </main>
}
