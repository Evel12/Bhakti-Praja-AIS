import test from "node:test";
import assert from "node:assert/strict";
import { createLocalRepository } from "../src/repositories/localAssessmentRepository.js";
import { makeSeed } from "../src/fixtures/seed.js";
import { STORAGE_KEY, startAttempt } from "../src/domain/assessment.js";
const now = Date.UTC(2026, 9, 18, 12);
test("legacy v1 round-trip preserves identities, answers, flags, files, deadlines and grades", () => {
  const data = makeSeed(now),
    at = startAttempt(data.assessments[0], [], now);
  at.answers = { "q-router": 1 };
  at.flags = ["q-dns"];
  at.attachment = {
    name: "file.pdf",
    type: "application/pdf",
    size: 4,
    dataURL: "data:application/pdf;base64,dGVzdA==",
  };
  data.attempts.push(at);
  let raw = JSON.stringify(data);
  const repo = createLocalRepository({
    getItem: (key) => {
      assert.equal(key, STORAGE_KEY);
      return raw;
    },
    setItem: (key, value) => {
      assert.equal(key, STORAGE_KEY);
      raw = value;
    },
  });
  const loaded = repo.load();
  repo.save(loaded);
  assert.deepEqual(JSON.parse(raw), data);
  assert.equal(loaded.attempts.at(-1).expiresAt, at.expiresAt);
});
test("corrupt or unknown schema is never silently replaced with seed", () => {
  let writes = 0;
  for (const raw of [
    "{bad",
    JSON.stringify({ version: 2, assessments: [], attempts: [], bank: [] }),
  ]) {
    const repo = createLocalRepository({
      getItem: () => raw,
      setItem: () => writes++,
    });
    assert.throws(() => repo.load());
  }
  assert.equal(writes, 0);
});
test("storage failure propagates instead of claiming successful save", () => {
  const repo = createLocalRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  assert.throws(() => repo.save(makeSeed(now)), /quota/);
});

test("malformed question payload is rejected without a recovery write", () => {
  const data = makeSeed(now);
  data.bank[0].options = null;
  let writes = 0;
  const repo = createLocalRepository({
    getItem: () => JSON.stringify(data),
    setItem: () => writes++,
  });
  assert.throws(() => repo.load(), /tidak lengkap/);
  assert.equal(writes, 0);
});
