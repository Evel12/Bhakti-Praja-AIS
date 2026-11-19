import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useSchool } from '../school-context'
import { Link, useSearchParams } from 'react-router-dom'

import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
  updateUserStatus,
  promoteStudent,
} from '../api'

const fieldConfig = {
  'teaching-loads': ['teacher_id', 'subject_id', 'classroom_id', 'semester_id', 'weekly_hours', 'status'],
  users: [
    'name',
    'email',
    'role',
    'password',
    'status'
  ],

  students: [
    'student_number',
    'name',
    'gender',
    'birth_date',
    'address',
    'status'
  ],

  teachers: [
    'teacher_number',
    'name',
    'email',
    'phone',
    'status'
  ],

  parents: [
    'name',
    'email',
    'phone',
    'occupation',
    'student_ids',
    'status'
  ],

  departments: [
    'code',
    'name',
    'status'
  ],

  'study-programs': [
    'code',
    'name',
    'department_id',
    'status'
  ],

  subjects: [
    'code',
    'name',
    'study_program_id',
    'credit_hours',
    'status'
  ],

  'academic-years': [
    'name',
    'start_date',
    'end_date',
    'status'
  ],

  semesters: [
    'name',
    'academic_year_id',
    'period',
    'status'
  ],

  'academic-calendars': [
    'name',
    'start_date',
    'end_date',
    'description',
    'academic_year_id',
    'semester_id'
  ],

  rooms: [
    'code',
    'name',
    'capacity',
    'location',
    'status'
  ],

  classrooms: [
    'name',
    'level',
    'study_program_id',
    'academic_year_id',
    'homeroom_teacher_id',
    'status'
  ],

  curricula: [
    'subject_ids',
    'name',
    'period',
    'study_program_id',
    'source_url',
    'notes',
    'status'
  ],

  classes: [
    'name',
    'level',
    'study_program_id',
    'academic_year_id',
    'homeroom_teacher_id',
    'status'
  ],

  'class-students': [
    'student_id',
    'classroom_id',
    'academic_year_id',
    'semester_id',
    'assigned_at',
    'status'
  ],

  'academic-registrations': [
    'student_id',
    'academic_year_id',
    'semester_id',
    'status',
    'registered_at',
    'notes'
  ],

  schedules: [
    'subject_id',
    'classroom_id',
    'teacher_id',
    'room_id',
    'day',
    'start_time',
    'end_time',
    'semester_id',
    'academic_year_id',
    'status'
  ]
}

const labels = {
  password: 'Kata Sandi (minimal 8 karakter)',
  subject_ids: 'Mata Pelajaran Kurikulum',
  student_ids: 'Anak / Siswa',
  weekly_hours: 'Jam Mengajar per Minggu',
  student_number: 'Nomor Induk Siswa',
  teacher_number: 'Nomor Guru / NIP',
  name: 'Nama',
  email: 'Email',
  phone: 'Telepon',
  occupation: 'Pekerjaan',
  address: 'Alamat',
  gender: 'Jenis Kelamin (L/P)',
  birth_date: 'Tanggal Lahir',
  code: 'Kode',
  role: 'Peran',
  status: 'Status',
  class_id: 'ID Kelas',
  classroom_id: 'Kelas',
  registration_number: 'No. Registrasi',
  registered_at: 'Tanggal Registrasi',
  assigned_at: 'Tanggal Penempatan',
  notes: 'Catatan',
  department_id: 'Program Keahlian',
  study_program_id: 'Konsentrasi Keahlian',
  academic_year_id: 'Tahun Ajaran',
  semester_id: 'Semester',
  homeroom_teacher_id: 'Wali Kelas',
  credit_hours: 'JP per Minggu',
  source_url: 'Tautan Dokumen Kurikulum',
  period: 'Periode',
  start_date: 'Tanggal Mulai',
  end_date: 'Tanggal Selesai',
  description: 'Keterangan',
  capacity: 'Kapasitas',
  location: 'Lokasi',
  level: 'Tingkat',
  student_id: 'Siswa',
  subject_id: 'Mata Pelajaran',
  teacher_id: 'Guru',
  room_id: 'Ruang',
  day: 'Hari',
  start_time: 'Jam Mulai',
  end_time: 'Jam Selesai'
}

