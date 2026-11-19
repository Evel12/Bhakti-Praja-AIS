import { useMemo, useState } from 'react'
import { AssessmentShellContext } from './useAssessmentShell'

export function AssessmentShellProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [examMode, setExamMode] = useState(false)

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, examMode, setExamMode }),
    [unreadCount, examMode],
  )

  return (
    <AssessmentShellContext.Provider value={value}>
      {children}
    </AssessmentShellContext.Provider>
  )
}
