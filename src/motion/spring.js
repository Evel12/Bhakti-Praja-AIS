/** Closed-form damped harmonic oscillator. Time is seconds, velocity units/s.
 * Analytic evaluation remains stable when frames are dropped; no Euler steps.
 */
export function sampleSpring(
  time,
  { stiffness, damping, mass },
  from = 0,
  to = 1,
  velocity = 0,
) {
  const w = Math.sqrt(stiffness / mass),
    z = damping / (2 * Math.sqrt(stiffness * mass));
  const d = from - to;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z),
      b = (velocity + z * w * d) / wd;
    const decay = Math.exp(-z * w * time),
      c = Math.cos(wd * time),
      s = Math.sin(wd * time);
    return {
      position: to + decay * (d * c + b * s),
      velocity: decay * ((-z * w * d + b * wd) * c + (-z * w * b - d * wd) * s),
    };
  }
  if (z === 1) {
    const b = velocity + w * d,
      decay = Math.exp(-w * time);
    return {
      position: to + (d + b * time) * decay,
      velocity: (b - w * (d + b * time)) * decay,
    };
  }
  const root = Math.sqrt(z * z - 1),
    r1 = -w * (z - root),
    r2 = -w * (z + root);
  const a = (velocity - r2 * d) / (r1 - r2),
    b = d - a;
  return {
    position: to + a * Math.exp(r1 * time) + b * Math.exp(r2 * time),
    velocity: a * r1 * Math.exp(r1 * time) + b * r2 * Math.exp(r2 * time),
  };
}

export function easeFade(progress, easing) {
  const [x1, y1, x2, y2] = easing.match(/[-+]?\d*\.?\d+/g).map(Number);
  const curve = (t, a, b) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0,
    high = 1;
  // Numerical precision, not a motion duration or spring preset.
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (curve(mid, x1, x2) < progress) low = mid;
    else high = mid;
  }
  return curve((low + high) / 2, y1, y2);
}
