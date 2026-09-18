// Geometry of a SUNSCAN drift scan.
//
// The SUNSCAN sits on a photo tripod and does not track : the Sun crosses the
// entrance slit on its own, carried by the rotation of the Earth. The slit is
// vertical in the sky frame, so the diurnal motion splits in two :
//
//   - the component across the slit is what performs the scan. It sets how long
//     the disk takes to go through, and it never reverses during the day.
//   - the component along the slit is parasitic. It makes the solar image walk
//     along the slit while the scan runs, and it *does* reverse at the meridian
//     (the Sun climbs in the morning, comes down in the afternoon).
//
// Centring the disk at the start of the scan is therefore the wrong move : by
// the end it has walked off by the full amount. Starting it offset by half the
// walk, on the upstream side, keeps it inside the field the whole way through.
//
// The angle between the drift direction and the horizon is the parallactic
// angle q, and the walk has a pleasantly simple closed form :
//
//     walk along the slit = solar diameter x tan|q|
//
// independent of latitude, season and drift speed.
//
// Rather than evaluating q analytically (and getting its sign wrong in one of
// the four quadrants, or in the southern hemisphere), everything below is
// derived from a numerical derivative of the SunCalc alt/az position. The signs
// then come out right everywhere on Earth for free.

import * as SunCalc from 'suncalc';

const RAD = Math.PI / 180;
const ARCMIN_PER_RAD = (180 / Math.PI) * 60;
const ARCSEC_PER_RAD = ARCMIN_PER_RAD * 60;

// Half-interval of the central difference used for the drift, in seconds. Large
// enough that the float noise of SunCalc is negligible, small enough that the
// diurnal arc is still locally straight.
const DERIVATIVE_HALF_STEP_S = 60;

// Optical train of the SUNSCAN, from the Shelyak optical kit and the IMX477
// sensor mode used by the backend (sensor_modes[3], full width).
export const SUNSCAN_OPTICS = {
  objectiveFocalMm: 200,     // Edmund #32-917, the telescope objective
  collimatorFocalMm: 75,     // Edmund #32-325
  cameraFocalMm: 100,        // Edmund #32-327
  pixelSizeMm: 0.00155,      // IMX477
  sensorWidthPx: 4056,       // full sensor width = the spatial (along slit) axis
  slitLengthMm: 6,           // Shelyak Sol'Ex / SUNSCAN GEN2 slit
  slitWidthUm: 10,           // the wider of the holder's two slits (the other is 7)
  gratingLinesPerMm: 2400,   // holographic grating, used in the first order
  // Angle between the beam reaching the grating and the one leaving it towards
  // the camera. Taken from the Sol'Ex the SUNSCAN derives from, not measured :
  // SpectrumIdent fits the dispersion scale, which absorbs an error here.
  gratingTotalAngleDeg: 34,
};

// Quality tiers, worst to best. Exported as an ordered list so callers can
// compare two tiers without hardcoding the order.
export const QUALITY_TIERS = ['impossible', 'poor', 'fair', 'good', 'excellent'];

// Shear thresholds on |q|, in degrees. Above these the reconstructed disk is
// increasingly skewed : the geometric correction has to resample along a slanted
// axis, which costs resolution even when the disk still fits in the field.
const SHEAR_POOR_DEG = 45;
const SHEAR_FAIR_DEG = 30;
const SHEAR_GOOD_DEG = 15;

/**
 * Angular width of the slit itself, in arcminutes.
 *
 * It is the resolution limit along the scan direction, and it slightly
 * lengthens the crossing : the disk is not done going through until its
 * trailing limb has cleared the far edge of the slit, so the full transit
 * spans one diameter *plus* one slit width.
 */
export function slitWidthArcmin(optics = SUNSCAN_OPTICS) {
  return ((optics.slitWidthUm / 1000) / optics.objectiveFocalMm) * ARCMIN_PER_RAD;
}

/**
 * Angular field available along the slit, in arcminutes.
 *
 * Two things can clip the solar image : the sensor width brought back to the
 * slit plane, and the physical length of the slit. The SUNSCAN slit is 6 mm
 * long against 4.72 mm of sensor, so here it is the sensor that sets the limit
 * and the slit has room to spare.
 */
