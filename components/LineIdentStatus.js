import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, toolbarSurface } from './theme';
import { SOLAR_COLOR, TELLURIC_COLOR } from './LineIdentOverlay';

// Status of useLineIdent -> what to tell the observer about it
const MESSAGES = {
  starting: 'identStarting',
  searching: 'identSearching',
  unknown: 'identUnknown',
  dark: 'identDark',
  saturated: 'identSaturated',
  flat: 'identFlat',
  short: 'identShort',
  silent: 'identSilent',
  unsupported: 'identUnsupported',
};

// Nothing is wrong in these, the identification is simply on its way
const BUSY = ['starting', 'searching'];

function Swatch({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: '#d4d4d8', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

/**
 * Banner of the line identification : which stretch of spectrum is on screen
 * once it is known, and why not when it is not.
 */
export default function LineIdentStatus({ status, solution, features }) {
  const { t } = useTranslation();

  if (status === 'off') {
    return null;
  }

  if (status === 'locked' && solution) {
    const telluric = features.some((feature) => feature.telluric);
    return (
      <View style={[toolbarSurface, { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center', gap: 2 }]}>
        <Text className="text-white font-bold" style={{ fontSize: 14 }}>
          {solution.startA.toFixed(0)} – {solution.endA.toFixed(0)} Å
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 10 }}>
            {solution.dispersionA.toFixed(3)} Å/px · {t('common:identLines', { n: features.length })}
          </Text>
          <Swatch color={SOLAR_COLOR} label={t('common:identSolar')} />
          {telluric && <Swatch color={TELLURIC_COLOR} label={t('common:identTelluric')} />}
        </View>
      </View>
    );
  }

  const busy = BUSY.includes(status);
  return (
    <View style={[toolbarSurface, { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8 }]}>
      {busy && <ActivityIndicator size="small" color={colors.accent} />}
      <Text style={{ color: busy ? '#fff' : colors.warning, fontSize: 12 }}>
        {t('common:' + (MESSAGES[status] || 'identUnknown'))}
      </Text>
    </View>
  );
}
