import { cloneElement, useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { panelClass, secondaryClass } from './finance'

export function Page({ title, subtitle, action, children, eyebrow = 'Keuangan Pendidikan' }) {
  return <div className="space-y-6"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>{subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>}</div>{action}</header>{children}</div>
}
export function Notice({ children, success = false }) {
  return children ? <div role={success ? 'status' : 'alert'} className={`rounded-xl border p-4 text-sm ${success ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{children}</div> : null
}
export function QueryState({ query, children, loadingLabel = 'Memuat data keuangan...' }) {
  if (query.loading) return <div role="status" className={`${panelClass} text-sm text-slate-500`}>{loadingLabel}</div>
  if (query.error) return <div className="space-y-3"><Notice>{query.error}</Notice><button onClick={query.reload} className={secondaryClass}>Coba kembali</button></div>
  return children(query.data)
}
export function Empty({ children = 'Belum ada data yang sesuai.' }) { return <p className="p-8 text-center text-sm text-slate-500">{children}</p> }
export function Status({ value }) {
  const labels = { paid: 'Lunas', unpaid: 'Belum lunas', overdue: 'Jatuh tempo terlewati', pending: 'Menunggu verifikasi', verified: 'Diterima', rejected: 'Ditolak' }
  const colors = { paid: 'bg-teal-50 text-teal-800', verified: 'bg-teal-50 text-teal-800', pending: 'bg-amber-50 text-amber-800', rejected: 'bg-red-50 text-red-800', overdue: 'bg-red-50 text-red-800', unpaid: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${colors[value] ?? colors.unpaid}`}>{labels[value] ?? 'Tidak diketahui'}</span>
}
export function Pager({ meta, onChange }) {
  if (!meta) return null
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-500"><span>{meta.total} data · Halaman {meta.current_page} dari {meta.last_page}</span><div className="flex gap-2"><button disabled={meta.current_page <= 1} className={secondaryClass} onClick={() => onChange(meta.current_page - 1)}>Sebelumnya</button><button disabled={meta.current_page >= meta.last_page} className={secondaryClass} onClick={() => onChange(meta.current_page + 1)}>Berikutnya</button></div></div>
}
export function Table({ headers, children }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-5 py-4 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 [&_td]:px-5 [&_td]:py-4">{children}</tbody></table></div>
}
export function Field({ label, children, hint }) {
  const id = useId()
  return <div className="space-y-2 text-sm font-medium text-slate-700"><label htmlFor={id} className="block">{label}</label>{cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}{hint && <p id={`${id}-hint`} className="text-xs font-normal leading-5 text-slate-500">{hint}</p>}</div>
}
export function Detail({ label, children }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{children ?? '—'}</dd></div> }
export function Back({ to, children }) { return <Link className="text-sm font-medium text-teal-700 hover:underline" to={to}>← {children}</Link> }
export function Modal({ title, onClose, busy, children }) {
  const ref = useRef(null)
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy) onClose() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-6 shadow-xl backdrop:bg-slate-900/50"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button aria-label="Tutup dialog" disabled={busy} onClick={onClose} className={secondaryClass}>Tutup</button></div>{children}</dialog>
}

