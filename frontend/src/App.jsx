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
import FinanceRoutes from './finance/FinancePages'
import ParentPortal from './parent/ParentPortal'
import CommunicationPages from './communication/CommunicationPages'
import AssessmentPage from './assessment/AssessmentPage'

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
  const [loginDestination, setLoginDestination] = useState('/')
  const [logoutNotice, setLogoutNotice] = useState('')
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
                to={loginDestination}
                replace
              />
            : <Login
                notice={logoutNotice}
                onLogin={(profile, destination = '/') => { setLogoutNotice(''); setLoginDestination(destination); setUser(profile) }}
              />
        }
      />

      <Route
        path="/*"
        element={
          user ? (
            <Layout
              user={user}
              onLogout={(message = '') => {
                setLogoutNotice(message)
                setUser(null)
              }}
            >
              <Routes>
                <Route path="/assessment/*" element={<AssessmentPage user={user} />} />
                <Route path="/finance/*" element={<FinanceRoutes user={user} />} />
                <Route path="/parent/*" element={<ParentPortal user={user} />} />
                <Route path="/communication/*" element={<CommunicationPages user={user} />} />
                {user.role === 'admin' && <Route path="/roles" element={<Roles />} />}

                <Route
                  path="/"
                  element={user.role === 'admin' ? <Dashboard /> : <Navigate to={user.role === 'wali_murid' ? '/parent' : user.role === 'guru' ? '/communication' : '/finance'} replace />}
                />

                {user.role === 'admin' && Object.entries(
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
