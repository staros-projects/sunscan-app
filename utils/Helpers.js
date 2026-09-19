import * as FileSystem from 'expo-file-system';

import * as MediaLibrary from 'expo-media-library';


export const backend_current_version = '2.1.2';

export default function  firmareIsUpToDate(myContext) {
    // Check if the firmware version is up to date
    // backend_current_version is the version of the backend API that is embedded in the app
    // myContext.backendApiVersion is the version of the backend API that is currently running on the SUNSCAN device
    return !myContext.backendApiVersion || parseInt(myContext.backendApiVersion.replaceAll('.','')) >= parseInt(backend_current_version.replaceAll('.',''))
}


// Push the phone clock and timezone to the SUNSCAN. Shared by every place that
// connects the camera, so a scan is never timestamped from the epoch.
export async function setSunScanTime(apiURL) {
    try {
        const response = await fetch('http://' + apiURL + '/sunscan/set-time/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unixtime: Math.floor(Date.now() / 1000).toString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error(error);
    }
}


// Tag a scan, a stack or an animation with a line: the scans route takes the
// path of any of them, and replaces the previous tag (it cannot remove one).
// Resolves to true once the backend accepted it.
export async function tagItem(apiURL, path, tag) {
    try {
        const response = await fetch('http://' + apiURL + '/sunscan/scan/tag/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: path, tag }),
        });
        return response.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}


// Date shown for a stack or an animation: the observation, when the backend
// knows it (an ISO string in UTC), rather than the creation of the item
// (Unix seconds), which can come hours or days after the scans.
export function itemDate(item) {
    const observed = item?.observation_date ? new Date(item.observation_date) : null;
    if (observed && !isNaN(observed)) {
        return observed;
    }
    return new Date(item?.creation_date * 1000);
}


const SUNSCAN_ALBUM = 'SUNSCAN';

// Request media library access only if not already granted
// (avoids re-prompting and handles the "denied forever" case cleanly)
async function ensureMediaPermission() {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) {
        return true;
    }
    if (!current.canAskAgain) {
        console.log('Media library permission denied permanently');
        return false;
    }
    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested.granted;
}

export async function downloadSunscanImage(source, type) {
    if (!source) {
        console.log('downloadSunscanImage: no source provided');
        return false;
    }

    if (!(await ensureMediaPermission())) {
        return false;
    }

    const filePath = `${FileSystem.cacheDirectory}sunscan-image-${Date.now()}.${type}`;
    try {
        // downloadAsync ne lève pas d'erreur sur un statut HTTP 4xx/5xx :
        // sans ce contrôle, le corps de la page d'erreur serait enregistré comme image
        const result = await FileSystem.downloadAsync(source, filePath);
        if (result.status !== 200) {
            throw new Error(`Download failed with HTTP status ${result.status}`);
        }

        // Sauvegarde dans la galerie
        const asset = await MediaLibrary.createAssetAsync(result.uri);

        // L'ajout à l'album SUNSCAN est optionnel : à ce stade l'image est
        // déjà dans la galerie, un échec ici ne doit pas faire échouer la sauvegarde
        // (ex : accès "limité" sur iOS, permissions granulaires Android 13+)
        try {
            const album = await MediaLibrary.getAlbumAsync(SUNSCAN_ALBUM);
            if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
                await MediaLibrary.createAlbumAsync(SUNSCAN_ALBUM, asset, false);
            }
        } catch (albumError) {
            console.log('Could not add to album:', albumError.message);
        }

        return true;
    } catch (error) {
        console.error('Error saving image:', error.message);
        return false;
    } finally {
        // Nettoyage du fichier temporaire, y compris en cas d'échec
        FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
    }
}
