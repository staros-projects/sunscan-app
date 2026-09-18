// Smoke test of utils/SpectrumIdent.js, without a phone or a SUNSCAN :
//
//     node scripts/test_spectrum_ident.mjs
//
// Fakes `profile` payloads from the embedded atlas, as seen by an instrument
// that is deliberately not the one the app assumes (other grating angle, other
// focal length, spectrum upside down, vignetting, noise, 12 bit rounding), then
// checks that the blind search finds where each one sits, that following and
// the calibrated search agree, and that things which are not the Sun are
// turned down.
//
// It shares its atlas with the code under test, so it proves the machinery and
// not the match against a real sky : that takes a real profile.

import { registerHooks } from 'node:module';

// The app imports its modules without extension, which Metro resolves and
// Node does not
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) {
        return next(`${specifier}.js`, context);
      }
      throw error;
    }
  },
});

const ident = await import('../utils/SpectrumIdent.js');
const { SUNSCAN_OPTICS } = await import('../utils/SolarGeometry.js');

let seed = 20260918;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function gaussian() {
  return Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());
}

const atlas = ident.getAtlas()[1];

function fakeProfile({ centreA, flip, thetaDeg, focalError, snr, count = 1000 }) {
  const optics = {
    ...SUNSCAN_OPTICS,
    gratingTotalAngleDeg: thetaDeg,
    cameraFocalMm: SUNSCAN_OPTICS.cameraFocalMm * focalError,
  };
  const truth = { centreA, scale: 1, flip, count };
  const profile = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const wavelength = ident.wavelengthAt(truth, i, optics);
    const at = (wavelength - atlas.startA) / atlas.stepA;
    const k = Math.floor(at);
    const depth = atlas.values[k] + (at - k) * (atlas.values[k + 1] - atlas.values[k]);
    const u = (i - count / 2) / (count / 2);
    const lit = 2600 * (1 - 0.35 * u * u) * (1 + 0.1 * u);
    const value = lit * (1 - depth) + gaussian() * (lit / snr);
    profile[i] = String(Math.max(0, Math.min(4095, Math.round(value))));
  }
  return {
    profile,
    firstA: ident.wavelengthAt(truth, 0, optics),
    lastA: ident.wavelengthAt(truth, count - 1, optics),
  };
}

function endError(solution, fake, count) {
  return Math.max(
    Math.abs(ident.wavelengthAt(solution, 0) - fake.firstA),
    Math.abs(ident.wavelengthAt(solution, count - 1) - fake.lastA),
  );
}

let failures = 0;
function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.log(`  FAIL ${message}`);
  }
}

// --- blind search all along the spectrum -----------------------------------

let located = 0;
let total = 0;
let worst = 0;
let elapsed = 0;
for (let centreA = 3915; centreA <= 6930; centreA += 37.3) {
  const index = total;
  total += 1;
  const fake = fakeProfile({
    centreA,
    flip: index % 2 === 1,
    thetaDeg: [34, 31, 37][index % 3],
    focalError: [1, 1.025, 0.975, 1.04][index % 4],
    snr: [100, 25][index % 2],
  });
  const prepared = ident.prepareProfile(fake.profile);
  const begin = performance.now();
  const solution = prepared.usable ? ident.solve(prepared) : { ok: false };
  elapsed += performance.now() - begin;
  const error = solution.ok ? endError(solution, fake, prepared.count) : Infinity;
  if (error < 0.15) {
    located += 1;
    worst = Math.max(worst, error);
  } else {
    console.log(`  missed ${centreA.toFixed(0)} A : ok=${solution.ok} r=${solution.correlation?.toFixed(3)} runnerUp=${solution.runnerUp?.toFixed(3)}`);
  }
}
console.log(`blind search : ${located}/${total} located, worst error ${worst.toFixed(3)} A at the ends of the window, ${(elapsed / total).toFixed(0)} ms each under Node`);
check(located === total, 'every window should be located');

// --- following, calibrated search, names -----------------------------------

const expected = {
  6562.8: ['Hα'],
  5892: ['Na I D1', 'Na I D2'],
  5175: ['Mg I'],
  3950: ['Ca II K', 'Ca II H'],
  6880: ['O₂'],
};
Object.entries(expected).forEach(([centreText, names]) => {
  const centreA = Number(centreText);
  const instrument = { flip: true, thetaDeg: 32, focalError: 1.02, snr: 80 };
  const first = ident.prepareProfile(fakeProfile({ ...instrument, centreA }).profile);
  const blind = ident.solve(first);
  const movedFake = fakeProfile({ ...instrument, centreA: centreA + 1.7 });
  const moved = ident.prepareProfile(movedFake.profile, first);
  const tracked = ident.track(moved, blind);
  const calibrated = ident.solve(moved, { calibration: { flip: blind.flip, scale: blind.scale } });
  const steady = ident.prepareProfile(fakeProfile({ ...instrument, centreA: centreA + 1.7 }).profile, moved);
  const features = ident.identifyLines(steady, tracked);
  const labels = ident.selectLabels(features, { minGap: 40, maxCount: 14 }).map((feature) => feature.label);

  console.log(`${centreText} A : ${features.length} lines named, of which ${features.filter((f) => f.telluric).length} telluric. ${labels.join(', ')}`);
  check(blind.ok, `${centreText} : blind search`);
  check(tracked.ok && endError(tracked, movedFake, moved.count) < 0.15, `${centreText} : following a 1.7 A move`);
  check(calibrated.ok && endError(calibrated, movedFake, moved.count) < 0.15, `${centreText} : calibrated search`);
  names.forEach((name) => check(labels.includes(name), `${centreText} : ${name} should be among the labels`));
});

// --- what is not the Sun ----------------------------------------------------

const impostors = {
  'flat lamp': () => Array.from({ length: 1000 }, (_, i) => 2500 * (1 - 0.3 * ((i - 500) / 500) ** 2) * (1 + 0.02 * (random() - 0.5))),
  'random lines': () => {
    const values = new Float32Array(1000).fill(2500);
    for (let k = 0; k < 60; k += 1) {
      const centre = random() * 1000;
      const depth = 0.1 + 0.6 * random();
      const width = 1.2 + random();
      for (let i = 0; i < 1000; i += 1) {
        values[i] *= 1 - depth * Math.exp(-0.5 * ((i - centre) / width) ** 2);
      }
    }
    return Array.from(values);
  },
  'no light': () => Array.from({ length: 1000 }, () => 40 + 10 * random()),
  'cropped frame': () => Array.from({ length: 130 }, () => 2000),
};
Object.entries(impostors).forEach(([name, make]) => {
  for (let n = 0; n < 5; n += 1) {
    const prepared = ident.prepareProfile(make());
    const solution = prepared.usable ? ident.solve(prepared) : { ok: false };
    check(!solution.ok, `${name} should be turned down (r=${solution.correlation?.toFixed(3)})`);
  }
});
console.log('impostors : checked');

console.log(failures === 0 ? '\nall good' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
