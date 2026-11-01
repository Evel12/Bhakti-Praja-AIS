import test from "node:test";
import assert from "node:assert/strict";
import { deadlineDay } from "../src/utils/format.js";

test("deadline labels use WIB calendar dates across midnight and month/year boundaries", () => {
  const beforeMidnight = Date.parse("2026-10-31T16:59:59Z");
  assert.equal(deadlineDay("2026-10-31T16:59:59Z", beforeMidnight), "Hari ini");
  assert.equal(deadlineDay("2026-10-31T17:00:00Z", beforeMidnight), "Besok");
  assert.equal(deadlineDay("2026-11-02T17:00:00Z", beforeMidnight), "Dalam 3 hari");
  assert.equal(deadlineDay("2026-12-31T17:00:00Z", Date.parse("2026-12-31T16:59:59Z")), "Besok");
  assert.equal(deadlineDay("2026-10-30T16:59:59Z", beforeMidnight), "Sudah lewat");
  assert.equal(deadlineDay("", beforeMidnight), "Jadwal belum diatur");
});
