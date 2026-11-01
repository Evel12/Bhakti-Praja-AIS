import {
  useState
} from 'react'
import { useSchool } from '../school-context'

import {
  NavLink,
  useLocation,
  useNavigate
} from 'react-router-dom'

import {
  logout
} from '../api'

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Settings2,
  UserRound,
  UserRoundCog,
  Users,
  Wallet,
  Receipt,
  FileCheck,
  History,
  X
} from 'lucide-react'

const groups = [
  {
    label: 'Utama',

    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard
      }
    ]
  },

  {
    label: 'Data Master',

    items: [
      {
        path: '/users',
        label: 'Data Pengguna',
        icon: Users
      },
      {
        path: '/roles',
        label: 'Hak Akses & Peran',
        icon: Settings2
      },
      {
        path: '/students',
        label: 'Siswa',
        icon: GraduationCap
      },
      {
        path: '/teachers',
        label: 'Guru',
        icon: UserRoundCog
      },
      {
        path: '/parents',
        label: 'Wali Murid',
        icon: UserRound
      },
      {
        path: '/departments',
        label: 'Program Keahlian',
        icon: School
      },
      {
        path: '/study-programs',
        label: 'Konsentrasi Keahlian',
        icon: School
      },
      {
        path: '/subjects',
        label: 'Mata Pelajaran',
        icon: BookOpen
      },
      {
        path: '/academic-years',
        label: 'Tahun Ajaran',
        icon: CalendarDays
      },
      {
        path: '/semesters',
        label: 'Semester',
        icon: CalendarDays
      },
      {
        path: '/academic-calendars',
        label: 'Kalender Akademik',
        icon: CalendarDays
      },
      {
        path: '/curricula',
        label: 'Kurikulum',
        icon: BookOpen
      },
      {
        path: '/classrooms',
        label: 'Kelas',
        icon: School
      },
      {
        path: '/rooms',
        label: 'Ruang Kelas',
        icon: DoorOpen
      }
    ]
  },

  {
    label: 'Administrasi Akademik',

    items: [
      {
        path: '/class-students',
        label: 'Pembagian Kelas',
        icon: Users
      },
      {
        path: '/teaching-loads',
        label: 'Beban Mengajar',
        icon: BookOpen
      },
      {
        path: '/academic-registrations',
        label: 'Registrasi Akademik',
        icon: Settings2
      },
      {
        path: '/schedules',
        label: 'Jadwal Pembelajaran',
        icon: CalendarDays
      }
    ]
  }
]

