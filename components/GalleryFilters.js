import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import PressableScale from './PressableScale';
import { linesDict } from './LineSelector';

// Filters of the gallery, sent to GET /sunscan/scans (stacked only takes the
// line and SpectroSolHub ones, animated the line one, their facets holding
// nothing else). Every one is optional, null meaning "any".
export const NO_FILTERS = { tag: null, status: null, period: null, hub: null };

// Sent as ?tag= for scans carrying no tag at all: an empty value would read as
// "no filter".
const UNTAGGED = 'none';

const STATUSES = [
  { value: 'completed', labelKey: 'filterCompleted', color: '#10b981' },
  { value: 'pending', labelKey: 'filterPending', color: '#a1a1aa' },
  { value: 'failed', labelKey: 'filterFailed', color: '#dc2626' },
];

// SpectroSolHub state, from the mark the backend writes after a successful
// upload. Only offered by a backend that returns hub_statuses.
const HUB_STATUSES = [
  { value: 'sent', labelKey: 'filterHubSent', icon: 'cloud-done-outline' },
  { value: 'not_sent', labelKey: 'filterHubNotSent', icon: 'cloud-offline-outline' },
];

// Date filter set aside for now: its chips are hidden, and no period is ever
// set, so no date_from is sent. Flip back to offer it again.
const SHOW_PERIODS = false;

// Rolling periods ending today. Only date_from is sent: nothing is acquired in
// the future.
const PERIODS = [
  { value: 'today', labelKey: 'filterToday', days: 1 },
  { value: 'week', labelKey: 'filterWeek', days: 7 },
  { value: 'month', labelKey: 'filterMonth', days: 30 },
];

// YYYY-MM-DD in the phone's local time, the format of the backend's `day`.
const isoDay = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const periodStart = (period) => {
  const { days } = PERIODS.find(p => p.value === period);
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return isoDay(d);
};

export const hasActiveFilter = (filters) =>
  Object.values(filters).some(v => v !== null);

export const filtersQuery = (filters) => {
  const params = [];
  if (filters.tag !== null) params.push(`tag=${encodeURIComponent(filters.tag)}`);
  if (filters.status !== null) params.push(`status=${filters.status}`);
  if (filters.period !== null) params.push(`date_from=${periodStart(filters.period)}`);
  if (filters.hub) params.push(`hub_status=${filters.hub}`);
  return params.map(p => '&' + p).join('');
};

// Each count from the backend applies the other active filters but not its own,
// so a chip shows what touching it would return. A chip whose value dropped out
// of its count is hidden, except the active one, which stays visible at 0 so it
// can still be turned off.
const lineChips = (tags, active) => {
  const count = (key) => tags[key] ?? 0;
  const visible = (key) => count(key) > 0 || key === active;
  // Picker order, red to violet, then the tags the picker does not know (a
  // scan tagged `other` would otherwise only show under "All").
  const known = linesDict.filter(l => l.key && visible(l.key));
  const unknown = Object.keys(tags)
    .filter(k => k && !linesDict.some(l => l.key === k) && visible(k))
    .map(k => ({ key: k }));
  if (active && active !== UNTAGGED && !known.some(l => l.key === active) && !unknown.some(l => l.key === active)) {
    unknown.push({ key: active });
  }
  const chips = [...known, ...unknown].map(l => ({
    value: l.key,
    label: l.short || l.key,
    color: l.color,
    count: count(l.key),
  }));
  if (count('') > 0 || active === UNTAGGED) {
    chips.push({ value: UNTAGGED, labelKey: 'filterUntagged', count: count('') });
  }
  return chips;
};

const statusChips = (statuses, active) =>
  STATUSES
    .filter(s => (statuses[s.value] ?? 0) > 0 || s.value === active)
    .map(s => ({ ...s, count: statuses[s.value] ?? 0 }));

const hubChips = (hubStatuses, active) =>
  HUB_STATUSES
    .filter(s => (hubStatuses[s.value] ?? 0) > 0 || s.value === active)
    .map(s => ({ ...s, count: hubStatuses[s.value] ?? 0 }));

