import axios from 'axios'

const TOKEN_KEY = 'ais_token'

const api = axios.create({
  baseURL: '/api',

  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // abaikan jika penyimpanan tidak tersedia
  }
}

api.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestToken = error.config?.headers?.Authorization
    const currentToken = getToken()
    const currentAuthorization = currentToken ? `Bearer ${currentToken}` : undefined
    if (error.response?.status === 401 && requestToken === currentAuthorization) {
      setToken(null)
      if (error.config?.url !== '/auth/login') window.dispatchEvent(new Event('ais-session-expired'))
    }

    return Promise.reject(error)
  },
)

function extractCredentials(emailOrObject, password) {
  if (
    emailOrObject !== null &&
    typeof emailOrObject === 'object'
  ) {
    return {
      email: emailOrObject.email ?? '',
      password: emailOrObject.password ?? '',
      portal: emailOrObject.portal ?? 'ais',
    }
  }

  return {
    email: emailOrObject ?? '',
    password: password ?? '',
  }
}

export async function login(emailOrObject, password) {
  const credentials = extractCredentials(
    emailOrObject,
    password,
  )

  const response = await api.post(
    '/auth/login',
    credentials,
  )

  const token = response.data?.token

  if (token) {
    setToken(token)
  }

  return response.data
}

export async function logout() {
  try {
    const response =
      await api.post('/auth/logout')

    return response.data
  } finally {
    setToken(null)
  }
}

export async function me() {
  const response =
    await api.get('/auth/me')

  return response.data
}

export async function getRoles() {
  const response =
    await api.get('/roles')

  return response.data
}

export async function getDashboard() {
  const response =
    await api.get('/dashboard')

  return response.data
}

export async function listResource(
  resource,
  searchOrParams = '',
) {
  const params =
    typeof searchOrParams === 'object' &&
    searchOrParams !== null
      ? { ...searchOrParams }
      : searchOrParams
        ? { search: searchOrParams }
        : {}

  Object.keys(params).forEach((key) => {
    if (
      params[key] === '' ||
      params[key] === null ||
      params[key] === undefined
    ) {
      delete params[key]
    }
  })

  const response =
    await api.get(
      `/${resource}`,
      { params },
    )

  return response.data
}

export async function createResource(
  resource,
  payload,
) {
  const response =
    await api.post(
      `/${resource}`,
      payload,
    )

  return response.data
}

export async function updateResource(
  resource,
  id,
  payload,
) {
  const response =
    await api.put(
      `/${resource}/${id}`,
      payload,
    )

  return response.data
}

export async function updateUserStatus(
  id,
  status,
) {
  const response =
    await api.patch(
      `/users/${id}/status`,
      { status },
    )

  return response.data
}

export async function deleteResource(
  resource,
  id,
) {
  const response =
    await api.delete(
      `/${resource}/${id}`,
    )

  return response.data
}

export default api
