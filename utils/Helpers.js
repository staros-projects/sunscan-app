import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { shareAsync } from 'expo-sharing';

export const backend_current_version = '1.3.0';

export default function  firmareIsUpToDate(myContext) {
    // Check if the firmware version is up to date
    // backend_current_version is the version of the backend API that is embedded in the app
    // myContext.backendApiVersion is the version of the backend API that is currently running on the SUNSCAN device
    return !myContext.backendApiVersion || parseInt(myContext.backendApiVersion.replaceAll('.','')) >= parseInt(backend_current_version.replaceAll('.',''))
}

const save = async (uri, fileName, mimetype) => {
    // This has support only for Android 11 or more as expo requires to eject project in order to save to downloads
    if (Platform.OS === 'android') {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (permissions.granted) {
        console.log(permissions);
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log(permissions.directoryUri, fileName, mimetype);
        await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName.split('.')[0],
          mimetype,
        )
          .then(async (resultUri) => {
            await FileSystem.writeAsStringAsync(resultUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
          })
          .catch(console.log);
      } else {
        shareAsync(uri);
      }
    } else {
      shareAsync(uri);
    }
  };

export async function downloadAndroid(source, type) {
    console.log('downloadAndroid', source, type, FileSystem.documentDirectory);

    try {
        // Définir le nom du fichier
        const baseFileName = `sunscan-image-${Date.now()}.${type}`;
        const filename = `${FileSystem.cacheDirectory}${baseFileName}`;

        // Télécharger le fichier dans le cache
        const { uri } = await FileSystem.downloadAsync(source, filename);

        save(uri, baseFileName, `image/${type}`)
       
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

