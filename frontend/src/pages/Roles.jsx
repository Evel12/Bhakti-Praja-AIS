import { useEffect, useState } from 'react'
import { ShieldCheck, Users, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getRoles } from '../api'

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getRoles().then((response) => { if (active) setRoles(response.data) })
      .catch(() => { if (active) setError('Gagal memuat peran. Muat ulang halaman untuk mencoba kembali.') })
    return () => { active = false }
  }, [])
  return <div>
    <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Manajemen Akses</p>
    <h1 className="mt-1 text-3xl font-bold text-slate-900">Hak Akses & Peran</h1>
    <p className="mt-2 max-w-2xl text-sm text-slate-500">Peran menentukan akses pengguna. Pengelolaan data master dan administrasi AIS tersedia bagi administrator.</p>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!roles.length && !error && <p role="status" className="mt-6 text-slate-500">Memuat peran...</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {roles.map((role) => <article key={role.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <ShieldCheck className="mb-4 text-teal-600" size={26} />
        <h2 className="text-lg font-bold text-slate-900">{role.display_name || role.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{role.description || 'Peran pengguna sistem akademik.'}</p>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{role.name === 'admin' ? 'Akses administrasi AIS: kelola pengguna, data master, dan administrasi akademik.' : 'Tidak memiliki akses ke panel administrasi AIS.'}</p>
      </article>)}
    </div>
    <Link to="/users" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"><Users size={18} /> Atur Peran Pengguna <ArrowRight size={16} /></Link>
  </div>
}
