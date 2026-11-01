import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarDays, GraduationCap, Receipt } from 'lucide-react'
import { Empty, Field, Notice, Page, QueryState } from '../finance/shared'
import { date, fieldClass, panelClass, rupiah, secondaryClass, useFinanceQuery } from '../finance/finance'
import { InvoiceList } from '../finance/InvoicePages'
import { PaymentList } from '../finance/PaymentPages'
import { AcademicPage, ChildInformation, SchedulePage, Unavailable } from './AcademicPages'
import { academicSections, parentLink, studentStatuses, useParentChildren } from './parent'

function ChildCards({ childrenData }) {
  return <Page eyebrow="Portal Wali Murid" title="Daftar Anak" subtitle="Pilih anak yang terhubung dengan akun Anda untuk melihat informasi akademik dan administrasinya.">
    {childrenData.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{childrenData.map(child => <article key={child.id} className={`${panelClass} space-y-4`}>
      <div className="flex items-start gap-3"><div className="rounded-xl bg-teal-50 p-3 text-teal-700"><GraduationCap size={22} /></div><div><h2 className="font-semibold text-slate-900">{child.name}</h2><p className="mt-1 text-sm text-slate-500">NIS {child.student_number}</p></div></div>
      <p className="text-xs text-slate-500">Status: {studentStatuses[child.status] ?? 'Tidak diketahui'}</p>
      <div className="flex flex-wrap gap-3"><Link className={secondaryClass} to={parentLink('', child.id)}>Lihat ringkasan</Link><Link className="self-center text-sm font-medium text-teal-700 hover:underline" to={parentLink('information', child.id)}>Informasi anak →</Link></div>
    </article>)}</div> : <EmptyChildren />}
  </Page>
}

function EmptyChildren() {
  return <section className={panelClass}><Empty>Belum ada anak yang terhubung dengan akun Anda. Hubungi administrator sekolah untuk memeriksa hubungan perwalian.</Empty></section>
}

function ParentDashboard({ studentId, childCount }) {
  const query = useFinanceQuery(`parent/children/${studentId}/dashboard`, { refreshOnFocus: true })
  return <Page eyebrow="Portal Wali Murid" title="Dashboard Wali" subtitle="Pantau informasi belajar dan administrasi pendidikan anak yang dipilih.">
    <QueryState query={query} loadingLabel="Memuat ringkasan anak...">{({ data }) => <>
      <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
        <div><h2 className="text-lg font-semibold text-slate-900">{data.student.name}</h2><p className="mt-1 text-sm text-slate-500">NIS {data.student.student_number} · {childCount} anak terhubung</p></div>
        <Link className={secondaryClass} to={parentLink('information', studentId)}>Informasi anak</Link>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { title: 'Jadwal pelajaran', value: data.schedule_count, note: 'Jadwal aktif sesuai penempatan kelas', to: 'schedules', icon: CalendarDays },
        { title: 'Tagihan pendidikan', value: data.finance.invoice_count, note: `${data.finance.paid_count} lunas · ${data.finance.unpaid_count} belum lunas`, to: 'invoices', icon: Receipt },
        { title: 'Sisa tagihan', value: rupiah(data.finance.outstanding_amount), note: `${data.finance.overdue_count} tagihan melewati tenggat`, to: 'invoices', icon: BookOpen },
        { title: 'Menunggu verifikasi', value: data.finance.pending_payment_count, note: 'Pengajuan pembayaran belum diputuskan', to: 'payments', icon: Receipt },
      ].map(({ title, value, note, to, icon: Icon }) => <Link key={title} to={parentLink(to, studentId)} className={`${panelClass} block hover:border-teal-300`}><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{title}</p><Icon size={18} className="shrink-0 text-teal-700" /></div><p className="mt-4 break-words text-2xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p></Link>)}</div>
      <section className="grid gap-4 md:grid-cols-2">{Object.entries(academicSections).map(([key, section]) => <article key={key} className={`${panelClass} space-y-4`}>
        <h2 className="font-semibold text-slate-900">{section.title}</h2><Unavailable message={data.academic[key].message} />
        <Link className="inline-block text-sm font-medium text-teal-700 hover:underline" to={parentLink(key, studentId)}>Lihat informasi →</Link>
      </article>)}</section>
      <p className="text-xs text-slate-400">Diperbarui {date(data.as_of, true)} WIB. Pembayaran dihitung setelah diterima admin.</p>
    </>}</QueryState>
  </Page>
}

function PortalContent({ childrenData }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const requestedId = params.get('student_id')
  const studentId = requestedId ?? (childrenData[0] ? String(childrenData[0].id) : '')
  const selected = childrenData.find(child => String(child.id) === studentId)
  const childrenPage = location.pathname.replace(/\/$/, '') === '/parent/children'
  return <div className="space-y-6">
    <section className={`${panelClass} flex flex-wrap items-end justify-between gap-4`} aria-label="Pilihan anak">
      <div className="min-w-0 w-full sm:max-w-sm"><Field label="Anak yang dipantau"><select className={fieldClass} value={selected ? studentId : ''} disabled={!childrenData.length} onChange={e => { const next = new URLSearchParams(params); next.set('student_id', e.target.value); next.delete('invoice_id'); setParams(next) }}>
        {!selected && <option value="">{childrenData.length ? 'Pilih anak' : 'Belum ada anak terhubung'}</option>}{childrenData.map(child => <option key={child.id} value={child.id}>{child.name} · {child.student_number}</option>)}
      </select></Field></div><Link className={secondaryClass} to={parentLink('children', selected?.id)}>Daftar anak</Link>
    </section>
    {childrenPage ? <ChildCards childrenData={childrenData} /> : !childrenData.length ? <EmptyChildren /> : !selected ? <Notice>Anak tidak ditemukan atau tidak terhubung dengan akun Anda. Pilih anak yang tersedia.</Notice> : <div key={studentId}>
      <Routes>
        <Route index element={<ParentDashboard studentId={studentId} childCount={childrenData.length} />} />
        <Route path="information" element={<ChildInformation studentId={studentId} />} />
        <Route path="schedules" element={<SchedulePage studentId={studentId} />} />
        {Object.keys(academicSections).map(section => <Route key={section} path={section} element={<AcademicPage key={section} studentId={studentId} section={section} />} />)}
        <Route path="invoices" element={<InvoiceList studentId={studentId} admin={false} />} />
        <Route path="payments" element={<PaymentList studentId={studentId} />} />
        <Route path="*" element={<Navigate to={parentLink('', studentId)} replace />} />
      </Routes>
    </div>}
  </div>
}

function ParentContent() {
  const query = useParentChildren()
  return <QueryState query={query} loadingLabel="Memuat daftar anak...">{({ data }) => <PortalContent childrenData={data} />}</QueryState>
}

export default function ParentPortal({ user }) {
  return user.role === 'wali_murid' ? <ParentContent /> : <Navigate to={user.role === 'admin' ? '/' : '/finance'} replace />
}
