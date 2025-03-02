import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

export const backend_current_version = '1.3.0';

export default function  firmareIsUpToDate(myContext) {
    // Check if the firmware version is up to date
    // backend_current_version is the version of the backend API that is embedded in the app
    // myContext.backendApiVersion is the version of the backend API that is currently running on the SUNSCAN device
    return !myContext.backendApiVersion || parseInt(myContext.backendApiVersion.replaceAll('.','')) >= parseInt(backend_current_version.replaceAll('.',''))
}

export async function downloadAndroid(source, type) {
    console.log('downloadAndroid', source, type, FileSystem.documentDirectory)

    try {
        // Définir le chemin du fichier dans le répertoire de l'application
        const baseFileName = `sunscan-image-${Date.now()}.`+type;
        const filename = `${FileSystem.cacheDirectory}`+baseFileName;

        // Copier l'image vers ce répertoire
        const { uri: localUrl } = await FileSystem.downloadAsync(
            source,
            filename
        );

        const dir = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Pictures'); 

        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(dir);
            if (!permissions.granted) {
           
            return;
            }
    
        await FileSystem.StorageAccessFramework.createFileAsync(dir, baseFileName, 'image/jpeg')
        .then(async (newUri) => {
          await FileSystem.copyAsync({ from: localUrl, to: newUri });
   
        })
        .catch((err) => {
          console.error('Erreur de création du fichier :', err);
    
        });

        console.log('Image saved at:', filename);
    } catch (error) {
        console.error('Error saving image:', error);
    }
};

export async function downloadIos(source, type)  {

    if (permissionResponse.status !== 'granted') {
        await requestPermission();
    }

    try {
       
        const downloadPath = `${FileSystem.cacheDirectory}sunscan-image-${Date.now()}.`+type;
        const { uri: localUrl } = await FileSystem.downloadAsync(
            source,
            downloadPath
        );

        

        const asset = await MediaLibrary.createAssetAsync(downloadPath);

        const album = await MediaLibrary.getAlbumAsync('Download');
        if (album == null) {
            await MediaLibrary.createAlbumAsync('Download', asset, false);
        } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
    } catch (e) {
        handleError(e);
    }
}

// Function to download the current image
export function downloadSunscanImage(filename, type) {
    if (Platform.OS === 'android') {
        downloadAndroid(filename,type);
    }
    else{
        downloadIos(filename, type);
    }
}

