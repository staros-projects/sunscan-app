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
    console.log('downloadAndroid', source, type, FileSystem.documentDirectory);

    try {
        // Définir le nom du fichier
        const baseFileName = `sunscan-image-${Date.now()}.${type}`;
        const filename = `${FileSystem.cacheDirectory}${baseFileName}`;

        // Télécharger le fichier dans le cache
        const { uri } = await FileSystem.downloadAsync(source, filename);
        console.log('Image téléchargée localement :', uri);

        // Demander à l'utilisateur de choisir un dossier
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync('Downloads');
        if (!permissions.granted) {
            console.log("Permission non accordée");
            return false;
        }

        console.log('Dossier choisi :', permissions.directoryUri);

        try {

             // Création du fichier dans le dossier sélectionné par l'utilisateur
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                baseFileName,
                'image/jpeg'
            );

            // Lire l'image temporaire en base64
            const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

            // Écrire les données dans le fichier SAF
            await FileSystem.writeAsStringAsync(fileUri, fileData, {
                encoding: FileSystem.EncodingType.Base64,
            });


            console.log('Image copiée avec succès');
            return true;
        } catch (err) {
            console.error('Erreur de création du fichier :', err);
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l’image :', error);
        return false;
    }
}


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
        return true;
    } catch (e) {
        handleError(e);
        return false;
    }
    return false;
}

// Function to download the current image
export async function downloadSunscanImage(filename, type) {
    if (Platform.OS === 'android') {
        return await downloadAndroid(filename,type);
    }
    else{
        return await downloadIos(filename, type);
    }
}

