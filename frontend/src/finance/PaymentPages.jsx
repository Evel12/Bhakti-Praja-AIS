import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../api'
import { Back, Detail, Empty, Field, Modal, Notice, Page, Pager, QueryState, Status, Table } from './shared'
import { financeDetailPath, financeBackPath, buttonClass, date, errorText, fieldClass, financeApi, panelClass, rupiah, secondaryClass, types, useFinanceQuery } from './finance'

export function PaymentList({ verification = false, studentId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? (verification ? 'pending' : '')
  const page = searchParams.get('page') ?? 1
  const contextStudent = studentId ?? (searchParams.get('from') === 'parent' ? searchParams.get('student_id') : undefined)
  function updateQuery(values) {
    const next = new URLSearchParams(searchParams)
    Object.entries(values).forEach(([key, value]) => next.set(key, String(value)))
    setSearchParams(next)
  }
  const params = new URLSearchParams({ page, per_page: 15 })
  if (contextStudent) params.set('student_id', contextStudent)
  if (status) params.set('status', status)
  if (searchParams.get('invoice_id')) params.set('invoice_id', searchParams.get('invoice_id'))
  const query = useFinanceQuery(`payments?${params}`)
  return <Page title={verification ? 'Verifikasi Pembayaran' : 'Riwayat Pembayaran'} subtitle={verification ? 'Periksa bukti dan informasi tagihan sebelum menerima atau menolak pembayaran.' : 'Pengajuan pembayaran beserta keputusan verifikasinya.'}><div className={`${panelClass} flex flex-wrap items-end gap-4`}><Field label="Status pembayaran"><select value={status} onChange={e => updateQuery({ status: e.target.value, page: 1 })} className={fieldClass}><option value="">Semua status</option><option value="pending">Menunggu verifikasi</option><option value="verified">Diterima</option><option value="rejected">Ditolak</option></select></Field>{searchParams.get('invoice_id') && <Link className={secondaryClass} to={contextStudent ? `/parent/payments?student_id=${encodeURIComponent(contextStudent)}` : '/finance/payments'}>Tampilkan semua tagihan</Link>}</div><QueryState query={query}>{response => <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{response.data.length ? <Table headers={['Pembayaran', 'Siswa / tagihan', 'Tanggal', 'Nominal', 'Status', 'Tindakan']}>{response.data.map(payment => <tr key={payment.id}><td className="font-medium">#{payment.id}<p className="mt-1 text-xs font-normal text-slate-500">{payment.payment_method}</p></td><td><p>{payment.invoice?.student?.name}</p><Link className="mt-1 block text-xs text-teal-700 hover:underline" to={financeDetailPath('invoices', payment.invoice_id, contextStudent)}>#{payment.invoice_id} · {types[payment.invoice?.invoice_type]}</Link></td><td className="whitespace-nowrap">{date(payment.payment_date)}</td><td className="whitespace-nowrap font-medium">{rupiah(payment.amount)}</td><td><Status value={payment.status} /></td><td><Link className="font-medium text-teal-700 hover:underline" to={financeDetailPath('payments', payment.id, contextStudent)}>{verification && payment.status === 'pending' ? 'Periksa bukti' : 'Detail'}</Link></td></tr>)}</Table> : <Empty>{verification ? 'Tidak ada pengajuan dengan status ini.' : 'Belum ada riwayat pembayaran.'}</Empty>}<Pager meta={response.meta} onChange={page => updateQuery({ page })} /></div>}</QueryState></Page>
}

function Evidence({ payment }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    let url
    api.get(`/member4/payments/${payment.id}/proof`, { signal: controller.signal, responseType: 'blob' }).then(response => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(response.data)
      setResult({ id: payment.id, attempt, url })
    }).catch(async error => {
      let message = errorText(error)
      try { const data = JSON.parse(await error.response.data.text()); message = errorText({ response: { status: error.response.status, data } }) } catch { /* Use the safe transport error message. */ }
      if (!controller.signal.aborted) setResult({ id: payment.id, attempt, error: message })
    })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [payment.id, attempt])
  const current = result?.id === payment.id && result?.attempt === attempt ? result : null
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[payment.proof_mime] ?? 'bin'
  return <section className={`${panelClass} space-y-4`}><div><h2 className="font-semibold">Bukti Pembayaran</h2><p className="mt-1 text-xs text-slate-500">{payment.proof_mime} · {Math.ceil(payment.proof_size / 1024)} KB</p></div>{!current ? <p role="status" className="text-sm text-slate-500">Memuat bukti pembayaran...</p> : current.error ? <><Notice>{current.error}</Notice><button onClick={() => setAttempt(n => n + 1)} className={secondaryClass}>Muat ulang bukti</button></> : <>{payment.proof_mime.startsWith('image/') && <img alt={`Bukti pembayaran #${payment.id}`} className="max-h-[32rem] w-full rounded-xl border border-slate-100 bg-slate-50 object-contain" src={current.url} />}<a className={secondaryClass} href={current.url} download={`bukti-pembayaran-${payment.id}.${extension}`}>Unduh bukti {extension.toUpperCase()}</a>{extension === 'pdf' && <p className="text-xs text-slate-500">Unduh PDF untuk memeriksa bukti sebelum mengambil keputusan.</p>}</>}</section>
}

export function PaymentDetail({ admin }) {
  const { id } = useParams()
  return <PaymentDetailContent key={id} id={id} admin={admin} />
}
function PaymentDetailContent({ id, admin }) {
  const [params] = useSearchParams()
  const query = useFinanceQuery(`payments/${id}`)
  const [decision, setDecision] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function verify() {
    setBusy(true); setError('')
    try { const result = await financeApi.patch(`payments/${id}/verification`, { decision }); setDecision(null); setSuccess(result.message); query.reload() } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <Page title={`Detail Pembayaran #${id}`}><Back to={admin ? '/finance/verification' : financeBackPath('payments', params, query.data?.data?.invoice?.student_id)}>{admin ? 'Daftar verifikasi' : 'Riwayat pembayaran'}</Back><Notice success>{success}</Notice><QueryState query={query}>{({ data: payment }) => <><section className={panelClass}><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{payment.invoice?.student?.name}</h2><Link className="mt-1 block text-sm text-teal-700 hover:underline" to={financeDetailPath('invoices', payment.invoice_id, financeBackPath('payments', params, payment.invoice?.student_id).startsWith('/parent/') ? payment.invoice?.student_id : undefined)}>Tagihan #{payment.invoice_id} · {types[payment.invoice?.invoice_type]}</Link></div><Status value={payment.status} /></div><dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Nominal pembayaran">{rupiah(payment.amount)}</Detail><Detail label="Nominal tagihan">{rupiah(payment.invoice?.amount)}</Detail><Detail label="Sisa tagihan">{rupiah(payment.invoice?.outstanding_amount)}</Detail><Detail label="Tanggal pembayaran">{date(payment.payment_date)}</Detail><Detail label="Metode">{payment.payment_method}</Detail><Detail label="Nomor transaksi">{payment.transaction_number}</Detail><Detail label="Diajukan oleh">{payment.submitter?.name}</Detail><Detail label="Waktu pengajuan">{date(payment.created_at, true)} WIB</Detail><Detail label="Pemeriksa">{payment.verifier?.name}</Detail>{payment.verified_at && <Detail label="Waktu keputusan">{date(payment.verified_at, true)} WIB</Detail>}</dl></section><Evidence payment={payment} />{admin && payment.status === 'pending' && <section className={`${panelClass} space-y-4`}><h2 className="font-semibold">Keputusan Verifikasi</h2><p className="text-sm leading-6 text-slate-500">Periksa bukti, nominal, dan tagihan terkait. Pembayaran yang diterima akan melunasi tagihan. Keputusan yang disimpan tidak dapat diganti.</p><div className="flex flex-wrap gap-3"><button onClick={() => { setError(''); setDecision('verified') }} className={buttonClass}>Terima pembayaran</button><button onClick={() => { setError(''); setDecision('rejected') }} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Tolak pembayaran</button></div></section>}{decision && <Modal title={decision === 'verified' ? 'Terima Pembayaran?' : 'Tolak Pembayaran?'} busy={busy} onClose={() => setDecision(null)}><div className="space-y-5"><Notice>{error}</Notice><p className="text-sm leading-6 text-slate-600">{decision === 'verified' ? `Pembayaran ${rupiah(payment.amount)} akan diterima dan tagihan ditandai lunas.` : 'Pengajuan ini akan ditolak. Siswa atau wali dapat mengajukan bukti baru.'} Keputusan tidak dapat diganti.</p><button onClick={verify} disabled={busy} className={`${buttonClass} w-full`}>{busy ? 'Menyimpan...' : 'Simpan keputusan'}</button></div></Modal>}</>}</QueryState></Page>
}