export function usableFieldArcmin(optics = SUNSCAN_OPTICS) {
  const magnification = optics.cameraFocalMm / optics.collimatorFocalMm;
  const sensorAtSlitMm = (optics.sensorWidthPx * optics.pixelSizeMm) / magnification;
  const apertureMm = Math.min(sensorAtSlitMm, optics.slitLengthMm);
  return (apertureMm / optics.objectiveFocalMm) * ARCMIN_PER_RAD;
}

/**
 * Angular field the sensor alone would give, ignoring the slit. Used to turn a
 * position measured in frame samples into arcminutes, since a frame sample maps
 * to the sensor and not to the slit.
 */
export function sensorFieldArcmin(optics = SUNSCAN_OPTICS) {
  const magnification = optics.cameraFocalMm / optics.collimatorFocalMm;
  const sensorAtSlitMm = (optics.sensorWidthPx * optics.pixelSizeMm) / magnification;
  return (sensorAtSlitMm / optics.objectiveFocalMm) * ARCMIN_PER_RAD;
}

/**
 * Apparent solar diameter in arcminutes, from the Earth-Sun distance. Varies by
 * about 3% over the year, which is worth keeping : it feeds straight into the
 * scan duration.
 */
export function solarDiameterArcmin(date = new Date()) {
  const daysSinceJ2000 = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const meanAnomaly = (357.5291 + 0.98560028 * daysSinceJ2000) * RAD;
  // Low order expansion of the radius vector, good to a few 1e-5 AU
  const distanceAu = 1.00014
    - 0.01671 * Math.cos(meanAnomaly)
    - 0.00014 * Math.cos(2 * meanAnomaly);
  return 1919.26 / distanceAu / 60;
}

