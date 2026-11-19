import test from 'node:test';
import assert from 'node:assert/strict';
import { services, serviceForPath, canOpenService } from '../src/services.js';

test('AIS defines the 3 post-login workspace modes', () => {
  assert.deepEqual(
    services.map((s) => s.id),
    ['administration', 'finance', 'assessment'],
  );
});

test('serviceForPath resolves administration, finance, assessment, and consolidated /lms paths', () => {
  assert.equal(serviceForPath('/'), null);
  assert.equal(serviceForPath('/login'), null);
  assert.equal(serviceForPath('/administration').id, 'administration');
  assert.equal(serviceForPath('/students').id, 'administration');
  assert.equal(serviceForPath('/finance').id, 'finance');
  assert.equal(serviceForPath('/parent/grades').id, 'finance');
  assert.equal(serviceForPath('/communication/announcements').id, 'finance');
  assert.equal(serviceForPath('/assessment').id, 'assessment');
  assert.equal(serviceForPath('/assessment/builder/12').id, 'assessment');
  assert.equal(serviceForPath('/lms').id, 'assessment');
});

test('canOpenService enforces role permissions across all 3 modes', () => {
  const admin = services.find((s) => s.id === 'administration');
  const finance = services.find((s) => s.id === 'finance');
  const assessment = services.find((s) => s.id === 'assessment');

  assert.equal(canOpenService(admin, 'admin'), true);
  assert.equal(canOpenService(admin, 'guru'), false);
  assert.equal(canOpenService(finance, 'admin'), true);
  assert.equal(canOpenService(finance, 'murid'), true);
  assert.equal(canOpenService(finance, 'wali_murid'), true);
  assert.equal(canOpenService(finance, 'guru'), false);
  assert.equal(canOpenService(assessment, 'admin'), true);
  assert.equal(canOpenService(assessment, 'guru'), true);
  assert.equal(canOpenService(assessment, 'murid'), true);
  assert.equal(canOpenService(assessment, 'wali_murid'), false);
});
