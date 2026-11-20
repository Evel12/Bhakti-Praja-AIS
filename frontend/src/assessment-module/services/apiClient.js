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

let runtimeBaseUrl = ''
let unauthorizedHandler = null
const combinedShellHolders = new Map()
let externalCombinedShell = false
let preShellBaseUrl = ''

export function setApiBaseUrl(url) {
  runtimeBaseUrl = String(url || '').trim().replace(/\/+$/, '')
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null
}

export function retainCombinedShell(holderId, baseUrl = '') {
  if (!combinedShellHolders.size) {
    externalCombinedShell = Boolean(globalThis.__AIS_COMBINED_SHELL__)
    preShellBaseUrl = runtimeBaseUrl
  }
  const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '')
  combinedShellHolders.set(holderId, normalizedBase)
  globalThis.__AIS_COMBINED_SHELL__ = true
  if (normalizedBase) {
    setApiBaseUrl(normalizedBase)
  }
}

export function releaseCombinedShell(holderId) {
  if (!combinedShellHolders.has(holderId)) return
  combinedShellHolders.delete(holderId)
  if (!combinedShellHolders.size) {
    setApiBaseUrl(preShellBaseUrl)
    preShellBaseUrl = ''
    if (!externalCombinedShell) {
      delete globalThis.__AIS_COMBINED_SHELL__
    }
    externalCombinedShell = false
    return
  }
  globalThis.__AIS_COMBINED_SHELL__ = true
  const remainingBases = [...combinedShellHolders.values()].filter(Boolean)
  setApiBaseUrl(remainingBases.length ? remainingBases[remainingBases.length - 1] : preShellBaseUrl)
}

export function resolveApiBaseUrl({
  runtimeUrl = runtimeBaseUrl,
  env = typeof import.meta !== 'undefined' ? import.meta.env : undefined,
  combinedShell = globalThis.__AIS_COMBINED_SHELL__,
} = {}) {
  const normalizedRuntime = String(runtimeUrl || '').trim().replace(/\/+$/, '')
  if (normalizedRuntime) return normalizedRuntime

  const assessmentConfigured = env?.VITE_ASSESSMENT_API_BASE_URL
    ? String(env.VITE_ASSESSMENT_API_BASE_URL).trim().replace(/\/+$/, '')
    : ''
  if (assessmentConfigured) {
    return assessmentConfigured
  }

  if (combinedShell) {
    return '/assessment-api'
  }

  const defaultBase = env?.PROD ? '/assessment-api' : 'http://127.0.0.1:8002/api'
  return defaultBase.replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl()
}

function isPhpSizeWarning(text) {
  return /POST Content-Length\b[\s\S]*?exceeds\s+the\s+limit/i.test(text)
}

function buildPayloadTooLargeError(text = '') {
  const limitMatch = text.match(/exceeds\s+the\s+limit\s+of\s+(\d+)\s+bytes/i)
  const limitBytes = limitMatch ? Number(limitMatch[1]) : 0
  const limitMb =
    Number.isFinite(limitBytes) && limitBytes > 0
      ? Math.round((limitBytes / (1024 * 1024)) * 10) / 10
      : null
  const sizeDetail = limitMb ? `${limitMb} MB (batas PHP server)` : '20 MB / batas PHP server'
  return new ApiError(
    `Ukuran file melebihi batas unggahan server (${sizeDetail}). Perkecil ukuran file sebelum mengunggah kembali.`,
    {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    },
  )
}

function buildHtmlResponseError(status, contextLabel = 'JSON') {
  if (status >= 500) {
    return new ApiError(
      `Server API Assessment (:8002) mengembalikan halaman error HTML (${status}). Periksa layanan :8002 dan log error PHP.`,
      {
        status,
        code: 'INVALID_API_RESPONSE',
      },
    )
  }
  return new ApiError(
    `Server API Assessment mengembalikan HTML alih-alih ${contextLabel}${status ? ` (${status})` : ''}. Periksa VITE_ASSESSMENT_API_BASE_URL atau konfigurasi proxy /assessment-api.`,
    {
      status: status || 502,
      code: 'INVALID_API_RESPONSE',
    },
  )
}

function parseJsonErrorPayload(text, status, fallbackMessage) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: fallbackMessage, status }
  }
}

async function readBlobPrefixText(blob, maxBytes = 512) {
  if (!blob) return ''
  const slice = typeof blob.slice === 'function' ? blob.slice(0, maxBytes) : blob
  if (typeof slice.text === 'function') {
    return slice.text()
  }
  if (typeof slice.arrayBuffer === 'function') {
    return new TextDecoder().decode(await slice.arrayBuffer())
  }
  return ''
}

