// Observer position, shared by the home screen and the scan assistant.
//
// Only the GPS is needed : the reverse geocoding (city name) goes through the
// network, which is usually missing in the field where the phone sits on the
// SunScan hotspot, so it is kept apart and never allowed to lose the fix.

import * as Location from 'expo-location';

// getCurrentPositionAsync has no timeout of its own and may wait for ever
// without a sky view : give up after this long.
const FIX_TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Asks for the permission if needed, then returns the last known position, or
 * a fresh fix when there is none.
 *
 * @returns {Promise<{status: 'ok', location: object} | {status: 'denied'} | {status: 'unavailable'}>}
 */
export async function acquirePosition() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'denied' };
    }

    let location = await Location.getLastKnownPositionAsync();
    if (!location) {
      location = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        FIX_TIMEOUT_MS,
      );
    }
    return location ? { status: 'ok', location } : { status: 'unavailable' };
  } catch (error) {
    // Location services switched off at the system level land here
    console.warn('acquirePosition', error);
    return { status: 'unavailable' };
  }
}

/** City name for a position, or null when offline or unknown. */
export async function reverseGeocode(location) {
  try {
    return await Location.reverseGeocodeAsync({
      longitude: location.coords.longitude,
      latitude: location.coords.latitude,
    });
  } catch (error) {
    return null;
  }
}
