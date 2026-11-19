export const services = [
  { id: 'administration', title: 'Administrasi', path: '/administration', roles: ['admin'], description: 'Data sekolah, siswa dan guru, kelas, kalender, serta penjadwalan.' },
  { id: 'finance', title: 'Keuangan', path: '/finance', roles: ['admin', 'murid', 'wali_murid'], description: 'Tagihan, pembayaran, laporan, portal wali, dan komunikasi sekolah.' },
  { id: 'assessment', title: 'Assessment', path: '/assessment', roles: ['admin', 'guru', 'murid'], description: 'Kuis, ujian, kelas & materi LMS, bank soal, serta hasil penilaian.' },
]

export function serviceForPath(path) {
  if (path === '/' || path === '/login') return null
  if (path.startsWith('/lms') || path.startsWith('/assessment')) {
    return services.find((s) => s.id === 'assessment')
  }
  if (/^\/(finance|parent|communication)(\/|$)/.test(path)) {
    return services.find((s) => s.id === 'finance')
  }
  return services.find((s) => s.id === 'administration')
}

export function canOpenService(service, role) {
  return service?.roles.includes(role) ?? false
}
