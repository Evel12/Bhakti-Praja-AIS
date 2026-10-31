import { useEffect, useState } from 'react'
import api, { getToken } from '../api'

export const types = { spp: 'SPP', exam: 'Ujian', activity: 'Kegiatan', book: 'Buku', uniform: 'Seragam' }
export const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50'
export const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryClass = 'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
export const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'

export function rupiah(value = '0.00') {
  const [whole, cents = '00'] = String(value).split('.')
  return `Rp ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents.padEnd(2, '0')}`
}
export function date(value, withTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}), timeZone: 'Asia/Jakarta' }).format(new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value))
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function errorText(error) {
  const data = error?.response?.data
  const status = error?.response?.status
  if (status === 413) return 'Berkas terlalu besar. Ukuran bukti maksimal 2 MB.'
  if (status >= 500) return 'Data gagal diproses oleh server. Silakan coba kembali.'
  if (status === 401) return 'Sesi Anda berakhir. Silakan masuk kembali.'
  if (status === 403) return 'Anda tidak memiliki hak akses untuk layanan ini.'
  if (status === 404) return 'Data tidak ditemukan atau tidak dapat diakses.'
  if (status === 422) {
    const messages = Object.values(data?.errors ?? {}).flat().filter(value => typeof value === 'string')
    return messages.join(' ') || 'Data belum valid. Periksa kembali isian Anda.'
  }
  return data?.success === false && typeof data.message === 'string' ? data.message : 'Data gagal diproses. Periksa koneksi lalu coba kembali.'
}

// Share only unsettled GETs within the same authenticated session. Never cache
// resolved student/financial data or reuse requests after a successful write.
const pendingReads = new Map()
function read(path, config) {
  if (config) return api.get(`/member4/${path}`, config).then(r => r.data)
  const key = `${getToken() ?? ''}:${path}`
  if (!pendingReads.has(key)) {
    const request = api.get(`/member4/${path}`).then(r => r.data)
    pendingReads.set(key, request)
    const clear = () => { if (pendingReads.get(key) === request) pendingReads.delete(key) }
    request.then(clear, clear)
  }
  return pendingReads.get(key)
}
async function write(method, path, payload, config) {
  const response = await api[method](`/member4/${path}`, payload, config)
  pendingReads.clear()
  return response.data
}
export const financeApi = {
  get: read,
  post: (path, payload, config) => write('post', path, payload, config),
  patch: (path, payload) => write('patch', path, payload),
}
export function financeDetailPath(resource, id, studentId) {
  return `/finance/${resource}/${id}${studentId ? `?from=parent&student_id=${encodeURIComponent(studentId)}` : ''}`
}
export function financeBackPath(resource, params, studentId) {
  return params.get('from') === 'parent' && String(studentId) === params.get('student_id')
    ? `/parent/${resource}?student_id=${encodeURIComponent(studentId)}` : `/finance/${resource}`
}
export function invoiceHistoryPath(invoiceId, studentId, params) {
  const fromParent = financeBackPath('payments', params, studentId).startsWith('/parent/')
  return `/finance/payments?invoice_id=${invoiceId}${fromParent ? `&from=parent&student_id=${studentId}` : ''}`
}
export function useFinanceQuery(path, { refreshOnFocus = false } = {}) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    financeApi.get(path)
      .then(data => { if (active) setResult({ path, revision, data }) })
      .catch(error => { if (active) setResult({ path, revision, error: errorText(error) }) })
    return () => { active = false }
  }, [path, revision])
  useEffect(() => {
    if (!refreshOnFocus) return
    const refresh = () => { if (!document.hidden) setRevision(n => n + 1) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refreshOnFocus])
  const current = result?.path === path && result?.revision === revision ? result : null
  return { loading: !current, data: current?.data, error: current?.error, reload: () => setRevision(n => n + 1) }
}

export async function studentOptions(signal) {
  const students = []
  let page = 1, last = 1
  do {
    const { data } = await api.get('/students', { params: { page, per_page: 100 }, signal })
    students.push(...data.data)
    last = data.meta.last_page
    page++
  } while (page <= last)
  return students
}
