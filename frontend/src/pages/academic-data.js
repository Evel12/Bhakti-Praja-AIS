import { listResource } from '../api'

export const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700'
export const primaryClass = 'rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40'
export const secondaryClass = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40'
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export async function allRecords(resource) {
  const records = []
  let page = 1, last = 1
  do {
    const response = await listResource(resource, { per_page: 100, page })
    records.push(...(response.data || []))
    last = response.meta?.last_page || 1
    page++
  } while (page <= last)
  return records
}
export function message(error) {
  const data = error?.response?.data
  return Object.values(data?.errors || {}).flat().join(' ') || data?.message || 'Gagal memproses data. Silakan coba lagi.'
}
