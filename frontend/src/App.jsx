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
import Services from './pages/Services'
import { serviceForPath, canOpenService } from './services'
import { useLocation } from 'react-router-dom'
import AcademicCalendar from './pages/AcademicCalendar'
import Classrooms from './pages/Classrooms'
import AcademicWorkspace from './pages/AcademicWorkspace'
import FinanceRoutes from './finance/FinancePages'
import ParentPortal from './parent/ParentPortal'
import CommunicationPages from './communication/CommunicationPages'
import AssessmentPage from './assessment/AssessmentPage'
import LmsPage from './lms/LmsPage'

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

function ServiceBoundary({ user, children }) {
  const { pathname } = useLocation()
  const service = serviceForPath(pathname)
  // Communication remains available to teachers even though they have no finance access.
  const allowed = pathname.startsWith('/communication') || !service || canOpenService(service, user.role)
  return allowed ? children : <Navigate to="/" replace />
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
              <ServiceBoundary user={user}><Routes>
                <Route path="/lms/*" element={<LmsPage user={user} />} />
                <Route path="/assessment/*" element={<AssessmentPage user={user} />} />
                <Route path="/finance/*" element={<FinanceRoutes user={user} />} />
                <Route path="/parent/*" element={<ParentPortal user={user} />} />
                <Route path="/communication/*" element={<CommunicationPages user={user} />} />

                <Route
                  path="/"
                  element={<Services user={user} />}
                />

                {user.role === 'admin' && <Route path="/administration" element={<Dashboard />} />}
                {user.role === 'admin' && <Route path="/academic-calendars" element={<AcademicCalendar />} />}
                {user.role === 'admin' && <Route path="/classrooms" element={<Classrooms />} />}
                {user.role === 'admin' && ['class-students', 'academic-registrations', 'teaching-loads', 'schedules'].map(resource => <Route key={resource} path={`/${resource}`} element={<AcademicWorkspace key={resource} resource={resource} />} />)}
                {user.role === 'admin' && Object.entries(
                  resources
                ).filter(([key]) => !['academic-calendars', 'classrooms', 'class-students', 'academic-registrations', 'teaching-loads', 'schedules'].includes(key)).map(
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

              </Routes></ServiceBoundary>
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
