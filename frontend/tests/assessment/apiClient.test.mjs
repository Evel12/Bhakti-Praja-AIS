import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import viteConfig from '../../vite.config.js'
import { useLmsStore } from '../../src/assessment-module/stores/lmsStore.js'
import {
  ApiError,
  apiClient,
  apiRequest,
  getApiBaseUrl,
  releaseCombinedShell,
  resolveApiBaseUrl,
  retainCombinedShell,
  setApiBaseUrl,
  setUnauthorizedHandler,
} from '../../src/assessment-module/services/apiClient.js'

test('resolveApiBaseUrl prioritizes runtime -> VITE_ASSESSMENT_API_BASE_URL -> combined shell -> PROD -> :8002 and never falls back to :8000', () => {
  assert.equal(
    resolveApiBaseUrl({
      runtimeUrl: 'https://override.test/api/',
      env: { VITE_ASSESSMENT_API_BASE_URL: 'https://env.test/api', VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', PROD: true },
      combinedShell: true,
    }),
    'https://override.test/api',
  )

  assert.equal(
    resolveApiBaseUrl({
      runtimeUrl: '',
      env: { VITE_ASSESSMENT_API_BASE_URL: ' http://127.0.0.1:8002/api/ ', VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', PROD: true },
      combinedShell: true,
    }),
    'http://127.0.0.1:8002/api',
  )

  assert.equal(
    resolveApiBaseUrl({
      runtimeUrl: '',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', PROD: false },
      combinedShell: true,
    }),
    '/assessment-api',
  )

  assert.equal(
    resolveApiBaseUrl({
      runtimeUrl: '',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', PROD: true },
      combinedShell: false,
    }),
    '/assessment-api',
  )

  assert.equal(
    resolveApiBaseUrl({
      runtimeUrl: '',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', PROD: false },
      combinedShell: false,
    }),
    'http://127.0.0.1:8002/api',
  )
})

test('apiClient exposes setBaseUrl and retain/releaseCombinedShell protects sibling mounts', (t) => {
  const prevShell = globalThis.__AIS_COMBINED_SHELL__
  t.after(() => {
    setApiBaseUrl('')
    if (prevShell === undefined) delete globalThis.__AIS_COMBINED_SHELL__
    else globalThis.__AIS_COMBINED_SHELL__ = prevShell
  })

  assert.equal(typeof apiClient.setBaseUrl, 'function')
  apiClient.setBaseUrl('https://runtime.test/api/')
  assert.equal(getApiBaseUrl(), 'https://runtime.test/api')
  apiClient.setBaseUrl('')

  const holderA = Symbol('holder-a')
  const holderB = Symbol('holder-b')
  retainCombinedShell(holderA, '/assessment-api')
  retainCombinedShell(holderB, '/custom-assessment-api')
  assert.equal(globalThis.__AIS_COMBINED_SHELL__, true)
  assert.equal(getApiBaseUrl(), '/custom-assessment-api')

  releaseCombinedShell(holderA)
  assert.equal(globalThis.__AIS_COMBINED_SHELL__, true)
  assert.equal(getApiBaseUrl(), '/custom-assessment-api')

  releaseCombinedShell(holderB)
  assert.equal(globalThis.__AIS_COMBINED_SHELL__, undefined)
  assert.equal(getApiBaseUrl(), 'http://127.0.0.1:8002/api')
})

test('apiRequest rejects PHP POST Content-Length limit warnings and 413 with PAYLOAD_TOO_LARGE', async (t) => {
  const origFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = origFetch
  })

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      '<br />\n<b>Warning</b>:  POST Content-Length of 26214400 bytes exceeds the limit of 8388608 bytes in <b>Unknown</b> on line <b>0</b><br />\n',
  })

  await assert.rejects(
    () => apiRequest('/classes/1/modules', { method: 'POST' }),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 413)
      assert.equal(err.code, 'PAYLOAD_TOO_LARGE')
      assert.match(err.message, /8 MB/)
      return true
    },
  )

  globalThis.fetch = async () => ({
    ok: false,
    status: 413,
    text: async () => '<html><body>413 Request Entity Too Large</body></html>',
  })

  await assert.rejects(
    () => apiRequest('/classes/1/modules', { method: 'POST' }),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 413)
      assert.equal(err.code, 'PAYLOAD_TOO_LARGE')
      assert.match(err.message, /20 MB/)
      return true
    },
  )
})

