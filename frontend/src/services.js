export const services = [
  { id: 'administration', title: 'Administrasi', path: '/administration', roles: ['admin'], description: 'Data sekolah, siswa dan guru, kelas, kalender, serta penjadwalan.' },
  { id: 'finance', title: 'Keuangan', path: '/finance', roles: ['admin', 'murid', 'wali_murid'], description: 'Tagihan, pembayaran, laporan, portal wali, dan komunikasi sekolah.' },
  { id: 'lms', title: 'LMS', path: '/lms', roles: ['guru', 'murid', 'wali_murid'], description: 'Kelas pembelajaran, materi, tugas, progres, dan kuis AI.' },
  { id: 'assessment', title: 'Assessment', path: '/assessment', roles: ['admin', 'guru', 'murid'], description: 'Pembuatan dan pengerjaan kuis atau ujian serta hasil penilaian.' },
]

export function serviceForPath(path) {
  if (path === '/' || path === '/login') return null
  return services.find(s => s.id === (path.startsWith('/lms') ? 'lms' : path.startsWith('/assessment') ? 'assessment' : /^\/(finance|parent|communication)(\/|$)/.test(path) ? 'finance' : 'administration'))
}

export function canOpenService(service, role) {
  return service?.roles.includes(role) ?? false
}
