import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';

const users = new SharedArray('isolated LMS accounts', () => JSON.parse(open(__ENV.K6_USERS_FILE)));
const base = (__ENV.BASE_URL || 'http://127.0.0.1:8086').replace(/\/$/, '');
const vus = Number(__ENV.TEST_VUS || 10);
const prefix = __ENV.RESULT_PREFIX || '.tools/k6/results/local';
const failureRate = new Rate('application_failure_rate');
const rateLimited = new Rate('rate_limited_rate');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');
const completedJourneys = new Counter('completed_journeys');
const journeyDuration = new Trend('journey_duration_ms', true);

export const options = {
  scenarios: {
    lms_users: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '10s', target: vus },
        { duration: __ENV.HOLD || '30s', target: vus },
        { duration: __ENV.RAMP_DOWN || '5s', target: 0 },
      ],
      gracefulRampDown: '10s', gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    application_failure_rate: ['rate<0.01'],
    rate_limited_rate: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response', 'error_code', 'group', 'check', 'error'],
  tags: { component: 'lms', concurrency: String(vus), environment: 'isolated-local-apache' },
  cloud: { name: `LMS concurrent users - ${vus} VUs`, ...(__ENV.K6_CLOUD_PROJECT_ID ? { projectID: Number(__ENV.K6_CLOUD_PROJECT_ID) } : {}) },
};

export function setup() {
  if (!Number.isInteger(vus) || vus < 1 || vus > users.length) fail('Provide at least one unique account per virtual user.');
  const response = http.get(`${base}/up`, { tags: { name: 'GET /up', phase: 'preflight' }, timeout: '20s' });
  if (response.status !== 200) fail('The isolated application is unavailable.');
  for (const role of ['guru', 'murid']) {
    const sample = users.find(user => user.role === role);
    if (!sample || !request(`/api/lms/courses/${sample.course_id}`, 'GET /api/lms/courses/:id', sample)) fail(`Preflight failed for ${role} course access.`);
    if (!request(`/api/lms/materials/${sample.material_id}/download`, 'GET /api/lms/materials/:id/download', sample, false, true)) fail(`Preflight failed for ${role} PDF storage.`);
  }
}

function request(path, name, user, post = false, binary = false) {
  const params = {
    headers: { Accept: 'application/json', Authorization: `Bearer ${user.token}` },
    tags: { name, role: user.role }, timeout: '20s',
    ...(binary ? { responseType: 'binary' } : {}),
  };
  const response = post ? http.post(base + path, null, params) : http.get(base + path, params);
  let valid = response.status === 200;
  if (valid && !binary) {
    try { valid = response.json('success') === true; } catch (_) { valid = false; }
  }
  if (valid && binary) valid = (response.headers['Content-Type'] || '').includes('application/pdf');
  failureRate.add(!valid);
  rateLimited.add(response.status === 429);
  if (response.status >= 500) serverErrors.add(1);
  if (response.status >= 400 && response.status < 500) clientErrors.add(1);
  check(response, { 'HTTP 200 and valid application response': () => valid });
  return valid;
}

export default function () {
  const user = users[exec.vu.idInTest - 1];
  const started = Date.now();
  let valid = true;
  valid = request('/api/auth/me', 'GET /api/auth/me', user) && valid;
  valid = request('/api/lms/courses', 'GET /api/lms/courses', user) && valid;
  valid = request(`/api/lms/courses/${user.course_id}`, 'GET /api/lms/courses/:id', user) && valid;
  valid = request('/api/lms/schedules', 'GET /api/lms/schedules', user) && valid;
  if (user.role === 'guru') {
    valid = request('/api/lms/models', 'GET /api/lms/models', user) && valid;
  } else {
    valid = request(`/api/lms/drafts/${user.draft_id}`, 'GET /api/lms/drafts/:id', user) && valid;
    if (exec.vu.iterationInScenario % 3 === 0) {
      valid = request(`/api/lms/materials/${user.material_id}/read`, 'POST /api/lms/materials/:id/read', user, true) && valid;
    }
    if (exec.vu.iterationInScenario % 5 === 0) {
      valid = request(`/api/lms/materials/${user.material_id}/download`, 'GET /api/lms/materials/:id/download', user, false, true) && valid;
    }
  }
  journeyDuration.add(Date.now() - started, { role: user.role });
  if (valid) completedJourneys.add(1);
  // Think time keeps each distinct user below the existing 120 requests/minute limit.
  sleep(4 + Math.random() * 2);
}

export function handleSummary(data) {
  return {
    [`${prefix}.summary.json`]: JSON.stringify(data, null, 2),
    stdout: JSON.stringify({ concurrency: vus, requests: data.metrics.http_reqs?.values.count,
      failed_rate: data.metrics.http_req_failed?.values.rate,
      application_failed_rate: data.metrics.application_failure_rate?.values.rate,
      rate_limited_rate: data.metrics.rate_limited_rate?.values.rate,
      duration_ms: data.metrics.http_req_duration?.values,
      checks: data.metrics.checks?.values }, null, 2) + '\n',
  };
}