function parseDownloadFileName(disposition, fallbackName) {
  const match = String(disposition || '').match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i)
  if (!match?.[1]) return fallbackName
  const raw = match[1].replace(/"/g, '').trim()
  if (!raw) return fallbackName
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
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

  if (response.status === 413 || (text && isPhpSizeWarning(text))) {
    throw buildPayloadTooLargeError(text)
  }

  if (text && /^\s*</.test(text)) {
    throw buildHtmlResponseError(response.status, 'JSON')
  }

  if (text && text.trim()) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ApiError(
        `Respons server API Assessment tidak valid (bukan JSON${response.status ? `, status ${response.status}` : ''}). Periksa layanan :8002 dan log error PHP.`,
        {
          status: response.status || 502,
          code: 'INVALID_API_RESPONSE',
        },
      )
    }
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.message || `Permintaan gagal (${response.status}).`
    const code = payload?.error?.code || (response.status === 401 ? 'UNAUTHENTICATED' : 'API_ERROR')
    const details = payload?.error?.details || {}

    if (response.status === 401) {
      setStoredToken(null)
      if (unauthorizedHandler && path !== '/auth/ais-exchange' && path !== '/auth/login') {
        unauthorizedHandler()
      }
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
  setBaseUrl: setApiBaseUrl,
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

  async exchangeAisSession({ ais_token, device_name = 'examnia-ais-bridge' }) {
    const data = await apiRequest('/auth/ais-exchange', {
      method: 'POST',
      body: { ais_token, device_name },
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

  async getClass(classId) {
    return apiRequest(`/classes/${classId}`)
  },

  async createClass({ name, description = '' }) {
    return apiRequest('/classes', {
      method: 'POST',
      body: { name, description },
    })
  },

  async updateClass(classId, payload) {
    return apiRequest(`/classes/${classId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async joinClass(classCode) {
    return apiRequest('/classes/join', {
      method: 'POST',
      body: { class_code: String(classCode || '').trim().toUpperCase() },
    })
  },

  async leaveClass(classId) {
    return apiRequest(`/classes/${classId}/leave`, {
      method: 'DELETE',
    })
  },

  async listModules(classId) {
    return apiRequest(`/classes/${classId}/modules`)
  },

  async setModuleVisibility(moduleId, visibility) {
    return apiRequest(`/modules/${moduleId}/visibility`, {
      method: 'PATCH',
      body: { visibility },
    })
  },

  async deleteModule(moduleId) {
    return apiRequest(`/modules/${moduleId}`, {
      method: 'DELETE',
    })
  },

  async downloadModule(moduleId) {
    const url = `${getApiBaseUrl()}/modules/${moduleId}/download`
    const token = getStoredToken()
    const headers = {
      Accept: 'application/pdf, application/json',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    let response
    try {
      response = await fetch(url, { method: 'GET', headers })
    } catch (networkErr) {
      throw new ApiError('Tidak dapat terhubung ke server API Backend.', {
        status: 0,
        code: 'NETWORK_ERROR',
        details: { cause: networkErr?.message || 'fetch_failed' },
      })
    }

    if (!response.ok) {
      if (response.status === 401) {
        setStoredToken(null)
        if (unauthorizedHandler) {
          unauthorizedHandler()
        }
      }

      const errorText = typeof response.text === 'function' ? await response.text().catch(() => '') : ''
      if (errorText && /^\s*</.test(errorText)) {
        throw buildHtmlResponseError(response.status, 'file PDF')
      }

      let payload = null
      if (errorText && errorText.trim()) {
        payload = parseJsonErrorPayload(errorText, response.status, `Gagal mengunduh materi (${response.status}).`)
      } else if (typeof response.json === 'function') {
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
      }

      const code = payload?.error?.code || (response.status === 401 ? 'UNAUTHENTICATED' : 'API_ERROR')
      throw new ApiError(payload?.message || `Gagal mengunduh materi (${response.status}).`, {
        status: response.status,
        code,
        details: payload?.error?.details || {},
      })
    }

    const headerContentType = String(response.headers?.get?.('Content-Type') || '').toLowerCase()
    if (headerContentType.includes('text/html')) {
      throw buildHtmlResponseError(response.status || 502, 'file PDF')
    }
    if (headerContentType.includes('application/json')) {
      const jsonText = typeof response.text === 'function' ? await response.text().catch(() => '') : ''
      let payload = jsonText ? parseJsonErrorPayload(jsonText, response.status, null) : null
      if (!payload && typeof response.json === 'function') {
        payload = await response.json().catch(() => null)
      }
      throw new ApiError(payload?.message || 'Server mengembalikan respons JSON alih-alih file PDF.', {
        status: response.status || 502,
        code: payload?.error?.code || 'INVALID_API_RESPONSE',
        details: payload?.error?.details || {},
      })
    }

    const blob = await response.blob()
    const blobType = String(blob?.type || '').toLowerCase()
    if (blobType.includes('text/html')) {
      throw buildHtmlResponseError(response.status || 502, 'file PDF')
    }
    if (blobType.includes('application/json')) {
      const jsonText = typeof blob?.text === 'function' ? await blob.text().catch(() => '') : ''
      const payload = jsonText ? parseJsonErrorPayload(jsonText, response.status, null) : null
      throw new ApiError(payload?.message || 'Server mengembalikan payload JSON alih-alih file PDF.', {
        status: response.status || 502,
        code: payload?.error?.code || 'INVALID_API_RESPONSE',
        details: payload?.error?.details || {},
      })
    }

    const head = (await readBlobPrefixText(blob)).trimStart()
    if (head.startsWith('<')) {
      throw buildHtmlResponseError(response.status || 502, 'file PDF')
    }
    if (head.startsWith('{')) {
      const jsonText = typeof blob?.text === 'function' ? await blob.text().catch(() => head) : head
      const payload = parseJsonErrorPayload(jsonText, response.status, null)
      throw new ApiError(payload?.message || 'Server mengembalikan payload JSON alih-alih file PDF.', {
        status: response.status || 502,
        code: payload?.error?.code || 'INVALID_API_RESPONSE',
        details: payload?.error?.details || {},
      })
    }

    const disposition = response.headers?.get?.('Content-Disposition') || ''
    const fileName = parseDownloadFileName(disposition, `modul-${moduleId}.pdf`)
    return { blob, fileName }
  },

  async markModuleRead(moduleId) {
    return apiRequest(`/modules/${moduleId}/read`, {
      method: 'POST',
    })
  },

  async getClassProgress(classId) {
    return apiRequest(`/classes/${classId}/progress`)
  },

  async listClassAssignments(classId) {
    return apiRequest(`/classes/${classId}/assignments`)
  },

  async createAssignment(classId, payload) {
    return apiRequest(`/classes/${classId}/assignments`, {
      method: 'POST',
      body: payload,
    })
  },

  async updateAssignment(assignmentId, payload) {
    return apiRequest(`/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async publishAssignment(assignmentId, payload = {}) {
    return apiRequest(`/assignments/${assignmentId}/publish`, {
      method: 'POST',
      body: payload,
    })
  },

  async deleteAssignment(assignmentId) {
    return apiRequest(`/assignments/${assignmentId}`, {
      method: 'DELETE',
    })
  },

  async listClassAnnouncements(classId) {
    return apiRequest(`/classes/${classId}/announcements`)
  },

  async createAnnouncement(classId, payload) {
    return apiRequest(`/classes/${classId}/announcements`, {
      method: 'POST',
      body: payload,
    })
  },

  async deleteAnnouncement(announcementId) {
    return apiRequest(`/announcements/${announcementId}`, {
      method: 'DELETE',
    })
  },

  async listNotifications({ unread_only = false, per_page = 50 } = {}) {
    const params = new URLSearchParams()
    if (unread_only) params.set('unread_only', '1')
    if (per_page) params.set('per_page', String(per_page))
    const query = params.toString()
    return apiRequest(`/notifications${query ? `?${query}` : ''}`)
  },

  async markNotificationRead(notificationId) {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'POST',
    })
  },

  async markAllNotificationsRead() {
    return apiRequest('/notifications/read-all', {
      method: 'POST',
    })
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
      body: { file_name: fileName || 'modul-pembelajaran.pdf', visibility },
    })
  },

  async listClassQuizzes(classId) {
    return apiRequest(`/classes/${classId}/quizzes`)
  },

  async getQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}`)
  },

  async createQuiz({
    class_id,
    title,
    description = '',
    assessment_type = 'quiz',
    course_name = null,
    instructions = null,
    open_at = null,
    deadline = null,
    duration_minutes = 60,
    release_mode = 'immediate',
    results_released = false,
  }) {
    return apiRequest('/quizzes', {
      method: 'POST',
      body: {
        class_id,
        title,
        description,
        assessment_type,
        course_name,
        instructions: instructions ?? description,
        open_at,
        deadline,
        duration_minutes,
        release_mode,
        results_released,
      },
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

  async publishQuiz(quizId, { deadline } = {}) {
    return apiRequest(`/quizzes/${quizId}/publish`, {
      method: 'POST',
      ...(deadline ? { body: { deadline } } : {}),
    })
  },

  async closeQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}/close`, {
      method: 'POST',
    })
  },

  async archiveQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}/archive`, {
      method: 'POST',
    })
  },

  async duplicateQuiz(quizId) {
    return apiRequest(`/quizzes/${quizId}/duplicate`, {
      method: 'POST',
    })
  },

  async releaseQuizResults(quizId) {
    return apiRequest(`/quizzes/${quizId}/release-results`, {
      method: 'POST',
    })
  },

  async listQuestions(quizId) {
    return apiRequest(`/quizzes/${quizId}/questions`)
  },

  async createQuestion(quizId, {
    question_text,
    points = 10,
    explanation = null,
    topic = null,
    is_bank_item = false,
    options,
  }) {
    return apiRequest(`/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: {
        question_text,
        points,
        explanation,
        topic,
        is_bank_item,
        options,
      },
    })
  },

  async updateQuestion(quizId, questionId, {
    question_text,
    points,
    explanation,
    topic,
    is_bank_item,
    reviewed,
  }) {
    const body = { question_text }
    if (points !== undefined) body.points = points
    if (explanation !== undefined) body.explanation = explanation
    if (topic !== undefined) body.topic = topic
    if (is_bank_item !== undefined) body.is_bank_item = is_bank_item
    if (reviewed !== undefined) body.reviewed = Boolean(reviewed)
    return apiRequest(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'PATCH',
      body,
    })
  },

  async reviewQuestion(quizId, questionId, reviewed = true) {
    return apiRequest(`/quizzes/${quizId}/questions/${questionId}/review`, {
      method: 'POST',
      body: { reviewed: Boolean(reviewed) },
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

  async listQuestionBank() {
    return apiRequest('/question-bank')
  },

  async createBankQuestion({
    question_text,
    points = 10,
    explanation = null,
    topic = null,
    options,
  }) {
    return apiRequest('/question-bank', {
      method: 'POST',
      body: {
        question_text,
        points,
        explanation,
        topic,
        is_bank_item: true,
        options,
      },
    })
  },

  async deleteBankQuestion(questionId) {
    return apiRequest(`/question-bank/${questionId}`, {
      method: 'DELETE',
    })
  },

  async requestQuizGeneration(moduleId, questionCount = 5, title = '') {
    const body = { question_count: questionCount }
    if (title) body.title = title
    return apiRequest(`/modules/${moduleId}/generate-quiz`, {
      method: 'POST',
      body,
    })
  },

  async getQuizGeneration(generationId) {
    return apiRequest(`/quiz-generations/${generationId}`)
  },

  async startAttempt(quizId, { game_mode = 'boss', challenge_mode = 'normal', boss_id = null, map_id = null, resume = true } = {}) {
    return apiRequest(`/quizzes/${quizId}/attempts`, {
      method: 'POST',
      body: { game_mode, challenge_mode, boss_id, map_id, resume },
    })
  },

  async getAttempt(attemptId) {
    return apiRequest(`/attempts/${attemptId}`)
  },

  async getAttemptQuestions(attemptId) {
    return apiRequest(`/attempts/${attemptId}/questions`)
  },

  async submitAnswer(attemptId, {
    question_id,
    chosen_option_id = null,
    streak = 0,
    multiplier = 1,
    replace = true,
    is_flagged,
  }) {
    const body = { question_id, streak, multiplier, replace }
    if (chosen_option_id !== undefined && chosen_option_id !== null) {
      body.chosen_option_id = chosen_option_id
    }
    if (typeof is_flagged === 'boolean') {
      body.is_flagged = is_flagged
    }
    return apiRequest(`/attempts/${attemptId}/answers`, {
      method: 'POST',
      body,
    })
  },

  async finishAttempt(attemptId) {
    return apiRequest(`/attempts/${attemptId}/finish`, {
      method: 'POST',
    })
  },

  async gradeAttempt(attemptId, { final_grade, teacher_feedback = null }) {
    return apiRequest(`/attempts/${attemptId}/grade`, {
      method: 'PATCH',
      body: { final_grade, teacher_feedback },
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

  async syncAisRoster() {
    return apiRequest('/integration/sync-roster', { method: 'POST' })
  },

  async exportAisGrades() {
    return apiRequest('/integration/export-grades', { method: 'POST' })
  },
}