const statusOptionsByResource = {
  students: ['active', 'inactive', 'graduated', 'transferred'],
  rooms: ['active', 'inactive', 'maintenance'],
  'academic-registrations': ['pending', 'approved', 'rejected', 'cancelled'],
}

const gradeNumber = (value) => ({ X: 10, XI: 11, XII: 12 }[String(value).trim().toUpperCase()] || Number(value) || 0)
const gradeLabel = (value) => ({ 10: 'X', 11: 'XI', 12: 'XII' }[gradeNumber(value)] || value || '')

const relationResources = {
  department_id: 'departments', study_program_id: 'study-programs',
  academic_year_id: 'academic-years', semester_id: 'semesters',
  homeroom_teacher_id: 'teachers', student_id: 'students', classroom_id: 'classrooms',
  teacher_id: 'teachers', subject_id: 'subjects', room_id: 'rooms',
  subject_ids: 'subjects', student_ids: 'students',
}

const dayOptions = [
  { value: 'monday', label: 'Senin' },
  { value: 'tuesday', label: 'Selasa' },
  { value: 'wednesday', label: 'Rabu' },
  { value: 'thursday', label: 'Kamis' },
  { value: 'friday', label: 'Jumat' },
  { value: 'saturday', label: 'Sabtu' },
  { value: 'sunday', label: 'Minggu' },
]

function statusLabel(value) {
  const map = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
    graduated: 'Lulus',
    transferred: 'Pindah',
    maintenance: 'Perawatan',
  }

  return map[value] || value || '-'
}

