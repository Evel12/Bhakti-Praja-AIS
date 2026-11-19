const ASSESSMENT_TOKEN_KEY = 'examnia-auth-token-v1'
const ASSESSMENT_SESSION_KEY = 'examnia-auth-session-v1'

export function clearAssessmentStorage() {
  try {
    localStorage.removeItem(ASSESSMENT_TOKEN_KEY)
    localStorage.removeItem(ASSESSMENT_SESSION_KEY)
  } catch {
    // Abaikan jika localStorage tidak tersedia.
  }
}
