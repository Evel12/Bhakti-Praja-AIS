import {
  useState
} from 'react'
import { useSchool } from '../school-context'

import {
  NavLink,
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
    try {
      await logout()
    } finally {
      onLogout()
      navigate('/login')
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

          {groups.map(
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
                        to={path}
                        end={path === '/'}
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
              'Logout'}

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
                Admin Panel
              </p>

              <p className="
                hidden
                text-xs
                text-slate-500
                sm:block
              ">
                Core Academic Information System
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
                Administrator
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