test('apiRequest distinguishes 5xx HTML errors from SPA fallback HTML and rejects invalid non-HTML text', async (t) => {
  const origFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = origFetch
  })

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => '<html><body>Fatal error</body></html>',
  })

  await assert.rejects(
    () => apiRequest('/classes'),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 500)
      assert.equal(err.code, 'INVALID_API_RESPONSE')
      assert.match(err.message, /:8002/)
      assert.match(err.message, /500/)
      return true
    },
  )

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '<!doctype html><html><body>SPA</body></html>',
  })

  await assert.rejects(
    () => apiRequest('/classes'),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 200)
      assert.equal(err.code, 'INVALID_API_RESPONSE')
      assert.match(err.message, /VITE_ASSESSMENT_API_BASE_URL/)
      assert.match(err.message, /\/assessment-api/)
      return true
    },
  )

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => 'Warning: Something went wrong in Unknown on line 0',
  })

  await assert.rejects(
    () => apiRequest('/classes'),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.code, 'INVALID_API_RESPONSE')
      return true
    },
  )

  globalThis.fetch = async () => ({
    ok: true,
    status: 204,
    text: async () => '',
  })

  const emptyRes = await apiRequest('/classes/1/leave', { method: 'DELETE' })
  assert.equal(emptyRes, null)
})

test('downloadModule sends Accept header, triggers unauthorizedHandler on 401, blocks fake HTML/JSON downloads, and guards decodeURIComponent', async (t) => {
  const origFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = origFetch
    setUnauthorizedHandler(null)
  })

  let capturedHeaders = null
  let unauthorizedCalled = 0
  setUnauthorizedHandler(() => {
    unauthorizedCalled += 1
  })

  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers
    return {
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthenticated.' }),
    }
  }

  await assert.rejects(
    () => apiClient.downloadModule(7),
    (err) => err instanceof ApiError && err.status === 401 && err.code === 'UNAUTHENTICATED',
  )
  assert.equal(capturedHeaders.Accept, 'application/pdf, application/json')
  assert.equal(unauthorizedCalled, 1)

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    blob: async () => new Blob(['<html>SPA</html>'], { type: 'text/html' }),
  })

  await assert.rejects(
    () => apiClient.downloadModule(7),
    (err) => err instanceof ApiError && err.code === 'INVALID_API_RESPONSE',
  )

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/octet-stream' }),
    blob: async () => new Blob(['  {"message":"File tidak tersedia"}'], { type: 'application/octet-stream' }),
  })

  await assert.rejects(
    () => apiClient.downloadModule(7),
    (err) => err instanceof ApiError && err.code === 'INVALID_API_RESPONSE' && err.message === 'File tidak tersedia',
  )

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': "attachment; filename*=UTF-8''modul%E0%A4%A.pdf",
    }),
    blob: async () => new Blob(['%PDF-1.4\n1 0 obj\n%%EOF'], { type: 'application/pdf' }),
  })

  const downloaded = await apiClient.downloadModule(7)
  assert.equal(downloaded.fileName, 'modul%E0%A4%A.pdf')
  assert.ok(downloaded.blob instanceof Blob)
})

test('vite.config.js honors VITE_API_PROXY_TARGET and VITE_ASSESSMENT_PROXY_TARGET', (t) => {
  const prevApi = process.env.VITE_API_PROXY_TARGET
  const prevAssess = process.env.VITE_ASSESSMENT_PROXY_TARGET
  t.after(() => {
    if (prevApi === undefined) delete process.env.VITE_API_PROXY_TARGET
    else process.env.VITE_API_PROXY_TARGET = prevApi
    if (prevAssess === undefined) delete process.env.VITE_ASSESSMENT_PROXY_TARGET
    else process.env.VITE_ASSESSMENT_PROXY_TARGET = prevAssess
  })

  process.env.VITE_API_PROXY_TARGET = 'http://127.0.0.1:8100'
  process.env.VITE_ASSESSMENT_PROXY_TARGET = 'http://127.0.0.1:8202'
  const resolved = typeof viteConfig === 'function' ? viteConfig({ mode: 'development' }) : viteConfig
  assert.equal(resolved.server.proxy['/api'].target, 'http://127.0.0.1:8100')
  assert.equal(resolved.server.proxy['/assessment-api'].target, 'http://127.0.0.1:8202')
  assert.equal(resolved.preview.proxy['/assessment-api'].target, 'http://127.0.0.1:8202')
})

