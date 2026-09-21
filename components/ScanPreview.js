// Thumbnail of the disk being built during a scan. Kept tiny on purpose : it is
// a reassurance that the Sun is going through the slit, not a result.

import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { toolbarSurface } from './theme';

const SIZE = 84;

export default function ScanPreview({ uri }) {
  const { t } = useTranslation();
  if (!uri) return null;

  return (
    <View pointerEvents="none" style={[toolbarSurface, { padding: 4, alignItems: 'center' }]}>
      <Image
        source={{ uri }}
        style={{ width: SIZE, height: SIZE, backgroundColor: '#000', borderRadius: 4 }}
        contentFit="fill"
        transition={0}
        cachePolicy="none"
      />
      <Text className="text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>
        {t('common:scanPreview')}
      </Text>
    </View>
  );
}
