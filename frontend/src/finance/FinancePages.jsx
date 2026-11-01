import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Banknote, Clock3, Receipt, CircleCheck } from 'lucide-react'
import { Page, QueryState, Table } from './shared'
import { panelClass, rupiah, date, types, useFinanceQuery, secondaryClass } from './finance'
import { InvoiceDetail, InvoiceList } from './InvoicePages'
import { PaymentDetail, PaymentList } from './PaymentPages'

function SummaryCards({ data, admin = false }) {
  const cards = [
    { label: 'Jumlah tagihan', value: data.invoice_count, note: `${data.paid_count} lunas · ${data.unpaid_count} belum lunas`, icon: Receipt, to: '/finance/invoices' },
    { label: 'Pembayaran diterima', value: rupiah(data.verified_amount), note: `${data.verified_payment_count} pembayaran terverifikasi`, icon: CircleCheck, to: '/finance/payments?status=verified' },
    { label: 'Sisa tagihan', value: rupiah(data.outstanding_amount), note: `${data.overdue_count} tagihan melewati tenggat`, icon: Banknote, to: '/finance/outstanding' },
    { label: 'Menunggu verifikasi', value: data.pending_payment_count, note: 'Belum mengurangi sisa tagihan', icon: Clock3, to: admin ? '/finance/verification' : '/finance/payments?status=pending' },
  ]
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon, to }) => <Link key={label} to={to} className={`${panelClass} block hover:border-teal-300`}><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{label}</p><Icon size={19} className="shrink-0 text-teal-700" /></div><p className="break-words text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p></Link>)}</div>
}
function FinanceDashboard({ admin }) {
  const query = useFinanceQuery('finance/summary', { refreshOnFocus: true })
  return <Page title="Ringkasan Keuangan" subtitle={admin ? 'Pantau tagihan pendidikan, pembayaran masuk, dan tunggakan sekolah.' : 'Lihat tagihan dan pembayaran yang terkait dengan akun Anda.'}><QueryState query={query}>{({ data }) => <><SummaryCards data={data} admin={admin} /><div className={`${panelClass} space-y-5`}><div><h2 className="font-semibold text-slate-900">Tindak lanjut pembayaran</h2><p className="mt-2 text-sm text-slate-500">Tagihan melewati tenggat: <strong className="text-red-700">{rupiah(data.overdue_amount)}</strong>. Pembayaran dihitung setelah diterima oleh admin.</p></div><div className="flex flex-wrap gap-3"><Link className={secondaryClass} to="/finance/invoices">Lihat tagihan</Link><Link className={secondaryClass} to="/finance/outstanding">Lihat tunggakan</Link><Link className={secondaryClass} to={admin ? '/finance/verification' : '/finance/payments'}>{admin ? 'Periksa pengajuan' : 'Riwayat pembayaran'}</Link></div><p className="text-xs text-slate-400">Diperbarui {date(data.as_of, true)} WIB</p></div></>}</QueryState></Page>
}
function FinanceReports() {
  const query = useFinanceQuery('finance/reports', { refreshOnFocus: true })
  return <Page title="Laporan Keuangan" subtitle="Posisi seluruh tagihan saat ini. Hanya pembayaran terverifikasi yang dihitung sebagai pembayaran diterima." action={<button className={secondaryClass} disabled={query.loading} onClick={query.reload}>Perbarui laporan</button>}><QueryState query={query}>{({ data }) => <><SummaryCards data={data.summary} admin /><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="font-semibold">Rincian per Jenis Tagihan</h2><p className="mt-1 text-xs text-slate-500">Posisi {date(data.as_of, true)} WIB</p></div><Table headers={['Jenis', 'Jumlah', 'Total tagihan', 'Diterima', 'Sisa tagihan', 'Lewat tenggat']} >{data.by_type.map(row => <tr key={row.invoice_type}><td className="font-medium">{types[row.invoice_type]}</td><td>{row.invoice_count}</td><td className="whitespace-nowrap">{rupiah(row.billed_amount)}</td><td className="whitespace-nowrap text-teal-700">{rupiah(row.verified_amount)}</td><td className="whitespace-nowrap">{rupiah(row.outstanding_amount)}</td><td className="whitespace-nowrap text-red-700">{rupiah(row.overdue_amount)}</td></tr>)}</Table></div><div className={panelClass}><h2 className="font-semibold">Status Pembayaran</h2><p className="mt-3 text-sm leading-7 text-slate-600">{data.summary.pending_payment_count} menunggu verifikasi · {data.summary.verified_payment_count} diterima · {data.summary.rejected_payment_count} ditolak</p><Link to="/finance/payments" className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">Buka riwayat pembayaran →</Link></div></>}</QueryState></Page>
}
export default function FinanceRoutes({ user }) {
  const admin = user.role === 'admin'
  if (!['admin', 'murid', 'wali_murid'].includes(user.role)) return <Navigate to="/" replace />
  return <Routes><Route index element={<FinanceDashboard admin={admin} />} /><Route path="invoices" element={<InvoiceList admin={admin} />} /><Route path="invoices/:id" element={<InvoiceDetail admin={admin} />} /><Route path="outstanding" element={<InvoiceList key="outstanding" outstanding admin={admin} />} /><Route path="payments" element={<PaymentList key="history" />} /><Route path="payments/:id" element={<PaymentDetail admin={admin} />} />{admin && <><Route path="verification" element={<PaymentList key="verification" verification />} /><Route path="reports" element={<FinanceReports />} /></>}<Route path="*" element={<Navigate to="/finance" replace />} /></Routes>
}
