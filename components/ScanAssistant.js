// Pre-scan alignment assistant.
//
// Shows, in one strip above the live spectrum : how long the scan will take,
// how good the geometry is at this hour, and — the part that actually changes
// the images — where along the slit the solar disk has to be parked before the
// scan is started, so that it ends the crossing as close to the centre as it
// started it.
//
// The lane is drawn in arcminutes of sky rather than pixels, which keeps it
// honest whatever the binning mode : the plate scale comes from the measured
// disk, not from a screen dimension.

import React, { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { toolbarSurface } from './theme';
import PressableScale from './PressableScale';
import { TARGET_TOLERANCE_ARCMIN } from '../utils/ScanGeometry';

const QUALITY_COLORS = {
  excellent: '#10b981',
  good: '#84cc16',
  fair: '#fbbf24',
  poor: '#fb923c',
  impossible: '#ef4444',
};

const LANE_HEIGHT = 20;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes} min ${String(rest).padStart(2, '0')} s` : `${rest} s`;
}

function formatArcmin(value) {
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(1)}′`;
}

function formatClock(date) {
  if (!date) return '--:--';
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * The lane : field of view seen from above, with the disk drawn on it.
 *
 * Everything is positioned in arcminutes and converted once, so the geometry
 * reads the same whether the strip is 300 or 500 px wide.
 */
function AlignmentLane({ geometry, targetArcmin, endArcmin, measuredArcmin, width }) {
  const halfSpan = geometry.fieldArcmin / 2;
  const toX = (arcmin) => ((arcmin + halfSpan) / (2 * halfSpan)) * width;
  const diskWidth = (geometry.diameterArcmin / (2 * halfSpan)) * width;

  const safeFrom = toX(-geometry.marginArcmin);
  const safeTo = toX(geometry.marginArcmin);
  const targetX = toX(targetArcmin);
  const endX = toX(endArcmin);
  const hasMeasure = Number.isFinite(measuredArcmin);
  const measuredX = hasMeasure ? toX(measuredArcmin) : null;
  const onTarget = hasMeasure && Math.abs(measuredArcmin - targetArcmin) <= TARGET_TOLERANCE_ARCMIN;

  return (
    <View style={{ width, height: LANE_HEIGHT, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Where the centre of the disk may sit without any part of it being cut */}
      <View style={{
        position: 'absolute',
        left: safeFrom,
        width: Math.max(0, safeTo - safeFrom),
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.05)',
      }} />

      {/* Centre of the field */}
      <View style={{
        position: 'absolute', left: toX(0) - 0.5, top: 2, bottom: 2, width: 1,
        backgroundColor: 'rgba(255,255,255,0.25)',
      }} />

      {/* Where the disk will have arrived when the scan ends : the ghost of the
          same disk, so the observer sees the whole excursion at a glance */}
      <View style={{
        position: 'absolute',
        left: endX - diskWidth / 2,
        width: diskWidth,
        top: 4,
        height: LANE_HEIGHT - 8,
        borderRadius: (LANE_HEIGHT - 8) / 2,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.28)',
      }} />

      {/* The mark to hit before starting */}
      <View style={{
        position: 'absolute',
        left: targetX - diskWidth / 2,
        width: diskWidth,
        top: 2,
        height: LANE_HEIGHT - 4,
        borderRadius: (LANE_HEIGHT - 4) / 2,
        borderWidth: 1.5,
        borderColor: onTarget ? '#10b981' : 'rgba(16,185,129,0.6)',
        backgroundColor: onTarget ? 'rgba(16,185,129,0.15)' : 'transparent',
      }} />
      <View style={{
        position: 'absolute', left: targetX - 1, top: 0, bottom: 0, width: 2,
        backgroundColor: onTarget ? '#10b981' : 'rgba(16,185,129,0.7)',
      }} />

      {/* The disk as it is right now */}
      {hasMeasure && (
        <>
          <View style={{
            position: 'absolute',
            left: measuredX - diskWidth / 2,
            width: diskWidth,
            top: 5,
            height: LANE_HEIGHT - 10,
            borderRadius: (LANE_HEIGHT - 10) / 2,
            backgroundColor: onTarget ? 'rgba(16,185,129,0.65)' : 'rgba(251,191,36,0.6)',
          }} />
          <View style={{
            position: 'absolute', left: measuredX - 0.5, top: 3, bottom: 3, width: 1,
            backgroundColor: '#fff',
          }} />
        </>
      )}
    </View>
  );
}

