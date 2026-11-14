import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSESSMENT_URL_STORAGE_KEY,
  clearStoredAssessmentUrl,
  getDefaultAssessmentUrl,
  getInitialTargetWeb,
  getStoredAssessmentUrl,
  normalizeWebTargetUrl,
  saveStoredAssessmentUrl,
} from '../src/webTargets.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('getDefaultAssessmentUrl defaults to http://127.0.0.1/ unless explicit env URL is set', () => {
  assert.equal(
    getDefaultAssessmentUrl(),
    'http://127.0.0.1/',
  );
  assert.equal(
    getDefaultAssessmentUrl({ locationObj: { protocol: 'http:', hostname: 'localhost' } }),
    'http://127.0.0.1/',
  );
  assert.equal(
    getDefaultAssessmentUrl({
      envUrl: 'https://assessment.skabhaprabatang.sch.id/#/login',
    }),
    'https://assessment.skabhaprabatang.sch.id/#/login',
  );
});

test('normalizeWebTargetUrl validates, normalizes bare host/port, and blocks unsafe schemes', () => {
  assert.deepEqual(normalizeWebTargetUrl('127.0.0.1'), {
    valid: true,
    url: 'http://127.0.0.1/',
  });
  assert.deepEqual(normalizeWebTargetUrl('127.0.0.1:4173'), {
    valid: true,
    url: 'http://127.0.0.1:4173/',
  });
  assert.deepEqual(normalizeWebTargetUrl('https://ujian.sekolah.sch.id'), {
    valid: true,
    url: 'https://ujian.sekolah.sch.id/',
  });
  assert.deepEqual(normalizeWebTargetUrl('/assessment-app/#/login'), {
    valid: true,
    url: '/assessment-app/#/login',
  });

  assert.equal(normalizeWebTargetUrl('').valid, false);
  assert.equal(normalizeWebTargetUrl('javascript:alert(1)').valid, false);
  assert.equal(normalizeWebTargetUrl('data:text/html,<script>').valid, false);
  assert.equal(normalizeWebTargetUrl('mailto:admin@example.test').valid, false);
  assert.equal(normalizeWebTargetUrl('ftp://files.example.test').valid, false);
});

test('getStoredAssessmentUrl, saveStoredAssessmentUrl, and clearStoredAssessmentUrl manage persistence cleanly', () => {
  const storage = createMemoryStorage();

  assert.deepEqual(getStoredAssessmentUrl({ storage }), {
    url: 'http://127.0.0.1/',
    isCustom: false,
  });

  const saved = saveStoredAssessmentUrl('https://assessment.example.id/#/login', { storage });
  assert.equal(saved.valid, true);
  assert.equal(storage.getItem(ASSESSMENT_URL_STORAGE_KEY), 'https://assessment.example.id/#/login');

  assert.deepEqual(getStoredAssessmentUrl({ storage }), {
    url: 'https://assessment.example.id/#/login',
    isCustom: true,
  });

  const resetUrl = clearStoredAssessmentUrl({ storage });
  assert.equal(resetUrl, 'http://127.0.0.1/');
  assert.deepEqual(getStoredAssessmentUrl({ storage }), {
    url: 'http://127.0.0.1/',
    isCustom: false,
  });
});

test('getInitialTargetWeb parses target/portal query parameters safely', () => {
  assert.equal(getInitialTargetWeb(''), 'ais');
  assert.equal(getInitialTargetWeb('?target=assessment'), 'assessment');
  assert.equal(getInitialTargetWeb('?portal=assessment'), 'assessment');
  assert.equal(getInitialTargetWeb('?target=unknown'), 'ais');
});
