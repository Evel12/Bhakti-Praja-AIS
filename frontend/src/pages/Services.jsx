import { Link } from 'react-router-dom'
import { GraduationCap, School, Wallet, ArrowRight, LockKeyhole } from 'lucide-react'
import { services, canOpenService } from '../services'

const icons = { administration: School, finance: Wallet, assessment: GraduationCap }

export default function Services({ user }) {
  return (
    <section className="mx-auto max-w-5xl space-y-8 py-6">
      <div>
        <p className="text-sm font-semibold text-teal-700">SISTEM AKADEMIK</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Selamat datang, {user.name}</h1>
        <p className="mt-3 text-slate-500">
          Pilih salah satu dari 3 ruang kerja utama. Navigasi dan fitur menyesuaikan peran akun Anda dalam satu tampilan terpadu.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const allowed = canOpenService(service, user.role)
          const Icon = icons[service.id]
          const targetPath =
            service.id === 'finance' && user.role === 'wali_murid'
              ? '/parent'
              : service.id === 'assessment' && user.role === 'murid'
                ? '/assessment/student'
                : service.id === 'assessment' && user.role === 'guru'
                  ? '/assessment/dashboard'
                  : service.path
          const content = (
            <>
              <Icon size={28} className={allowed ? 'text-teal-700' : 'text-slate-400'} />
              <h2 className="mt-5 text-xl font-bold">{service.title}</h2>
              <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">{service.description}</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold">
                {allowed ? (
                  <>
                    Buka layanan <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <LockKeyhole size={16} /> Tidak tersedia untuk peran akun ini
                  </>
                )}
              </div>
            </>
          )
          const style =
            'rounded-2xl border border-slate-200 bg-white p-6 ' +
            (allowed
              ? 'transition hover:border-teal-600 hover:shadow-md focus-visible:outline-teal-700'
              : 'text-slate-400')
          return allowed ? (
            <Link key={service.id} to={targetPath} className={style}>
              {content}
            </Link>
          ) : (
            <div key={service.id} className={style} aria-disabled="true">
              {content}
            </div>
          )
        })}
      </div>
      {user.role === 'guru' && (
        <p className="text-sm text-slate-600">
          Untuk pengumuman dan notifikasi sekolah, buka{' '}
          <Link className="font-semibold text-teal-800 underline" to="/communication/announcements">
            Komunikasi sekolah
          </Link>
          .
        </p>
      )}
    </section>
  )
}
