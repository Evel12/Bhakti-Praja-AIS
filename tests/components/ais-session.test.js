import { beforeEach, afterEach, it, expect, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState({}, '', '/?embedded=1');
});
afterEach(() => {
  history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const profile = role => ({ id: 42, name: 'Akun sekolah', role, status: 'active' });
function authenticate(role) {
  localStorage.setItem('ais_token', 'test-token');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: profile(role) }) })));
}
it('requires an AIS token before initializing the embedded workspace', async () => {
  const session = await import('../../src/integration/session.js');
  await expect(session.initializeSession()).rejects.toThrow('Silakan masuk');
  expect(session.assessmentRouteAllowed({ meta: { student: true } })).toBe(false);
});
it('verifies the existing session and locks students to participant routes', async () => {
  authenticate('murid');
  const session = await import('../../src/integration/session.js');
  await session.initializeSession();
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  expect(session.assessmentRouteAllowed({ path: '/student', meta: { student: true } })).toBe(true);
  expect(session.assessmentRouteAllowed({ path: '/builder/new', meta: {} })).toBe(false);
  expect(session.assessmentHome()).toBe('/student');
});
it('keeps teachers on teaching routes and rejects the standalone role simulator', async () => {
  authenticate('guru');
  const session = await import('../../src/integration/session.js');
  await session.initializeSession();
  expect(session.assessmentRouteAllowed({ path: '/results', meta: {} })).toBe(true);
  expect(session.assessmentRouteAllowed({ path: '/student', meta: { student: true } })).toBe(false);
  expect(session.assessmentRouteAllowed({ path: '/motion-lab', meta: {} })).toBe(false);
});
it('rejects parents and expired tokens in the embedded application', async () => {
  authenticate('wali_murid');
  const session = await import('../../src/integration/session.js');
  await expect(session.initializeSession()).rejects.toThrow('tidak memiliki akses');
  fetch.mockResolvedValue({ ok: false, status: 401 });
  await expect(session.initializeSession()).rejects.toThrow('Sesi telah berakhir');
});
it('namespaces local workspace data by authenticated account without touching legacy data', async () => {
  authenticate('guru');
  const { initializeSession } = await import('../../src/integration/session.js');
  await initializeSession();
  const { repository } = await import('../../src/repositories/assessmentRepository.js');
  const { STORAGE_KEY } = await import('../../src/domain/assessment.js');
  localStorage.setItem(STORAGE_KEY, 'legacy workspace');
  repository.save({ version: 1, assessments: [], attempts: [], bank: [] });
  expect(localStorage.getItem(STORAGE_KEY)).toBe('legacy workspace');
  expect(JSON.parse(localStorage.getItem(`ais.assessment.42.${STORAGE_KEY}`)).assessments).toEqual([]);
});
it('requires session validation on the combined deployment even without embedded query', async () => {
  history.replaceState({}, '', '/');
  vi.stubEnv('BASE_URL', '/assessment-app/');
  const session = await import('../../src/integration/session.js');
  expect(session.embedded).toBe(true);
  await expect(session.initializeSession()).rejects.toThrow('Silakan masuk');
});