function installMemoryStorage() {
  const map = new Map()
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
  const prevWindow = globalThis.window
  const prevStorage = globalThis.localStorage
  globalThis.localStorage = storage
  globalThis.window = { localStorage: storage }
  return () => {
    if (prevWindow === undefined) delete globalThis.window
    else globalThis.window = prevWindow
    if (prevStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = prevStorage
  }
}

test('lmsStore selectClass guards rapid switching, restores activeClassId on error, and isolates progress errors on module actions', async (t) => {
  const restoreStorage = installMemoryStorage()
  const origMethods = {
    getToken: apiClient.getToken,
    getClass: apiClient.getClass,
    listModules: apiClient.listModules,
    listClassAssignments: apiClient.listClassAssignments,
    listClassAnnouncements: apiClient.listClassAnnouncements,
    listClassQuizzes: apiClient.listClassQuizzes,
    getClassProgress: apiClient.getClassProgress,
    uploadModule: apiClient.uploadModule,
    setModuleVisibility: apiClient.setModuleVisibility,
    deleteModule: apiClient.deleteModule,
    getQuizGeneration: apiClient.getQuizGeneration,
  }
  t.after(() => {
    Object.assign(apiClient, origMethods)
    restoreStorage()
  })

  setActivePinia(createPinia())
  apiClient.getToken = () => 'live-token'

  let resolveClass1
  apiClient.getClass = (id) =>
    Number(id) === 1
      ? new Promise((r) => { resolveClass1 = r })
      : Promise.resolve({ id: 2, name: 'Kelas 2' })
  apiClient.listModules = (id) =>
    Promise.resolve({ items: [{ id: Number(id) * 10, class_id: Number(id), file_name: `m${id}.pdf`, visibility: 'public' }] })
  apiClient.listClassAssignments = () => Promise.resolve({ items: [] })
  apiClient.listClassAnnouncements = () => Promise.resolve({ items: [] })
  apiClient.listClassQuizzes = () => Promise.resolve({ data: [] })
  apiClient.getClassProgress = (id) =>
    Promise.resolve({ class_id: Number(id), total_public_modules: 1, read_count: 0, progress_percentage: 0 })

  const lms = useLmsStore()
  lms.classes = [{ id: 1, name: 'Kelas 1', modules_count: 0 }, { id: 2, name: 'Kelas 2', modules_count: 0 }]

  // Rapid switch: start class 1 (slow), then class 2 (fast), then resolve class 1 late
  const p1 = lms.selectClass(1)
  const p2 = lms.selectClass(2)
  await p2
  resolveClass1({ id: 1, name: 'Kelas 1' })
  await p1
  assert.equal(lms.activeClassId, 2)
  assert.equal(lms.activeClass.name, 'Kelas 2')
  assert.equal(lms.modules[0].file_name, 'm2.pdf')

  // Failure restores previous activeClassId (2)
  apiClient.getClassProgress = () => Promise.reject(new ApiError('Progress error', { status: 500 }))
  await assert.rejects(() => lms.selectClass(1), /Progress error/)
  assert.equal(lms.activeClassId, 2)
  assert.equal(lms.activeClass.name, 'Kelas 2')

  // uploadModule syncs modules_count and best-effort refreshes progress
  apiClient.uploadModule = async () => ({ id: 99, class_id: 2, file_name: 'new.pdf', visibility: 'public' })
  apiClient.listModules = async () => ({
    items: [
      { id: 20, class_id: 2, file_name: 'm2.pdf', visibility: 'public' },
      { id: 99, class_id: 2, file_name: 'new.pdf', visibility: 'public' },
    ],
  })
  await lms.uploadModule(2, { fileName: 'new.pdf' })
  assert.equal(lms.modules.length, 2)
  assert.equal(lms.classes.find((c) => c.id === 2).modules_count, 2)
  assert.equal(lms.activeClass.modules_count, 2)

  // setModuleVisibility & deleteModule succeed even if loadClassProgress fails
  apiClient.setModuleVisibility = async () => ({ id: 20, visibility: 'private' })
  const updated = await lms.setModuleVisibility(20, 'private')
  assert.equal(updated.visibility, 'private')
  assert.equal(lms.error, '')

  apiClient.deleteModule = async () => ({})
  await lms.deleteModule(20)
  assert.equal(lms.modules.length, 1)
  assert.equal(lms.classes.find((c) => c.id === 2).modules_count, 1)
  assert.equal(lms.error, '')

  // pollQuizGeneration recovers from transient 500 error
  let pollCalls = 0
  apiClient.getQuizGeneration = async () => {
    pollCalls += 1
    if (pollCalls === 1) throw new ApiError('Temporary outage', { status: 503 })
    return { id: 77, status: 'completed', quiz_id: null }
  }
  const job = await lms.pollQuizGeneration(77, { maxAttempts: 3, pollWaitMs: 0 })
  assert.equal(job.status, 'completed')
  assert.equal(pollCalls, 2)
})
