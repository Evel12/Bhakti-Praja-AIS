import { readMotionTokens, resolveMotionProfile } from "./tokens.js";
import { sampleSpring, easeFade } from "./spring.js";

export const IDENTITY = Object.freeze({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  opacity: 1,
  blur: 0,
});
const spatial = ["x", "y", "scaleX", "scaleY", "rotate"];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const completed = (status = "skipped") => ({
  finished: Promise.resolve({ status }),
  cancel() {},
  finish() {},
});

export function createMotionEngine({
  requestFrame = (fn) => requestAnimationFrame(fn),
  cancelFrame = (id) => cancelAnimationFrame(id),
  now = () => performance.now(),
  getTokens = readMotionTokens,
} = {}) {
  const records = new WeakMap(),
    jobs = new Map();
  let frame = null,
    peak = 0,
    reserved = 0;
  function record(el) {
    if (!records.has(el)) {
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      const opacity = Number.parseFloat(style.opacity);
      records.set(el, {
        pose: { ...IDENTITY, opacity: Number.isFinite(opacity) ? opacity : 1 },
        velocity: {},
        original: {
          transform: el.style.transform,
          opacity: el.style.opacity,
          filter: el.style.filter,
          willChange: el.style.willChange,
        },
        base: {
          transform: style.transform === "none" ? "" : style.transform,
          filter: style.filter === "none" ? "" : style.filter,
          opacity: Number.isFinite(opacity) ? opacity : 1,
        },
      });
    }
    return records.get(el);
  }
  function render(el, r) {
    const p = r.pose;
    el.style.transform = spatial.every((k) => p[k] === IDENTITY[k])
      ? r.original.transform
      : `${r.base.transform} translate3d(${p.x}px,${p.y}px,0) scale(${p.scaleX},${p.scaleY}) rotate(${p.rotate}deg)`.trim();
    el.style.opacity =
      p.opacity === r.base.opacity
        ? r.original.opacity
        : String(clamp(p.opacity, 0, 1));
    el.style.filter =
      p.blur === 0
        ? r.original.filter
        : `${r.base.filter} blur(${Math.max(0, p.blur)}px)`.trim();
  }
  function restore(el, r) {
    Object.assign(el.style, r.original);
    records.delete(el);
  }
  function finishJob(el, status = "finished", final = true) {
    const job = jobs.get(el);
    if (!job) return;
    jobs.delete(el);
    if (final) {
      job.r.pose = { ...job.to };
      job.r.velocity = {};
      render(el, job.r);
    }
    el.style.willChange = job.r.original.willChange;
    if (!job.retain && final) restore(el, job.r);
    job.resolve({ status });
    if (!jobs.size && frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
  }
  function tick(timestamp) {
    frame = null;
    for (const [el, job] of [...jobs]) {
      if (!el.isConnected) {
        finishJob(el, "cancelled", false);
        restore(el, job.r);
        continue;
      }
      if (el.closest('[data-motion="off"],:disabled,[aria-disabled="true"]')) {
        reset(el);
        continue;
      }
      const elapsed = timestamp - job.start - job.delay;
      if (elapsed < 0) continue;
      let settled = true;
      for (const k of job.keys) {
        if (job.profile.kind !== "spring") {
          const p = clamp(elapsed / job.profile.duration, 0, 1);
          job.r.pose[k] =
            job.from[k] +
            (job.to[k] - job.from[k]) * easeFade(p, job.profile.easing);
          settled = p === 1;
        } else {
          const state = sampleSpring(
            elapsed / 1000,
            job.profile,
            job.from[k],
            job.to[k],
            job.initialVelocity[k] || 0,
          );
          const amplitude = Math.abs(job.to[k] - job.from[k]),
            margin = amplitude * job.profile.overshootLimit;
          job.r.pose[k] = clamp(
            state.position,
            Math.min(job.from[k], job.to[k]) - margin,
            Math.max(job.from[k], job.to[k]) + margin,
          );
          job.r.velocity[k] = state.velocity;
          settled =
            settled &&
            Math.abs(state.position - job.to[k]) <= job.profile.restDelta &&
            Math.abs(state.velocity) <= job.profile.restSpeed;
        }
      }
      render(el, job.r);
      if (
        settled ||
        elapsed >= (job.profile.maxDuration ?? job.profile.duration)
      )
        finishJob(el);
    }
    if (jobs.size) frame = requestFrame(tick);
  }
  function reset(el) {
    const r = records.get(el);
    finishJob(el, "cancelled", false);
    if (r) restore(el, r);
  }
  function animate(
    el,
    to,
    { from, preset = "smooth", tokens, delay = 0, retain = false } = {},
  ) {
    if (!el) return completed();
    for (const pose of [from, to])
      if (pose)
        for (const [key, value] of Object.entries(pose))
          if (!(key in IDENTITY) || !Number.isFinite(value))
            throw new TypeError(`Unsupported motion property: ${key}`);
    let snapshot, profile;
    try {
      snapshot = tokens || getTokens(el);
      profile = resolveMotionProfile(preset, snapshot);
    } catch (error) {
      if (import.meta.env.DEV)
        console.warn("[motion] Animation skipped:", error.message);
      reset(el);
      return completed();
    }
    const r = record(el);
    const initialVelocity = { ...r.velocity };
    finishJob(el, "cancelled", false);
    if (from) r.pose = { ...r.pose, ...from };
    let target = { ...r.pose, ...to };
    if (profile.kind === "off" || profile.kind === "fade") {
      for (const k of [...spatial, "blur"]) {
        r.pose[k] = IDENTITY[k];
        target[k] = IDENTITY[k];
      }
    }
    const keys = Object.keys(IDENTITY).filter(
      (k) => r.pose[k] !== target[k] || (r.velocity[k] || 0) !== 0,
    );
    if (
      profile.kind === "off" ||
      (profile.kind !== "spring" && profile.duration === 0) ||
      !keys.length ||
      jobs.size + reserved >= snapshot.limits.maxConcurrent
    ) {
      r.pose = target;
      r.velocity = {};
      render(el, r);
      el.style.willChange = r.original.willChange;
      if (!retain) restore(el, r);
      return completed();
    }
    let resolve;
    const finished = new Promise((done) => (resolve = done));
    jobs.set(el, {
      r,
      from: { ...r.pose },
      to: target,
      keys,
      profile,
      initialVelocity,
      start: now(),
      delay: snapshot.mode === "full" ? delay : 0,
      retain,
      resolve,
    });
    peak = Math.max(peak, jobs.size + reserved);
    el.style.willChange = [
      keys.some((k) => spatial.includes(k)) ? "transform" : null,
      keys.includes("opacity") ? "opacity" : null,
      keys.includes("blur") ? "filter" : null,
    ]
      .filter(Boolean)
      .join(", ");
    render(el, r);
    if (frame === null) frame = requestFrame(tick);
    return {
      finished,
      cancel: () => {
        if (jobs.get(el)?.resolve === resolve) {
          finishJob(el, "cancelled", false);
          restore(el, r);
        }
      },
      finish: () => {
        if (jobs.get(el)?.resolve === resolve) finishJob(el);
      },
    };
  }
  function cancelWithin(root) {
    for (const [el] of [...jobs])
      if (root === el || root.contains(el)) reset(el);
  }
  function reserve(count, tokens) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      jobs.size + reserved + count > tokens.limits.maxConcurrent
    )
      return null;
    reserved += count;
    peak = Math.max(peak, jobs.size + reserved);
    let held = true;
    return () => {
      if (held) {
        held = false;
        reserved -= count;
      }
    };
  }
  return {
    animate,
    reset,
    prepare: (el) => record(el),
    cancelWithin,
    reserve,
    finish: (el) => finishJob(el),
    dispose() {
      for (const [el] of [...jobs]) reset(el);
    },
    stats: () => ({ active: jobs.size + reserved, peak, raf: frame !== null }),
  };
}
export const motionEngine = createMotionEngine();
