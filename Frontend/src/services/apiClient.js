const TOKEN_STORAGE_KEY = 'examnia-auth-token-v1'
const SESSION_STORAGE_KEY = 'examnia-auth-session-v1'

function safeStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

export class ApiError extends Error {
  constructor(message, { status = 500, code = 'API_ERROR', details = {} } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getApiBaseUrl() {
  const configured = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_API_BASE_URL
    : ''
  return (configured || 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
}

export function getStoredToken() {
  return safeStorage()?.getItem(TOKEN_STORAGE_KEY) || null
}

export function setStoredToken(token) {
  const storage = safeStorage()
  if (!storage) return
  if (token) {
    storage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    storage.removeItem(TOKEN_STORAGE_KEY)
  }
}

export function getStoredSession() {
  const raw = safeStorage()?.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setStoredSession(session) {
  const storage = safeStorage()
  if (!storage) return
  if (session) {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } else {
    storage.removeItem(SESSION_STORAGE_KEY)
  }
}

export async function apiRequest(path, { method = 'GET', body = null, token = getStoredToken(), isMultipart = false } = {}) {
  const url = `${getApiBaseUrl()}/${String(path).replace(/^\/+/, '')}`
  const headers = {
    Accept: 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== null && !isMultipart) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === null ? undefined : (isMultipart ? body : JSON.stringify(body)),
    })
  } catch (networkErr) {
    throw new ApiError('Tidak dapat terhubung ke server API Backend.', {
      status: 0,
      code: 'NETWORK_ERROR',
      details: { cause: networkErr?.message || 'fetch_failed' },
    })
  }

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.message || `Permintaan gagal (${response.status}).`
    const code = payload?.error?.code || (response.status === 401 ? 'UNAUTHENTICATED' : 'API_ERROR')
    const details = payload?.error?.details || {}

    if (response.status === 401) {
      setStoredToken(null)
    }

    throw new ApiError(message, {
      status: response.status,
      code,
      details,
    })
  }

  return payload?.data !== undefined ? payload.data : payload
}

export const apiClient = {
  getBaseUrl: getApiBaseUrl,
  getToken: getStoredToken,
  setToken: setStoredToken,
  getSession: getStoredSession,
  setSession: setStoredSession,

  async login({ email, password, device_name = 'examnia-web' }) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password, device_name },
      token: null,
    })
    if (data?.token) {
      setStoredToken(data.token)
    }
    return data
  },

  async loginWithSso({ provider = 'undip', email = '', role = null, device_name = 'examnia-sso' }) {
    const body = { provider, device_name }
    if (email) body.email = email
    if (role) body.role = role

    const data = await apiRequest('/auth/sso', {
      method: 'POST',
      body,
      token: null,
    })
    if (data?.token) {
      setStoredToken(data.token)
    }
    return data
  },

  async me() {
    return apiRequest('/auth/me')
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      setStoredToken(null)
      setStoredSession(null)
    }
  },

  async forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      token: null,
    })
  },

  async resetPassword({ email, token, password, password_confirmation }) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { email, token, password, password_confirmation },
      token: null,
    })
  },

  async listClasses() {
    return apiRequest('/classes')
  },

  async listModules(classId) {
    return apiRequest(`/classes/${classId}/modules`)
  },

  async uploadModule(classId, { file = null, fileName = '', visibility = 'public' } = {}) {
    if (file && typeof FormData !== 'undefined') {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('visibility', visibility)
      return apiRequest(`/classes/${classId}/modules`, {
        method: 'POST',
        body: formData,
        isMultipart: true,
      })
    }

    return apiRequest(`/classes/${classId}/modules`, {
      method: 'POST',
      body: { file_name: fileName || 'modul-perkuliahan.pdf', visibility },
    })
  },

  async listClassQuizzes(classId) {
    return apiRequest(`/classes/${classId}/quizzes`)
  },

  async getQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}`)
  },

  async createQuiz({ class_id, title, description = '', deadline = null }) {
    return apiRequest('/quizzes', {
      method: 'POST',
      body: { class_id, title, description, deadline },
    })
  },

  async updateQuiz(quizId, payload) {
    return apiRequest(`/quizzes/${quizId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async deleteQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}`, {
      method: 'DELETE',
    })
  },

  async publishQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}/publish`, {
      method: 'POST',
    })
  },

  async closeQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}/close`, {
      method: 'POST',
    })
  },

  async listQuestions(quizId) {
    return apiRequest(`/quizzes/${quizId}/questions`)
  },

  async createQuestion(quizId, { question_text, options }) {
    return apiRequest(`/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: { question_text, options },
    })
  },

  async updateQuestion(quizId, questionId, { question_text }) {
    return apiRequest(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'PATCH',
      body: { question_text },
    })
  },

  async deleteQuestion(quizId, questionId) {
    return apiRequest(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'DELETE',
    })
  },

  async replaceOptions(quizId, questionId, options) {
    return apiRequest(`/quizzes/${quizId}/questions/${questionId}/options`, {
      method: 'PUT',
      body: { options },
    })
  },

  async requestQuizGeneration(moduleId, questionCount = 5) {
    return apiRequest(`/modules/${moduleId}/generate-quiz`, {
      method: 'POST',
      body: { question_count: questionCount },
    })
  },

  async getQuizGeneration(generationId) {
    return apiRequest(`/quiz-generations/${generationId}`)
  },

  async startAttempt(quizId, { game_mode = 'normal', challenge_mode = 'normal', boss_id = null, map_id = null } = {}) {
    return apiRequest(`/quizzes/${quizId}/attempts`, {
      method: 'POST',
      body: { game_mode, challenge_mode, boss_id, map_id },
    })
  },

  async getAttempt(attemptId) {
    return apiRequest(`/attempts/${attemptId}`)
  },

  async getAttemptQuestions(attemptId) {
    return apiRequest(`/attempts/${attemptId}/questions`)
  },

  async submitAnswer(attemptId, { question_id, chosen_option_id, streak = 0, multiplier = 1 }) {
    return apiRequest(`/attempts/${attemptId}/answers`, {
      method: 'POST',
      body: { question_id, chosen_option_id, streak, multiplier },
    })
  },

  async finishAttempt(attemptId) {
    return apiRequest(`/attempts/${attemptId}/finish`, {
      method: 'POST',
    })
  },

  async getPersonalGrades() {
    return apiRequest('/students/me/grades')
  },

  async getStudentAttemptReview(attemptId) {
    return apiRequest(`/attempts/${attemptId}/review`)
  },

  async getClassGradebook(classId) {
    return apiRequest(`/classes/${classId}/gradebook`)
  },

  async getQuizGrades(quizId) {
    return apiRequest(`/quizzes/${quizId}/grades`)
  },

  async getTeacherAttemptReview(quizId, attemptId) {
    return apiRequest(`/quizzes/${quizId}/attempts/${attemptId}/review`)
  },
}
