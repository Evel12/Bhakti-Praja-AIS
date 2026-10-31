import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PaymentReminder from '../communication/PaymentReminder'
import { Back, Detail, Empty, Field, Modal, Notice, Page, Pager, QueryState, Status, Table } from './shared'
import { financeDetailPath, financeBackPath, invoiceHistoryPath, buttonClass, date, errorText, fieldClass, financeApi, panelClass, rupiah, secondaryClass, studentOptions, today, types, useFinanceQuery } from './finance'

function InvoiceForm({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({ student_id: invoice?.student_id ?? '', invoice_type: invoice?.invoice_type ?? 'spp', amount: invoice?.amount ?? '', due_date: invoice?.due_date ?? '' })
  const [options, setOptions] = useState(null)
  const [optionError, setOptionError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    studentOptions(controller.signal).then(rows => { if (!controller.signal.aborted) { setOptions(rows); setOptionError('') } }).catch(e => { if (!controller.signal.aborted) setOptionError(errorText(e)) })
    return () => controller.abort()
  }, [attempt])
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const response = invoice ? await financeApi.patch(`invoices/${invoice.id}`, form) : await financeApi.post('invoices', form)
      onSaved(response.message)
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <Modal title={invoice ? 'Ubah Tagihan' : 'Buat Tagihan'} onClose={onClose} busy={busy}><form onSubmit={save} className="space-y-4"><Notice>{error}</Notice>{optionError ? <><Notice>{optionError}</Notice><button type="button" className={secondaryClass} onClick={() => setAttempt(n => n + 1)}>Muat ulang daftar siswa</button></> : options === null ? <p role="status" className="text-sm text-slate-500">Memuat siswa...</p> : options.length === 0 ? <p className="text-sm text-amber-800">Belum ada data siswa. Lengkapi data siswa melalui modul akademik sebelum membuat tagihan.</p> : null}<Field label="Siswa"><select autoFocus required name="student_id" value={form.student_id} onChange={change} disabled={busy || !options?.length} className={fieldClass}><option value="">Pilih siswa</option>{options?.map(s => <option key={s.id} value={s.id}>{s.student_number} — {s.name}</option>)}</select></Field><Field label="Jenis tagihan"><select name="invoice_type" value={form.invoice_type} onChange={change} disabled={busy} className={fieldClass}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Nominal (Rp)"><input required name="amount" inputMode="decimal" type="number" min="0.01" max="9999999999.99" step="0.01" value={form.amount} onChange={change} disabled={busy} className={fieldClass} /></Field><Field label="Tenggat pembayaran"><input required type="date" name="due_date" value={form.due_date} onChange={change} disabled={busy} className={fieldClass} /></Field><p className="text-xs leading-5 text-slate-500">Tagihan dapat diubah sebelum memiliki catatan pembayaran.</p><button className={`${buttonClass} w-full`} disabled={busy || !options?.length}>{busy ? 'Menyimpan...' : 'Simpan tagihan'}</button></form></Modal>
}