export default function CrudPage({
  resource,
  title,
  singular
}) {
  const school = useSchool()
  const [routeParams] = useSearchParams()
  const fields = useMemo(() => fieldConfig[resource] || ['name', 'status'], [resource])

  const hasStatusField = fields.includes('status')

  const statusOptions =
    statusOptionsByResource[resource] || ['active', 'inactive']

  const [items, setItems] = useState([])
  const [lookups, setLookups] = useState({})
  const [lookupsLoading, setLookupsLoading] = useState(true)
  const requestId = useRef(0)
  const dialogRef = useRef(null)
  const [meta, setMeta] = useState({ current_page: 1, per_page: 15, total: 0, last_page: 1 })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [promotion, setPromotion] = useState(null)
  const [promotionError, setPromotionError] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function showToast(type, message) {
    setToast({ type, message })
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  async function load(targetPage = page, overrides = {}) {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')

    try {
      const params = {
        search,
        page: targetPage,
        per_page: perPage,
      }

      if (statusFilter) params.status = statusFilter
      if (resource === 'users' && roleFilter) params.role = roleFilter
      if (resource === 'students' && levelFilter) params.level = levelFilter
      if (resource === 'students' && programFilter) params.study_program_id = programFilter
      if (resource === 'students' && yearFilter) params.academic_year_id = yearFilter
      if (resource === 'schedules' && dayFilter) params.day = dayFilter
      Object.assign(params, overrides)

      const response = await listResource(resource, params)
      if (currentRequest !== requestId.current) return
      setItems(response.data || [])
      setMeta(response.meta || { current_page: 1, per_page: perPage, total: (response.data || []).length, last_page: 1 })
    } catch (err) {
      if (currentRequest !== requestId.current) return
      setError(
        err.response?.data?.message ||
        'Gagal memuat data. Periksa koneksi lalu tekan Muat Ulang.'
      )
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    setStatusFilter('')
    setRoleFilter(resource === 'users' ? routeParams.get('role') || '' : '')
    setLevelFilter(''); setProgramFilter(''); setYearFilter('')
    if (resource === 'users' && routeParams.get('create') === '1') openCreate()
    setDayFilter('')
    setSearch('')
    // Initialize route-provided defaults only when entering a resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource])

  useEffect(() => {
    const timer = setTimeout(() => load(page), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, search, page, perPage, statusFilter, roleFilter, dayFilter, levelFilter, programFilter, yearFilter])

  const columns = useMemo(() => {
    const base = fields.filter((f) => !['password', 'subject_ids', 'student_ids'].includes(f)).slice(0, 7)
    return resource === 'students' ? [...base, 'level', 'class_name'] : base
  }, [fields, resource])

  useEffect(() => {
    let cancelled = false
    setLookupsLoading(true)
    async function fetchAll(target) {
      let result = [], page = 1, last = 1
      do {
        const response = await listResource(target, { per_page: 100, page })
        result = result.concat(response.data || [])
        last = response.meta?.last_page || 1
        page++
      } while (page <= last)
      return result
    }
    const targets = [...new Set([...fields.map((f) => relationResources[f]).filter(Boolean), ...(resource === 'students' ? ['academic-years', 'semesters', 'classrooms', 'study-programs'] : [])])]
    Promise.all(targets.map(async (target) => [target, await fetchAll(target)]))
      .then((entries) => { if (!cancelled) setLookups(Object.fromEntries(entries)) })
      .catch(() => { if (!cancelled) setError('Gagal memuat pilihan relasi. Muat ulang halaman sebelum menyimpan.') })
      .finally(() => { if (!cancelled) setLookupsLoading(false) })
    return () => { cancelled = true }
  }, [fields, resource])

  useEffect(() => {
    if (!modal) return
    const previous = document.activeElement
    dialogRef.current?.focus()
    const keydown = (event) => {
      if (event.key === 'Escape' && !saving) setModal(null)
      if (event.key === 'Tab') {
        const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select, textarea')]
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [modal, saving])

  function displayValue(item, field) {
    const value = item[field]
    if (field === 'credit_hours' && value == null) return 'Belum ditetapkan'
    const target = relationResources[field]
    if (target) {
      const ids = Array.isArray(value) ? value : [value]
      return ids.map((id) => {
        const record = lookups[target]?.find((r) => String(r.id) === String(id))
        const embedded = item[field.replace(/_id$/, '')]
        return record?.name || embedded?.name || id || '—'
      }).join(', ') || '—'
    }
    if (field === 'status') return statusLabel(value)
    if (field === 'day') return dayOptions.find((d) => d.value === value)?.label || value
    if (Array.isArray(value)) return value.map((v) => v.name || v).join(', ')
    if (value && typeof value === 'object') return value.name || '—'
    return String(value ?? '—')
  }

  function openCreate() {
    const initial = Object.fromEntries(
      fields.map((field) => [
        field,
        field.endsWith('_ids') ? [] : field === 'status' ? statusOptions[0] : field === 'role' ? (routeParams.get('role') || 'murid') : '',
      ])
    )
    setForm(initial)
    setError('')
    setFieldErrors({})
    setModal({ mode: 'create' })
  }

  function openEdit(item) {
    setError('')
    setForm({ ...item, password: '', subject_ids: item.subjects?.map((s) => s.id) || [], student_ids: item.students?.map((s) => s.id) || [] })
    setFieldErrors({})
    setModal({ mode: 'edit', id: item.id })
  }

  function openDetail(item) {
    setForm({ ...item, subject_ids: item.subjects?.map((s) => s.id) || [], student_ids: item.students?.map((s) => s.id) || [] })
    setModal({ mode: 'detail', id: item.id })
  }

  function firstErrorMessage(errors) {
    const values = Object.values(errors || {}).flat()
    return values[0] || 'Periksa kembali isian formulir.'
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setSaving(true)

    try {
      const basePayload = Object.fromEntries(fields.filter((f) => !(f === 'password' && !form[f] && modal.mode === 'edit')).map((f) => [f, form[f] === '' ? null : form[f]]))
      const payload = resource === 'users'
        ? { ...basePayload, sync_profile: true }
        : basePayload
      if (modal.mode === 'create') {
        await createResource(resource, payload)
        showToast('success', `${singular} berhasil ditambahkan.`)
        setPage(1)
      } else {
        await updateResource(resource, modal.id, payload)
        showToast('success', `${singular} berhasil diperbarui.`)
      }
      setModal(null)
      await load(modal.mode === 'create' ? 1 : page)
    } catch (err) {
      const backendErrors = err.response?.data?.errors
      if (backendErrors) setFieldErrors(backendErrors)
      setError(
        backendErrors
          ? firstErrorMessage(backendErrors)
          : err.response?.data?.message || 'Gagal menyimpan data.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!window.confirm(`Hapus ${singular.toLowerCase()} ini? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }
    try {
      await deleteResource(resource, id)
      showToast('success', `${singular} berhasil dihapus.`)
      if (items.length === 1 && page > 1) setPage(page - 1)
      else await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus data.')
    }
  }

  async function toggleUserStatus(item) {
    const next = item.status === 'active' ? 'inactive' : 'active'
    const label = next === 'active' ? 'aktifkan' : 'nonaktifkan'
    if (!window.confirm(`${label === 'aktifkan' ? 'Aktifkan' : 'Nonaktifkan'} pengguna ${item.name}?`)) return
    try {
      await updateUserStatus(item.id, next)
      showToast('success', `Pengguna berhasil di${label}.`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah status pengguna.')
    }
  }

  function promotionYears(student) {
    const years = lookups['academic-years'] || []
    const currentYear = years.find(year => String(year.id) === String(student.academic_year_id))
    return years.filter(year => new Date(year.start_date) > new Date(currentYear?.start_date || 0))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  }

  function promotionClasses(student, year) {
    return (lookups.classrooms || []).filter(classroom =>
      String(classroom.academic_year_id) === String(year)
      && gradeNumber(classroom.level) === student.targetLevel
      && String(classroom.study_program_id) === String(student.study_program_id))
  }

  function openPromotion(student) {
    const next = promotionYears(student)[0]
    const draft = { ...student, targetLevel: gradeNumber(student.level) + 1 }
    const targets = promotionClasses(draft, next?.id)
    const semester = (lookups.semesters || []).find(item => String(item.academic_year_id) === String(next?.id))
    setPromotionError('')
    setPromotion({ ...draft, year: next?.id || '', semester: semester?.id || '', classroom: targets.length === 1 ? targets[0].id : '' })
  }

  async function advanceStudent() {
    if (!promotion) return
    setSaving(true); setPromotionError('')
    try {
      const result = await promoteStudent(promotion.id, { academic_year_id: promotion.year, semester_id: promotion.semester || null, classroom_id: promotion.classroom })
      setPromotion(null)
      setLevelFilter(''); setYearFilter('')
      showToast('success', `Siswa berhasil dinaikkan ke ${result.data.class_name} (${result.data.academic_year_name}).`)
      await load(page, { level: undefined, academic_year_id: undefined })
    } catch (err) { setPromotionError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Gagal menaikkan kelas siswa.') }
    finally { setSaving(false) }
  }

  function renderInput(field) {
    const value = form[field] ?? ''
    const err = fieldErrors[field]?.[0]
    const base = 'w-full rounded-xl border px-3 py-2.5 outline-none focus:border-slate-900 ' + (err ? 'border-red-400' : 'border-slate-200')

    const set = (v) => setForm({ ...form, [field]: v })

    if (field === 'level') {
      return <><select id={field} value={value} onChange={(e) => set(e.target.value)} className={base}>
        <option value="">Pilih tingkat</option>
        <option value="10">X (Sepuluh)</option><option value="11">XI (Sebelas)</option><option value="12">XII (Dua Belas)</option>
      </select>{err && <FieldError text={err} />}</>
    }

    if (relationResources[field]) {
      const target = relationResources[field]
      const multiple = field.endsWith('_ids')
      let options = lookups[target] || []
      if (field === 'semester_id' && form.academic_year_id) options = options.filter((o) => String(o.academic_year_id) === String(form.academic_year_id))
      return <>
        <select id={field} multiple={multiple} value={multiple ? (Array.isArray(value) ? value : []) : value} onChange={(e) => set(multiple ? [...e.target.selectedOptions].map((o) => Number(o.value)) : e.target.value)} className={base}>
          {!multiple && <option value="">{field === 'study_program_id' && resource === 'subjects' ? 'Umum / lintas konsentrasi' : `Pilih ${labels[field]?.toLowerCase()}`}</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{o.code || o.student_number || o.teacher_number || ''} {o.name}{o.academic_year?.name ? ` · ${o.academic_year.name}` : ''}</option>)}
        </select>
        {multiple && <p className="mt-1 text-xs text-slate-500">Gunakan Ctrl / Cmd untuk memilih lebih dari satu.</p>}
        {err && <FieldError text={err} />}
      </>
    }

    if (field === 'status') {
      return (
        <>
          <select id={field} value={value} onChange={(e) => set(e.target.value)} className={base}>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{statusLabel(opt)}</option>
            ))}
          </select>
          {err && <FieldError text={err} />}
        </>
      )
    }

    if (field === 'role') {
      return (
        <>
          <select id={field} value={value} onChange={(e) => set(e.target.value)} className={base}>
            <option value="admin">Admin</option>
            <option value="guru">Guru</option>
            <option value="murid">Murid</option>
            <option value="wali_murid">Wali Murid</option>
          </select>
          {err && <FieldError text={err} />}
        </>
      )
    }

    if (field === 'day') {
      return (
        <>
          <select id={field} value={value} onChange={(e) => set(e.target.value)} className={base}>
            <option value="">Pilih hari</option>
            {dayOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {err && <FieldError text={err} />}
        </>
      )
    }

    if (field === 'gender') {
      return (
        <>
          <select id={field} value={value} onChange={(e) => set(e.target.value)} className={base}>
            <option value="">Pilih</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
          {err && <FieldError text={err} />}
        </>
      )
    }

    if (field === 'description' || field === 'address' || field === 'notes') {
      return (
        <>
          <textarea id={field} value={value} onChange={(e) => set(e.target.value)} rows={3} className={base} />
          {err && <FieldError text={err} />}
        </>
      )
    }

    const type = field.includes('date') || ['assigned_at', 'registered_at'].includes(field)
      ? 'date'
      : field.includes('time')
        ? 'time'
        : field === 'weekly_hours' || field === 'capacity' || field.endsWith('_id') || field === 'credit_hours'
          ? 'number'
          : field === 'email'
            ? 'email'
            : field === 'source_url' ? 'url' : field === 'password'
              ? 'password'
              : 'text'

    return (
      <>
        <input id={field} autoComplete={field === 'password' ? 'new-password' : undefined} minLength={field === 'password' ? 8 : undefined} required={field === 'password' && modal?.mode === 'create'} placeholder={field === 'password' && modal?.mode === 'edit' ? 'Kosongkan untuk mempertahankan kata sandi' : undefined} type={type} value={typeof value === 'string' && type === 'date' ? value.slice(0, 10) : typeof value === 'string' && type === 'time' ? value.slice(0, 5) : value} onChange={(e) => set(e.target.value)} className={base} />
        {err && <FieldError text={err} />}
      </>
    )
  }

  const from = meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1
  const to = Math.min(meta.total, meta.current_page * meta.per_page)

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">DATA MASTER / ADMINISTRASI</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola data {singular.toLowerCase()}.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={18} />
          Tambah {singular}
        </button>
      </div>

      {['students', 'teachers'].includes(resource) && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><p>Akun {resource === 'students' ? 'siswa' : 'guru'} dari Data Pengguna otomatis terhubung ke daftar ini. Nomor AKUN adalah nomor sementara; lengkapi dengan NIS/NIP melalui Ubah.</p><Link className="shrink-0 font-semibold underline" to={`/users?role=${resource === 'students' ? 'murid' : 'guru'}&create=1`}>Tambah akun {resource === 'students' ? 'siswa' : 'guru'}</Link></div>}
      {resource === 'users' && <p className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">Pilih peran Guru atau Murid untuk membuat akun sekaligus profil akademiknya. Nama dan status akun disinkronkan dengan tab Guru/Siswa; data NIP/NIS dan riwayat akademik tetap tersimpan.</p>}

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {error && !modal && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {['departments', 'study-programs', 'curricula', 'subjects'].includes(resource) && <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-slate-700">
        {['curricula', 'subjects'].includes(resource) ? school.curriculum_note : `Program dan konsentrasi mengacu pada SK Dinas Pendidikan Jawa Tengah tahun ${school.program_source_year || '2023/2024'}. Kode BP merupakan kode internal aplikasi.`}
        {school.sources?.length > 0 && <a className="ml-1 font-semibold text-teal-800 underline" href={school.sources[resource === 'departments' || resource === 'study-programs' ? 1 : 2]?.url} target="_blank" rel="noreferrer">Lihat rujukan</a>}
      </div>}

      {resource === 'students' && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <select aria-label="Filter tingkat kelas" value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Semua tingkat</option>{[['10','X'],['11','XI'],['12','XII']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="Filter konsentrasi" value={programFilter} onChange={e => { setProgramFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Semua konsentrasi</option>{(lookups['study-programs'] || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter angkatan / tahun ajaran" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Semua angkatan</option>{(lookups['academic-years'] || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <span className="text-xs text-slate-500">Kelas mengikuti penempatan aktif.</span>
      </div>}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={`Cari ${singular.toLowerCase()}...`}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
            />
          </div>

          {hasStatusField && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Semua status</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>{statusLabel(opt)}</option>
              ))}
            </select>
          )}

          {resource === 'users' && (
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Semua peran</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="murid">Murid</option>
              <option value="wali_murid">Wali Murid</option>
            </select>
          )}

          {resource === 'schedules' && (
            <select
              value={dayFilter}
              onChange={(e) => { setDayFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Semua hari</option>
              {dayOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          )}

          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
          >
            {[10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>{n} / halaman</option>
            ))}
          </select>

          <button
            onClick={() => load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Muat Ulang
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Memuat data...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-slate-700">Belum ada data</p>
            <p className="mt-1 text-sm text-slate-400">
              {search || statusFilter ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan data menggunakan tombol di atas.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-5 py-3">{labels[column] || column}</th>
                    ))}
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      {columns.map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-5 py-4 text-slate-700">
                          {column === 'status' ? (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item[column] === 'active' || item[column] === 'approved' ? 'bg-emerald-50 text-emerald-700' : item[column] === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                              {statusLabel(item[column])}
                            </span>
                          ) : column === 'day' ? (
                            dayOptions.find((d) => d.value === item[column])?.label || item[column] || '-'
                          ) : (
                            column === 'name' && ['students', 'teachers'].includes(resource) ? <><span>{displayValue(item, column)}</span><span className="mt-1 block text-xs text-slate-400">{item.user?.email || 'Belum memiliki akun login'}</span></> : column === 'level' ? (item.level ? gradeLabel(item.level) : '—') : column === 'class_name' ? (item.class_name || 'Belum ditempatkan') : displayValue(item, column)
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openDetail(item)} title="Lihat detail" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => openEdit(item)} title="Ubah" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                            <Pencil size={16} />
                          </button>
                          {resource === 'users' && (
                            <button onClick={() => toggleUserStatus(item)} title={item.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'} className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50">
                              {item.status === 'active' ? 'Nonaktif' : 'Aktif'}
                            </button>
                          )}
                          {resource === 'students' && item.level && gradeNumber(item.level) < 12 && <button disabled={lookupsLoading} onClick={() => openPromotion(item)} className="rounded-lg border border-teal-200 px-2 py-1 text-xs font-semibold text-teal-800 disabled:opacity-40">Naik kelas</button>}
                          <button onClick={() => remove(item.id)} title="Hapus" className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 sm:flex-row">
              <p>Menampilkan {from}-{to} dari {meta.total} data</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={meta.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Sebelumnya
                </button>
                <span>Halaman {meta.current_page} / {meta.last_page}</span>
                <button
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                >
                  Berikutnya <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="font-bold text-slate-900">
                  {modal.mode === 'create' ? `Tambah ${singular}` : modal.mode === 'edit' ? `Ubah ${singular}` : `Detail ${singular}`}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {modal.mode === 'detail' ? 'Informasi akademik yang tersimpan.' : 'Lengkapi informasi di bawah, lalu simpan perubahan.'}
                </p>
              </div>
              <button aria-label="Tutup formulir" disabled={saving} onClick={() => setModal(null)} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {modal.mode === 'detail' ? (
              <dl className="grid gap-4 p-5 sm:grid-cols-2">
                {fields.filter((k) => k !== 'password').map((key) => (
                  <div key={key}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels[key] || key}</dt>
                    <dd className="mt-1 text-sm text-slate-800">
                      {displayValue(form, key)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-end sm:col-span-2">
                  <button onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Tutup</button>
                </div>
              </dl>
            ) : (
              <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
                {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
                {fields.map((field) => (
                  <div key={field} className={field === 'description' || field === 'address' || field === 'notes' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={field} className="mb-1.5 block text-sm font-medium text-slate-700">{labels[field] || field}</label>
                    {renderInput(field)}
                  </div>
                ))}
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 sm:col-span-2">
                  <button type="button" disabled={saving} onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
                    Batal
                  </button>
                  <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {promotion && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
        <div role="dialog" aria-modal="true" aria-label="Naikkan kelas siswa" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6">
          <h2 className="text-xl font-bold">Naikkan {promotion.name}</h2>
          <p className="text-sm text-slate-600">Kelas sekarang: {gradeLabel(promotion.level)} · {promotion.class_name}. Pilih rombel tingkat {gradeLabel(promotion.targetLevel)} yang sudah dibuat.</p>
          {promotionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{promotionError}</p>}
          {!promotionYears(promotion).length && <p role="alert" className="text-sm text-amber-800">Belum ada tahun ajaran setelah {promotion.academic_year_name}. Buat tahun ajaran baru terlebih dahulu.</p>}
          <select aria-label="Tahun ajaran berikutnya" disabled={saving} className="w-full rounded-xl border p-3" value={promotion.year} onChange={e => {
            const year = e.target.value
            const semester = (lookups.semesters || []).find(item => String(item.academic_year_id) === year)
            const targets = promotionClasses(promotion, year)
            setPromotionError('')
            setPromotion({ ...promotion, year, semester: semester?.id || '', classroom: targets.length === 1 ? targets[0].id : '' })
          }}>
            <option value="">Pilih tahun ajaran</option>
            {promotionYears(promotion).map(year => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
          <select aria-label="Semester tujuan" disabled={saving || !promotion.year} className="w-full rounded-xl border p-3" value={promotion.semester} onChange={e => { setPromotionError(''); setPromotion({ ...promotion, semester: e.target.value }) }}>
            <option value="">Tanpa semester (penempatan setahun)</option>
            {(lookups.semesters || []).filter(item => String(item.academic_year_id) === String(promotion.year)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Kelas tujuan" disabled={saving || !promotion.year} className="w-full rounded-xl border p-3" value={promotion.classroom} onChange={e => { setPromotionError(''); setPromotion({ ...promotion, classroom: e.target.value }) }}>
            <option value="">Pilih kelas tujuan</option>
            {promotionClasses(promotion, promotion.year).map(classroom => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
          </select>
          {promotion.year && !promotionClasses(promotion, promotion.year).length && <p role="alert" className="text-sm text-amber-800">Belum ada kelas tingkat {gradeLabel(promotion.targetLevel)} untuk konsentrasi ini pada tahun ajaran tersebut. Buat di Administrasi → Kelas.</p>}
          <div className="flex justify-end gap-3">
            <button disabled={saving} onClick={() => setPromotion(null)} className="rounded-xl border px-4 py-2">Batal</button>
            <button disabled={saving || !promotion.year || !promotion.classroom} onClick={advanceStudent} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40">{saving ? 'Memproses...' : 'Naikkan kelas'}</button>
          </div>
        </div>
      </div>}
    </div>
  )
}

function FieldError({ text }) {
  return <span className="mt-1 block text-xs text-red-600">{text}</span>
}
