import { createContext, useContext } from 'react'

export const AssessmentShellContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  examMode: false,
  setExamMode: () => {},
})

export function useAssessmentShell() {
  return useContext(AssessmentShellContext)
}
