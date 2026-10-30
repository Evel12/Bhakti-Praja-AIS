import {
  useEffect,
  useState
} from 'react'

import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom'

import {
  me
} from './api'

import Login
  from './pages/Login'

import Dashboard
  from './pages/Dashboard'

import CrudPage
  from './pages/CrudPage'

import Layout
  from './layouts/Layout'
import Roles from './pages/Roles'

const resources = {
  'teaching-loads': { title: 'Beban Mengajar', singular: 'Beban Mengajar' },
  users: {
    title: 'Data Pengguna',
    singular: 'Pengguna'
  },

  students: {
    title: 'Siswa',
    singular: 'Siswa'
  },

  teachers: {
    title: 'Guru',
    singular: 'Guru'
  },

  parents: {
    title: 'Wali Murid',
    singular: 'Wali Murid'
  },

  departments: {
    title: 'Program Keahlian',
    singular: 'Program Keahlian'
  },

  'study-programs': {
    title: 'Konsentrasi Keahlian',
    singular: 'Konsentrasi Keahlian'
  },

  subjects: {
    title: 'Mata Pelajaran',
    singular: 'Mata Pelajaran'
  },

  'academic-years': {
    title: 'Tahun Ajaran',
    singular: 'Tahun Ajaran'
  },

  semesters: {
    title: 'Semester',
    singular: 'Semester'
  },

  'academic-calendars': {
    title: 'Kalender Akademik',
    singular: 'Kegiatan'
  },

  curricula: {
    title: 'Kurikulum',
    singular: 'Kurikulum'
  },

  classrooms: {
    title: 'Kelas',
    singular: 'Kelas'
  },

  rooms: {
    title: 'Ruang Kelas',
    singular: 'Ruang'
  },

  'class-students': {
    title: 'Pembagian Kelas',
    singular: 'Penempatan Siswa'
  },

  'academic-registrations': {
    title: 'Registrasi Akademik',
    singular: 'Registrasi'
  },

  schedules: {
    title: 'Jadwal Pembelajaran',
    singular: 'Jadwal'
  },
}

export default function App() {
  const [
    user,
    setUser
  ] = useState(null)

  const [
    checking,
    setChecking
  ] = useState(true)

  useEffect(() => {
    const expired = () => setUser(null)
    window.addEventListener('ais-session-expired', expired)
    return () => window.removeEventListener('ais-session-expired', expired)
  }, [])

  useEffect(() => {
    me()
      .then((response) => {
        setUser(response.data)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setChecking(false)
      })
  }, [])

  if (checking) {
    return (
      <div className="
        min-h-screen
        grid
        place-items-center
        text-slate-500
      ">
        Memuat aplikasi...
      </div>
    )
  }

  return (
    <Routes>

      <Route
        path="/login"
        element={
          user
            ? <Navigate
                to="/"
                replace
              />
            : <Login
                onLogin={setUser}
              />
        }
      />

      <Route
        path="/*"
        element={
          user ? (
            <Layout
              user={user}
              onLogout={() => {
                setUser(null)
              }}
            >
              <Routes>
                <Route path="/roles" element={<Roles />} />

                <Route
                  path="/"
                  element={<Dashboard />}
                />

                {Object.entries(
                  resources
                ).map(
                  ([
                    key,
                    config
                  ]) => (
                    <Route
                      key={key}
                      path={`/${key}`}
                      element={
                        <CrudPage
                          key={key}
                          resource={key}
                          title={
                            config.title
                          }
                          singular={
                            config.singular
                          }
                        />
                      }
                    />
                  )
                )}

                <Route
                  path="*"
                  element={
                    <Navigate
                      to="/"
                      replace
                    />
                  }
                />

              </Routes>
            </Layout>
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

    </Routes>
  )
}
