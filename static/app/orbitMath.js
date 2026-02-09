import * as THREE from "three";

export const AU = 25; // visual units per AU
const DEG = Math.PI / 180;

const safeNum = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

export function solveKepler(M, e, iters = 7) {
  M = safeNum(M);
  e = safeNum(e);
  M = ((M + Math.PI) % (2 * Math.PI)) - Math.PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < iters; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    if (fp === 0) break;
    const dE = -f / fp;
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

export function precompute(elements) {
  const i = safeNum(elements.i) * DEG;
  const Omega = safeNum(elements.Omega) * DEG;
  const omega = safeNum(elements.omega) * DEG;
  const e = safeNum(elements.e);
  const a = safeNum(elements.a);
  const sqrt1me2 = Math.sqrt(Math.max(0, 1 - e * e));
  const n = a > 0 ? Math.sqrt(1 / Math.pow(a, 3)) : 0; // rad / year (mu=1)
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const co = Math.cos(omega), so = Math.sin(omega);
  const ci = Math.cos(i), si = Math.sin(i);
  return {
    ...elements,
    e,
    a,
    i: safeNum(elements.i),
    Omega: safeNum(elements.Omega),
    omega: safeNum(elements.omega),
    M0: safeNum(elements.M0),
    sqrt1me2,
    n,
    cO,
    sO,
    co,
    so,
    ci,
    si,
    epochJD: Number.isFinite(elements.epochJD) ? elements.epochJD : 2460000.5,
  };
}

export function positionAU(pre, tJD, exaggeration = 1) {
  const t = safeNum(tJD);
  const dtYears = (t - pre.epochJD) / 365.25;
  const n = safeNum(pre.n);
  const M = safeNum(pre.M0) + n * dtYears;
  const E = solveKepler(M, pre.e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const xP = pre.a * (cosE - pre.e);
  const yP = pre.a * pre.sqrt1me2 * sinE;

  const x1 = xP * pre.co - yP * pre.so;
  const y1 = xP * pre.so + yP * pre.co;

  const ex = safeNum(exaggeration, 1);
  const y1i = y1 * (1 + (ex - 1) * 0.8);
  const x2 = x1;
  const y2 = y1i * pre.ci;
  const z2 = y1i * pre.si * ex;

  const x = x2 * pre.cO - y2 * pre.sO;
  const y = x2 * pre.sO + y2 * pre.cO;
  const z = z2;
  // Orbital math uses (x,y) as the reference plane and z as "up".
  // three.js scene uses y as "up" and the ecliptic in the x-z plane.
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return new THREE.Vector3(0, 0, 0);
  }
  return new THREE.Vector3(x, z, y);
}

export function orbitPolyline(pre, segments = 256) {
  const pts = new Array(segments + 1);
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * 2 * Math.PI;
    const cosE = Math.cos(E), sinE = Math.sin(E);
    const xP = pre.a * (cosE - pre.e);
    const yP = pre.a * pre.sqrt1me2 * sinE;

    const x1 = xP * pre.co - yP * pre.so;
    const y1 = xP * pre.so + yP * pre.co;
    const x2 = x1;
    const y2 = y1 * pre.ci;
    const z2 = y1 * pre.si;
    const x = x2 * pre.cO - y2 * pre.sO;
    const y = x2 * pre.sO + y2 * pre.cO;
    const z = z2;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      pts[s] = new THREE.Vector3(0, 0, 0);
    } else {
      pts[s] = new THREE.Vector3(x, z, y);
    }
  }
  return pts;
}

export function jdNow() {
  const ms = Date.now();
  return 2440587.5 + ms / 86400000;
}