export default function Layout({
  user,
  onLogout,
  children
}) {
  const school = useSchool()
  const admin = user.role === 'admin'
  const parent = user.role === 'wali_murid'
  const location = useLocation()
  const navigationParams = new URLSearchParams(location.search)
  const selectedChild = location.pathname.startsWith('/parent') || navigationParams.get('from') === 'parent' ? navigationParams.get('student_id') : null
  const parentGroup = { label: 'Portal Wali Murid', items: [
    { path: '/parent', label: 'Dashboard Wali', icon: LayoutDashboard },
    { path: '/parent/children', label: 'Daftar Anak', icon: Users },
    { path: '/parent/information', label: 'Informasi Anak', icon: GraduationCap },
    { path: '/parent/grades', label: 'Nilai Akademik', icon: BookOpen },
    { path: '/parent/attendance', label: 'Absensi', icon: CalendarDays },
    { path: '/parent/assignments', label: 'Tugas', icon: BookOpen },
    { path: '/parent/schedules', label: 'Jadwal Pelajaran', icon: CalendarDays },
    { path: '/parent/progress', label: 'Perkembangan Akademik', icon: BarChart3 },
    { path: '/parent/invoices', label: 'Tagihan Pendidikan', icon: Receipt },
    { path: '/parent/payments', label: 'Riwayat Pembayaran', icon: History },
  ] }
  const roleLabel = ({ admin: 'Administrator', guru: 'Guru', murid: 'Siswa', wali_murid: 'Wali Murid' })[user.role] ?? 'Pengguna'
  const financeGroup = { label: 'Keuangan Pendidikan', items: [
    { path: '/finance', label: 'Ringkasan Keuangan', icon: Wallet },
    { path: '/finance/invoices', label: 'Tagihan Pendidikan', icon: Receipt },
    { path: '/finance/payments', label: 'Riwayat Pembayaran', icon: History },
    { path: '/finance/outstanding', label: 'Tagihan Belum Lunas', icon: CalendarDays },
    ...(admin ? [
      { path: '/finance/verification', label: 'Verifikasi Pembayaran', icon: FileCheck },
      { path: '/finance/reports', label: 'Laporan Keuangan', icon: BarChart3 },
    ] : []),
  ] }
  const communicationGroup = { label: 'Komunikasi Sekolah', items: [
    { path: '/communication/announcements', label: 'Pengumuman', icon: BookOpen },
    { path: '/communication/notifications', label: 'Pusat Notifikasi', icon: Receipt },
  ] }
  const navigationGroups = [...(admin ? [...groups, financeGroup] : parent ? [parentGroup, { label: 'Pembayaran', items: [{ path: '/finance', label: 'Keuangan Pendidikan', icon: Wallet }] }] : user.role === 'guru' ? [] : [financeGroup]), communicationGroup]
  const [
    collapsed,
    setCollapsed
  ] = useState(false)

  const [
    mobileOpen,
    setMobileOpen
  ] = useState(false)

  const navigate =
    useNavigate()

  async function handleLogout() {
    let logoutError = ''
    try {
      await logout()
    } catch (error) {
      if (error?.response?.status !== 401) {
        logoutError = 'Anda telah keluar dari perangkat ini. Server belum dapat mengonfirmasi pencabutan sesi.'
      }
    } finally {
      onLogout(logoutError)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="
      min-h-screen
      bg-slate-50
    ">

      {mobileOpen && (
        <button
          className="
            fixed
            inset-0
            z-30
            bg-slate-950/40
            lg:hidden
          "
          onClick={() =>
            setMobileOpen(false)
          }
        />
      )}

      <aside className={`
        fixed
        inset-y-0
        left-0
        z-40
        flex
        flex-col
        border-r
        border-slate-200
        bg-white
        transition-all
        duration-200

        ${
          collapsed
            ? 'w-20'
            : 'w-72'
        }

        ${
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }
      `}>

        <div className="
          flex
          h-16
          items-center
          justify-between
          border-b
          border-slate-200
          px-4
        ">

          <div className={`
            flex
            items-center
            gap-3
            overflow-hidden

            ${
              collapsed
                ? 'w-full justify-center'
                : ''
            }
          `}>

            <div className="
              grid
              h-10
              w-10
              shrink-0
              place-items-center
              rounded-xl
              bg-slate-900
              text-white
            ">
              <BarChart3 size={20} />
            </div>

            {!collapsed && (
              <div>
                <p className="
                  font-bold
                  text-slate-900
                ">
                  {school.short_name}
                </p>

                <p className="
                  text-xs
                  text-slate-500
                ">
                  Batang · NPSN {school.npsn}
                </p>
              </div>
            )}

          </div>

          <button
            aria-label="Tutup navigasi"
            className="lg:hidden"
            onClick={() =>
              setMobileOpen(false)
            }
          >
            <X size={20} />
          </button>

        </div>

        <nav className="
          flex-1
          overflow-y-auto
          p-3
        ">

          {navigationGroups.map(
            (group) => (
              <div
                key={group.label}
                className="mb-5"
              >

                {!collapsed && (
                  <p className="
                    mb-2
                    px-3
                    text-[11px]
                    font-semibold
                    uppercase
                    tracking-wider
                    text-slate-400
                  ">
                    {group.label}
                  </p>
                )}

                <div className="space-y-1">

                  {group.items.map(
                    ({
                      path,
                      label,
                      icon: Icon
                    }) => (
                      <NavLink
                        key={path}
                        to={parent && path.startsWith('/parent') && selectedChild ? `${path}?student_id=${encodeURIComponent(selectedChild)}` : path}
                        end={path === '/' || path === '/finance' || path === '/parent'}
                        title={label}
                        onClick={() =>
                          setMobileOpen(
                            false
                          )
                        }
                        className={({
                          isActive
                        }) =>
                          `
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          px-3
                          py-2.5
                          text-sm
                          font-medium

                          ${
                            isActive
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }

                          ${
                            collapsed
                              ? 'justify-center'
                              : ''
                          }
                        `
                        }
                      >

                        <Icon size={18} />

                        {!collapsed &&
                          <span>
                            {label}
                          </span>
                        }

                      </NavLink>
                    )
                  )}

                </div>

              </div>
            )
          )}

        </nav>

        <div className="
          border-t
          border-slate-200
          p-3
        ">

          <button
            onClick={handleLogout}
            className={`
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-3
              py-2.5
              text-sm
              font-medium
              text-red-600
              hover:bg-red-50

              ${
                collapsed
                  ? 'justify-center'
                  : ''
              }
            `}
          >

            <LogOut size={18} />

            {!collapsed &&
              'Keluar'}

          </button>

        </div>

      </aside>

      <div className={`
        transition-all

        ${
          collapsed
            ? 'lg:pl-20'
            : 'lg:pl-72'
        }
      `}>

        <header className="
          sticky
          top-0
          z-20
          flex
          h-16
          items-center
          justify-between
          border-b
          border-slate-200
          bg-white/95
          px-4
          backdrop-blur
          sm:px-6
        ">

          <div className="
            flex
            items-center
            gap-3
          ">

            <button
              aria-label="Buka navigasi"
              className="
                lg:hidden
                rounded-lg
                p-2
                hover:bg-slate-100
              "
              onClick={() =>
                setMobileOpen(true)
              }
            >
              <Menu size={20} />
            </button>

            <button
              aria-label="Ubah lebar navigasi"
              className="
                hidden
                rounded-lg
                p-2
                hover:bg-slate-100
                lg:grid
              "
              onClick={() =>
                setCollapsed(
                  !collapsed
                )
              }
            >
              {collapsed
                ? <ChevronRight size={20} />
                : <ChevronLeft size={20} />
              }
            </button>

            <div>

              <p className="
                text-sm
                font-semibold
                text-slate-900
              ">
                {admin ? 'Panel Administrasi' : parent ? 'Portal Wali Murid' : user.role === 'guru' ? 'Komunikasi Sekolah' : 'Keuangan Pendidikan'}
              </p>

              <p className="
                hidden
                text-xs
                text-slate-500
                sm:block
              ">
                Sistem Informasi Akademik
              </p>

            </div>

          </div>

          <div className="
            flex
            items-center
            gap-3
          ">

            <div className="
              hidden
              text-right
              sm:block
            ">

              <p className="
                text-sm
                font-semibold
                text-slate-800
              ">
                {user.name}
              </p>

              <p className="
                text-xs
                text-slate-500
              ">
                {roleLabel}
              </p>

            </div>

            <div className="
              grid
              h-9
              w-9
              place-items-center
              rounded-full
              bg-slate-900
              text-sm
              font-bold
              text-white
            ">
              {user.name?.charAt(0) || 'A'}
            </div>

          </div>

        </header>

        <main className="p-4 sm:p-6">
          {children}
        </main>

      </div>

    </div>
  )
}
