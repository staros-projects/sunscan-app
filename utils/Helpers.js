import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';


export const backend_current_version = '1.3.0';

export default function  firmareIsUpToDate(myContext) {
    // Check if the firmware version is up to date
    // backend_current_version is the version of the backend API that is embedded in the app
    // myContext.backendApiVersion is the version of the backend API that is currently running on the SUNSCAN device
    return !myContext.backendApiVersion || parseInt(myContext.backendApiVersion.replaceAll('.','')) >= parseInt(backend_current_version.replaceAll('.',''))
}

async function saveAndroidFile(source, type) {
    console.log('Downloading for Android:', source, type);

    try {
        const fileName = `sunscan-image-${Date.now()}.${type}`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        const { uri: localUri } = await FileSystem.downloadAsync(source, filePath);

        console.log('File downloaded at:', localUri);

        const directoryUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(directoryUri);
        if (!permissions.granted) return false;

        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName.split('.')[0],
            `image/${type}`
        );

        await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return true;
    } catch (error) {
        console.error('Error saving file on Android:', error);
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