export function InvoiceList({ admin, outstanding = false, studentId }) {
  const [filters, setFilters] = useState({ search: '', invoice_type: '', status: '', overdue: false, page: 1 })
  const [editor, setEditor] = useState(null)
  const [success, setSuccess] = useState('')
  const params = new URLSearchParams({ page: filters.page, per_page: 15 })
  if (studentId) params.set('student_id', studentId)
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.invoice_type) params.set('invoice_type', filters.invoice_type)
  if (!outstanding && filters.status) params.set('status', filters.status)
  if (outstanding) params.set('outstanding', '1')
  if (filters.overdue) params.set('overdue', '1')
  const query = useFinanceQuery(`invoices?${params}`)
  const filter = e => setFilters({ ...filters, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value, page: 1 })
  return <Page title={outstanding ? 'Tagihan Belum Lunas' : 'Tagihan Pendidikan'} subtitle={outstanding ? 'Sisa tagihan dihitung dari nominal tagihan dikurangi pembayaran yang diterima admin.' : 'Kelola dan pantau pembayaran pendidikan sesuai data siswa.'} action={admin && !outstanding && <button className={buttonClass} onClick={() => { setSuccess(''); setEditor({}) }}>Buat tagihan</button>}><Notice success>{success}</Notice><div className={`${panelClass} flex flex-wrap items-end gap-4`}><div className="min-w-44 flex-1"><Field label="Cari siswa atau NIS"><input type="search" className={fieldClass} name="search" value={filters.search} onChange={filter} placeholder="Nama siswa atau NIS" /></Field></div><Field label="Jenis"><select className={fieldClass} name="invoice_type" value={filters.invoice_type} onChange={filter}><option value="">Semua jenis</option>{Object.entries(types).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Field>{!outstanding && <Field label="Status"><select className={fieldClass} name="status" value={filters.status} onChange={filter}><option value="">Semua status</option><option value="unpaid">Belum lunas</option><option value="paid">Lunas</option></select></Field>}<label className="flex items-center gap-2 py-3 text-sm text-slate-600"><input type="checkbox" name="overdue" checked={filters.overdue} onChange={filter} className="accent-teal-700" />Lewat tenggat</label></div><QueryState query={query}>{response => <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{response.data.length ? <Table headers={['Siswa', 'Tagihan', 'Nominal / sisa', 'Tenggat', 'Status', 'Tindakan']}>{response.data.map(bill => <tr key={bill.id}><td><p className="font-medium text-slate-900">{bill.student?.name}</p><p className="mt-1 text-xs text-slate-500">{bill.student?.student_number}</p></td><td><Link to={financeDetailPath('invoices', bill.id, studentId)} className="font-medium text-teal-700 hover:underline">#{bill.id} · {types[bill.invoice_type]}</Link></td><td className="whitespace-nowrap"><p>{rupiah(bill.amount)}</p><p className="mt-1 text-xs text-slate-500">Sisa {rupiah(bill.outstanding_amount)}</p></td><td className="whitespace-nowrap">{date(bill.due_date)}</td><td><Status value={bill.display_status} />{bill.pending_payments_count > 0 && <p className="mt-2 text-xs text-amber-700">Menunggu verifikasi</p>}</td><td><div className="flex gap-3"><Link className="text-sm font-medium text-teal-700 hover:underline" to={financeDetailPath('invoices', bill.id, studentId)}>Detail</Link>{admin && bill.payments_count === 0 && bill.status === 'unpaid' && <button className="text-sm text-slate-600 hover:underline" onClick={() => { setSuccess(''); setEditor(bill) }}>Ubah</button>}</div></td></tr>)}</Table> : <Empty>{outstanding ? 'Belum ada tagihan yang belum lunas.' : 'Belum ada tagihan yang sesuai.'}</Empty> }<Pager meta={response.meta} onChange={page => setFilters({ ...filters, page })} /></div>}</QueryState>{editor && <InvoiceForm invoice={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={message => { setEditor(null); setSuccess(message); query.reload() }} />}</Page>
}

function PaymentSubmission({ invoice, onSaved }) {
  const [form, setForm] = useState({ payment_date: today(), payment_method: '', transaction_number: '' })
  const [proof, setProof] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setError('')
    if (!proof || proof.size > 2 * 1024 * 1024 || !/\.(jpe?g|png|pdf)$/i.test(proof.name)) { setError('Pilih bukti JPG, JPEG, PNG, atau PDF dengan ukuran maksimal 2 MB.'); return }
    setBusy(true)
    const data = new FormData()
    Object.entries({ ...form, amount: invoice.amount }).forEach(([key, value]) => data.append(key, value))
    data.append('proof', proof)
    try { const response = await financeApi.post(`invoices/${invoice.id}/payments`, data, { headers: { 'Content-Type': undefined } }); onSaved(response.message) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <section className={panelClass}><h2 className="font-semibold text-slate-900">Ajukan Pembayaran</h2><p className="mt-2 text-sm leading-6 text-slate-500">Unggah bukti pembayaran penuh sebesar <strong>{rupiah(invoice.amount)}</strong>. Tagihan baru lunas setelah admin menerima pembayaran.</p><form onSubmit={submit} className="mt-5 space-y-4"><Notice>{error}</Notice><div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal pembayaran"><input required name="payment_date" type="date" max={today()} value={form.payment_date} onChange={change} disabled={busy} className={fieldClass} /></Field><Field label="Metode pembayaran" hint="Tuliskan metode yang digunakan, misalnya transfer bank."><input required name="payment_method" maxLength={50} value={form.payment_method} onChange={change} disabled={busy} className={fieldClass} /></Field></div><Field label="Nomor transaksi (opsional)"><input name="transaction_number" maxLength={100} value={form.transaction_number} onChange={change} disabled={busy} className={fieldClass} /></Field><Field label="Bukti pembayaran" hint="JPG, JPEG, PNG, atau PDF. Maksimal 2 MB. Bukti hanya dapat diakses pihak yang berhak."><input required type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setProof(e.target.files[0] ?? null)} disabled={busy} className={fieldClass} /></Field><button className={buttonClass} disabled={busy}>{busy ? 'Mengunggah...' : 'Kirim bukti pembayaran'}</button></form></section>
}
export function InvoiceDetail({ admin }) {
  const { id } = useParams()
  return <InvoiceDetailContent key={id} id={id} admin={admin} />
}
function InvoiceDetailContent({ id, admin }) {
  const [params] = useSearchParams()
  const query = useFinanceQuery(`invoices/${id}`)
  const [success, setSuccess] = useState('')
  const [editor, setEditor] = useState(false)
  return <Page title={`Detail Tagihan #${id}`}><Back to={financeBackPath('invoices', params, query.data?.data?.student_id)}>Daftar tagihan</Back><Notice success>{success}</Notice><QueryState query={query}>{({ data: bill }) => <><section className={panelClass}><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{types[bill.invoice_type]} · {bill.student?.name}</h2><p className="mt-1 text-sm text-slate-500">NIS {bill.student?.student_number}</p></div><Status value={bill.display_status} /></div><dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Nominal tagihan">{rupiah(bill.amount)}</Detail><Detail label="Pembayaran diterima">{rupiah(bill.verified_amount)}</Detail><Detail label="Sisa tagihan">{rupiah(bill.outstanding_amount)}</Detail><Detail label="Tenggat">{date(bill.due_date)}</Detail></dl><div className="mt-6 flex flex-wrap gap-3"><Link className={secondaryClass} to={invoiceHistoryPath(bill.id, bill.student_id, params)}>Riwayat pembayaran tagihan</Link>{admin && bill.payments_count === 0 && bill.status === 'unpaid' && <button className={secondaryClass} onClick={() => setEditor(true)}>Ubah tagihan</button>}</div></section>{admin && bill.status === 'unpaid' && bill.outstanding_amount !== '0.00' && <PaymentReminder invoice={bill} />}{!admin && bill.status !== 'paid' && bill.verified_amount === '0.00' && bill.pending_payments_count === 0 && <PaymentSubmission key={bill.id} invoice={bill} onSaved={message => { setSuccess(message); query.reload() }} />}{bill.pending_payments_count > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Bukti sudah diajukan dan menunggu verifikasi admin. Pengajuan baru dapat dilakukan setelah pengajuan sebelumnya ditolak.</div>}{editor && <InvoiceForm invoice={bill} onClose={() => setEditor(false)} onSaved={message => { setEditor(false); setSuccess(message); query.reload() }} />}</>}</QueryState></Page>
}
