import { useEffect, useState } from 'react'
import api from './api'
import { SchoolContext, schoolFallback } from './school-context'

export function SchoolProvider({ children }) {
  const [school, setSchool] = useState(schoolFallback)
  useEffect(() => {
    let active = true
    api.get('/school-profile').then((response) => {
      if (active) setSchool(response.data.data)
    }).catch(() => { /* Keep school identity available while offline. */ })
    return () => { active = false }
  }, [])
  return <SchoolContext.Provider value={school}>{children}</SchoolContext.Provider>
}