/**
 * @param geometry        result of getDriftGeometry, or null when the Sun is down
 * @param targetArcmin    sensor-frame position to park the disk at
 * @param endArcmin       sensor-frame position it will drift to
 * @param measuredArcmin  live measurement, null when no limb is visible
 * @param recording       true while the scan runs
 * @param elapsedS        seconds since the record button was pressed
 * @param simulatedDate   non null in offline mode : the drawn-at-random instant
 * @param window          best observing window of the day, or null
 */
export default function ScanAssistant({
  geometry,
  hasLocation = true,
  locationStatus = 'searching',
  onRetryLocation,
  targetArcmin,
  endArcmin,
  measuredArcmin,
  armed = false,
  recording = false,
  elapsedS = 0,
  simulatedDate = null,
  window: observingWindow,
}) {
  const { t } = useTranslation();
  const [width, setWidth] = React.useState(0);

  const hasMeasure = Number.isFinite(measuredArcmin);
  const delta = hasMeasure ? targetArcmin - measuredArcmin : null;
  const onTarget = hasMeasure && Math.abs(delta) <= TARGET_TOLERANCE_ARCMIN;

  const progress = useMemo(() => {
    if (!recording || !geometry || !Number.isFinite(geometry.scanDurationS)) return 0;
    return Math.min(1, elapsedS / geometry.scanDurationS);
  }, [recording, geometry, elapsedS]);

  if (!geometry) {
    // Without a position there is no ephemeris at all ; with one, the only
    // reason to have nothing is that the Sun is below the horizon.
    if (hasLocation) {
      return (
        <View style={[toolbarSurface, { paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' }]}>
          <Text className="text-slate-300" style={{ fontSize: 11 }}>{t('common:assistantSunDown')}</Text>
        </View>
      );
    }
    // A refused permission can only be granted back from the system settings ;
    // a missing fix is worth another try once under the sky.
    const denied = locationStatus === 'denied';
    const searching = locationStatus === 'searching';
    return (
      <PressableScale
        disabled={searching}
        onPress={denied ? () => Linking.openSettings() : onRetryLocation}
        style={[toolbarSurface, { paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center', alignItems: 'center' }]}
      >
        <View className="flex flex-row items-center" style={{ gap: 6 }}>
          <Ionicons
            name={searching ? 'locate-outline' : 'alert-circle-outline'}
            size={13}
            color={searching ? '#a1a1aa' : '#fbbf24'}
          />
          <Text className={searching ? 'text-slate-300' : 'text-amber-400'} style={{ fontSize: 11 }}>
            {t(searching ? 'common:assistantNoLocation'
              : denied ? 'common:assistantLocationDenied' : 'common:assistantLocationUnavailable')}
          </Text>
        </View>
        {!searching && (
          <Text className="text-slate-500" style={{ fontSize: 9, marginTop: 1 }}>
            {t(denied ? 'common:assistantOpenSettings' : 'common:assistantRetry')}
          </Text>
        )}
      </PressableScale>
    );
  }

  // During the scan only the gauge is left : the geometry has been read before
  // starting and the observer is watching the disk build up, not the lane.
  // The duration is an ephemeris estimate, hence the "≈" in the countdown.
  if (recording) {
    return (
      <View style={[toolbarSurface, { paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'center', minWidth: 260 }]}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <View style={{
            height: 3, borderRadius: 2, width: `${progress * 100}%`, backgroundColor: '#ef4444',
          }} />
        </View>
        <Text className="text-slate-300" style={{ fontSize: 10, marginTop: 3, textAlign: 'center' }}>
          {progress >= 1
            ? t('common:assistantScanComplete')
            : t('common:assistantScanRemaining', {
              seconds: Math.max(0, Math.round(geometry.scanDurationS - elapsedS)),
            })}
        </Text>
      </View>
    );
  }

  const qualityColor = QUALITY_COLORS[geometry.quality];

  return (
    <View style={[toolbarSurface, { paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center', minWidth: 360 }]}>
      {/* Header : quality, best window, duration, shear */}
      <View className="flex flex-row items-center justify-between" style={{ marginBottom: 3 }}>
        <View className="flex flex-row items-center" style={{ gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: qualityColor }} />
          <Text style={{ color: qualityColor, fontSize: 11, fontWeight: '700' }}>
            {t(`common:quality_${geometry.quality}`)}
          </Text>
          {simulatedDate && (
            <Text className="text-amber-400" style={{ fontSize: 10 }}>
              · {formatClock(simulatedDate)} {t('common:simulated')}
            </Text>
          )}
          {observingWindow && (
            <Text className="text-slate-500" style={{ fontSize: 10 }}>
              · {t('common:assistantWindow', {
                start: formatClock(observingWindow.start),
                end: formatClock(observingWindow.end),
              })}
            </Text>
          )}
        </View>

        <View className="flex flex-row items-center" style={{ gap: 12 }}>
          <View className="flex flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="time-outline" size={12} color="#a1a1aa" />
            <Text className="text-white" style={{ fontSize: 11, fontWeight: '700' }}>
              {formatDuration(geometry.scanDurationS)}
            </Text>
          </View>
          <Text className="text-slate-400" style={{ fontSize: 11 }}>
            {t('common:shearAngle')} {Math.abs(geometry.shearDeg).toFixed(0)}°
          </Text>
        </View>
      </View>

      {/* The lane */}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <AlignmentLane
            geometry={geometry}
            targetArcmin={targetArcmin}
            endArcmin={endArcmin}
            measuredArcmin={measuredArcmin}
            width={width}
          />
        )}
      </View>

      {/* Instruction */}
      <View className="flex flex-row items-center justify-center" style={{ gap: 6, marginTop: 3 }}>
        {!hasMeasure && armed && (
          <>
            <Ionicons name="radio-button-on" size={14} color="#10b981" />
            <Text className="text-emerald-400" style={{ fontSize: 11, fontWeight: '700' }}>
              {t('common:assistantArmed')}
            </Text>
          </>
        )}
        {!hasMeasure && !armed && (
          <Text className="text-slate-400 italic" style={{ fontSize: 10 }}>
            {t('common:assistantNoSignal')}
          </Text>
        )}
        {hasMeasure && !onTarget && (
          <>
            <Ionicons
              name={delta > 0 ? 'arrow-forward' : 'arrow-back'}
              size={14}
              color="#fbbf24"
            />
            <Text className="text-amber-400" style={{ fontSize: 11, fontWeight: '700' }}>
              {t('common:assistantShiftBy', { amount: formatArcmin(Math.abs(delta)) })}
            </Text>
          </>
        )}
        {onTarget && (
          <>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text className="text-emerald-400" style={{ fontSize: 11, fontWeight: '700' }}>
              {t('common:assistantReady')}
            </Text>
          </>
        )}
      </View>

      {/* Only said when parking cannot save the scan */}
      {geometry.clipsEvenWhenOffset && (
        <Text className="text-slate-500" style={{ fontSize: 9, textAlign: 'center', marginTop: 1 }}>
          {t('common:assistantWontFit')}
        </Text>
      )}
    </View>
  );
}
