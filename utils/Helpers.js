import * as FileSystem from 'expo-file-system';

import { Platform } from 'react-native';

import * as MediaLibrary from 'expo-media-library';


if (Platform.OS === 'ios') {
    MediaLibrary =  require('expo-media-library');
}

export const backend_current_version = '1.4.0';

export default function  firmareIsUpToDate(myContext) {
    // Check if the firmware version is up to date
    // backend_current_version is the version of the backend API that is embedded in the app
    // myContext.backendApiVersion is the version of the backend API that is currently running on the SUNSCAN device
    return !myContext.backendApiVersion || parseInt(myContext.backendApiVersion.replaceAll('.','')) >= parseInt(backend_current_version.replaceAll('.',''))
}


async function saveAndroidFile(source, type) {
    console.log('Downloading for Android:', source, type);

    try {
        // 1. Télécharger le fichier dans le cache
        const fileName = `sunscan-image-${Date.now()}.${type}`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.downloadAsync(source, filePath);
        console.log('File downloaded at:', filePath);

        // 2. Demander la permission MEDIA_LIBRARY (juste pour sauvegarder, pas pour lire)
        const { status } = await MediaLibrary.requestPermissionsAsync(false); // false = writeOnly
        if (status !== 'granted') {
            console.log('Permission denied');
            return false;
        }

        // 3. Créer l'asset (sauvegarde l'image dans la galerie)
        const asset = await MediaLibrary.createAssetAsync(filePath);
        console.log('Asset created:', asset.uri);

        // 4. Optionnel : créer/ajouter à un album "SUNSCAN"
        try {
            const album = await MediaLibrary.getAlbumAsync('SUNSCAN');
            if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
                await MediaLibrary.createAlbumAsync('SUNSCAN', asset, false);
            }
            console.log('Asset added to SUNSCAN album');
        } catch (albumError) {
            console.log('Could not add to album:', albumError.message);
            // L'image est quand même sauvegardée dans la galerie principale
        }

        // 5. Nettoyer le cache
        await FileSystem.deleteAsync(filePath, { idempotent: true });

        return true;

    } catch (error) {
        console.error('Error saving file on Android:', error);
        console.error('Error details:', error.message);
        return false;
    }
}

async function saveIosFile(source, type) {
    const permissionResponse = await MediaLibrary.requestPermissionsAsync();
    if (permissionResponse.status !== 'granted') return false;

    try {
        const fileName = `sunscan-image-${Date.now()}.${type}`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.downloadAsync(source, filePath);

        const asset = await MediaLibrary.createAssetAsync(filePath);
        let album = await MediaLibrary.getAlbumAsync('Download');
        if (!album) {
            await MediaLibrary.createAlbumAsync('Download', asset, false);
        } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        return true;
    } catch (error) {
        console.error('Error saving file on iOS:', error);
        return false;
    }
}

export async function downloadSunscanImage(source, type) {
    return Platform.OS === 'android' ? await saveAndroidFile(source, type) : await saveIosFile(source, type);
}