// Wrap an angle difference into ]-pi, pi], so the azimuth derivative survives
// the wrap-around of the SunCalc convention.
function wrapPi(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function qualityFromShear(shearDeg) {
  if (shearDeg > SHEAR_POOR_DEG) return 'poor';
  if (shearDeg > SHEAR_FAIR_DEG) return 'fair';
  if (shearDeg > SHEAR_GOOD_DEG) return 'good';
  return 'excellent';
}

/**
 * Everything needed to plan a scan at a given place and instant.
 *
 * Sign convention for every "along the slit" quantity : positive means towards
 * increasing altitude, i.e. the direction the Sun climbs in. Which way that
 * lands on the sensor is an instrument property, not an astronomical one, so it
 * is resolved separately by the empirical calibration in ScanGeometry.
 *
 * @returns null when the Sun is below the horizon.
 */
export function getDriftGeometry({ latitude, longitude, date = new Date(), optics = SUNSCAN_OPTICS }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const here = SunCalc.getPosition(date, latitude, longitude);
  if (here.altitude <= 0) {
    return null;
  }

  const t = date.getTime();
  const before = SunCalc.getPosition(new Date(t - DERIVATIVE_HALF_STEP_S * 1000), latitude, longitude);
  const after = SunCalc.getPosition(new Date(t + DERIVATIVE_HALF_STEP_S * 1000), latitude, longitude);

  // Central difference, in radians per second. The azimuth step is projected on
  // the sky with cos(altitude) : near the zenith a large azimuth change is a
  // small angular displacement.
  const span = 2 * DERIVATIVE_HALF_STEP_S;
  const acrossRate = (wrapPi(after.azimuth - before.azimuth) * Math.cos(here.altitude)) / span;
  const alongRate = (after.altitude - before.altitude) / span;

  // Angle of the drift away from the across-slit axis. Taking |across| keeps it
  // in ]-90, 90[ whichever hemisphere we are in ; its magnitude is the
  // parallactic angle and its sign says which way the image walks.
  const shearDeg = Math.atan2(alongRate, Math.abs(acrossRate)) / RAD;

  const diameterArcmin = solarDiameterArcmin(date);
  const fieldArcmin = usableFieldArcmin(optics);
  // Room left on each side once the disk is centred
  const marginArcmin = (fieldArcmin - diameterArcmin) / 2;

  const crossRate = Math.abs(acrossRate);
  // First contact to last contact : the leading limb has to reach the near edge
  // of the slit and the trailing limb clear the far one, hence diameter + width.
  const transitArcmin = diameterArcmin + slitWidthArcmin(optics);
  const scanDurationS = crossRate > 0 ? transitArcmin / ARCMIN_PER_RAD / crossRate : Infinity;
  // Signed walk along the slit over the whole crossing. Equals transit x tan(shear).
  const slitWalkArcmin = alongRate * scanDurationS * ARCMIN_PER_RAD;

  // Start half a walk upstream so the disk ends up symmetric about the centre
  const startOffsetArcmin = -slitWalkArcmin / 2;
  const endOffsetArcmin = slitWalkArcmin / 2;

  const excursionArcmin = Math.abs(slitWalkArcmin) / 2;
  const clipsEvenWhenOffset = excursionArcmin > marginArcmin;
  const clipsWhenCentred = Math.abs(slitWalkArcmin) > marginArcmin;

  const quality = clipsEvenWhenOffset ? 'impossible' : qualityFromShear(Math.abs(shearDeg));

  return {
    date,
    altitudeDeg: here.altitude / RAD,
    // SunCalc measures azimuth from south towards west ; shift to the usual
    // "degrees clockwise from north" for anything user facing.
    azimuthDeg: (here.azimuth / RAD + 180 + 360) % 360,

    shearDeg,                                           // = parallactic angle, signed
    driftRateArcsecPerS: Math.hypot(acrossRate, alongRate) * ARCSEC_PER_RAD,
    alongRateArcminPerS: alongRate * ARCMIN_PER_RAD,    // signed, + = towards higher altitude
    acrossRateArcminPerS: crossRate * ARCMIN_PER_RAD,

    diameterArcmin,
    fieldArcmin,
    marginArcmin,

    scanDurationS,
    slitWalkArcmin,                                     // signed
    startOffsetArcmin,                                  // signed, where to place the disk
    endOffsetArcmin,                                    // signed, where it will end up

    clipsWhenCentred,                                   // true when the offset actually earns its keep
    clipsEvenWhenOffset,                                // true when the disk cannot fit at all
    quality,
  };
}

/**
 * Widest run of the day, around local noon, where the scan quality stays at or
 * above `minQuality`. Returns null when no instant of the day qualifies.
 *
 * Sampled rather than solved : q is monotonic either side of the meridian, so a
 * walk outwards from solar noon finds the edges without any root finding.
 */
export function getObservingWindow({
  latitude,
  longitude,
  date = new Date(),
  optics = SUNSCAN_OPTICS,
  minQuality = 'fair',
  stepMinutes = 2,
}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const times = SunCalc.getTimes(date, latitude, longitude);
  const noon = times.solarNoon;
  if (!noon || !isFinite(noon.getTime())) {
    return null;
  }

  const threshold = QUALITY_TIERS.indexOf(minQuality);
  const stepMs = stepMinutes * 60 * 1000;
  const sunriseMs = times.sunrise?.getTime();
  const sunsetMs = times.sunset?.getTime();
  // Polar day has no sunrise : fall back to a full 24h sweep around noon
  const fromMs = isFinite(sunriseMs) ? sunriseMs : noon.getTime() - 12 * 3600 * 1000;
  const toMs = isFinite(sunsetMs) ? sunsetMs : noon.getTime() + 12 * 3600 * 1000;

  const meets = (ms) => {
    const geometry = getDriftGeometry({ latitude, longitude, date: new Date(ms), optics });
    return geometry != null && QUALITY_TIERS.indexOf(geometry.quality) >= threshold;
  };

  if (!meets(noon.getTime())) {
    return null;
  }

  let startMs = noon.getTime();
  while (startMs - stepMs >= fromMs && meets(startMs - stepMs)) {
    startMs -= stepMs;
  }
  let endMs = noon.getTime();
  while (endMs + stepMs <= toMs && meets(endMs + stepMs)) {
    endMs += stepMs;
  }

  return { start: new Date(startMs), end: new Date(endMs), quality: minQuality };
}

/**
 * A random instant well inside the day (10% .. 90% of the arc).
 *
 * Offline mode has no live observing session, so anything that depends on the
 * Sun being up shows a plausible daytime instant instead of a Sun stuck below
 * the horizon whenever the app is opened at night. Shared by the home screen
 * graph and the scan assistant so both tell the same story.
 */
export function randomDaytime(times) {
  const span = times?.sunset?.getTime() - times?.sunrise?.getTime();
  if (!isFinite(span) || span <= 0) return null;
  return new Date(times.sunrise.getTime() + span * (0.1 + 0.8 * Math.random()));
}

/**
 * Convenience wrapper : the instant a screen should compute for. Live mode uses
 * the clock, offline mode draws a daytime instant once and sticks to it.
 */
export function simulatedDaytime(latitude, longitude, date = new Date()) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return randomDaytime(SunCalc.getTimes(date, latitude, longitude));
}