// Period counts are summed from the per-day counts, which ignore the date
// filter itself, so every period chip is accurate whichever one is active.
const periodChips = (days) =>
  PERIODS.map(p => {
    const from = periodStart(p.value);
    const count = Object.entries(days).reduce((n, [day, c]) => (day >= from ? n + c : n), 0);
    return { ...p, count };
  });

/**
 * Filter panel of the gallery: lines on a first row, status
 * (and period, hidden for now) and SpectroSolHub state on a second one, and, once a filter is active, a "select all" toggle.
 *
 * @param {object} facets   { tags, statuses, days, hub_statuses } as returned by the backend
 * @param {object} filters  current filters, see NO_FILTERS
 */
export default function GalleryFilters({ facets, filters, onChange, total, allSelected, onToggleSelectAll }) {
  const { t } = useTranslation();
  const active = hasActiveFilter(filters);

  const set = (key, value) => onChange({ ...filters, [key]: filters[key] === value ? null : value });

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} className="bg-zinc-950" style={styles.panel}>
      <ChipRow t={t} groups={[
        facets.tags && { chips: lineChips(facets.tags, filters.tag), active: filters.tag, onPress: (v) => set('tag', v) },
      ]} />
      {/* Status, period and SpectroSolHub share the second row, to keep the panel short */}
      <ChipRow t={t} groups={[
        facets.statuses && { chips: statusChips(facets.statuses, filters.status), active: filters.status, onPress: (v) => set('status', v) },
        SHOW_PERIODS && facets.days && { chips: periodChips(facets.days), active: filters.period, onPress: (v) => set('period', v) },
        facets.hub_statuses && { chips: hubChips(facets.hub_statuses, filters.hub), active: filters.hub, onPress: (v) => set('hub', v) },
      ]} />

      {active && <View className="flex flex-row items-center justify-between" style={styles.footer}>
        <PressableScale onPress={() => onChange(NO_FILTERS)} className="py-1">
          <Text className="text-zinc-400" style={{ fontSize: 12 }}>{t('common:filterClear')}</Text>
        </PressableScale>
        {total > 0 && <PressableScale onPress={onToggleSelectAll} className="bg-zinc-700 px-3 py-1 rounded-full">
          <Text className="text-white" style={{ fontSize: 12 }}>
            {allSelected ? t('common:unselectAll') : t('common:selectAll', { count: total })}
          </Text>
        </PressableScale>}
      </View>}
    </Animated.View>
  );
}

// One scrollable row holding one or more filters, each a group of chips set
// apart by a thin divider. Tapping the active chip turns its filter off, so a
// group needs no "All" chip.
function ChipRow({ groups, t }) {
  const shown = groups.filter(g => g && g.chips.length);
  if (!shown.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {shown.map((group, i) => (
        <View key={i} className="flex flex-row items-center">
          {i > 0 && <View style={styles.divider} />}
          <ChipGroup {...group} t={t} />
        </View>
      ))}
    </ScrollView>
  );
}

function ChipGroup({ chips, active, onPress, t }) {
  return (
    <>
      {chips.map(chip => {
        const isActive = chip.value === active;
        return (
          <PressableScale key={chip.value} onPress={() => onPress(chip.value)}
            className={isActive ? "bg-zinc-700 px-3 py-1 rounded-full flex flex-row items-center mr-2" : "px-3 py-1 rounded-full flex flex-row items-center mr-2"}
            style={{ borderWidth: 1, borderColor: isActive && chip.color ? chip.color : 'rgba(255,255,255,0.12)' }}>
            {chip.color && <View style={[styles.dot, { backgroundColor: chip.color }]} />}
            {chip.icon && <Ionicons name={chip.icon} size={13} color={isActive ? '#fff' : '#a1a1aa'} style={{ marginRight: 5 }} />}
            <Text className={isActive ? "text-white" : "text-zinc-400"} style={{ fontSize: 12 }}>
              {chip.labelKey ? t('common:' + chip.labelKey) : chip.label}
            </Text>
            <Text className="text-zinc-500 ml-1" style={{ fontSize: 11 }}>{chip.count}</Text>
          </PressableScale>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    marginRight: 10,
    marginLeft: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
});
