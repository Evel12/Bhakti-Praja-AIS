import { useEffect, useState } from 'react'
import api from './api'
import { SchoolContext, schoolFallback } from './school-context'

export function SchoolProvider({ children }) {
  const [school, setSchool] = useState(schoolFallback)
  useEffect(() => {
    let active = true
    api.get('/school-profile').then((response) => {
      const next = response?.data?.data
      if (active && next && typeof next === 'object') {
        setSchool({ ...schoolFallback, ...next })
      }
    }).catch(() => { /* Keep school identity available while offline. */ })
    return () => { active = false }
  }, [])
  return <SchoolContext.Provider value={school}>{children}</SchoolContext.Provider>
}
