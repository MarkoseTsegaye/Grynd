import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  LogWeightSheet,
  WeeklyAveragesList,
  WeightLineChart,
  WEIGHT_RANGE_OPTIONS,
  getEntryForDateKey,
  useWeightChartData,
  useWeightStore,
  type WeightRangeId,
} from '../../src/features/weight';
import type { WeightEntry } from '../../src/features/weight';
import {
  formatBodyWeightValue,
  unitLabel,
} from '../../src/features/weight/lib/weightUnits';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import { Button } from '../../src/shared/components/Button';
import { Chip } from '../../src/shared/components/Chip';
import { Icon } from '../../src/shared/components/Icon';
import { dateKeyToday, formatDisplayDate, parseDateKey } from '../../src/shared/lib/date';
import { textRoles } from '../../src/shared/theme/typography';

/** Recent shows a week at a glance; the rest is one tap away. */
const RECENT_COLLAPSED = 7;

/**
 * The full body-weight history, pushed from the Trends tab's summary
 * card. Range chips sit directly above the chart they filter — on the
 * old Weight tab they sat above two cards they had no effect on, so
 * tapping "3m" appeared to do nothing.
 */
export default function BodyWeightScreen() {
  const state = useWeightChartData();
  const upsertEntry = useWeightStore((s) => s.upsertEntry);
  const deleteEntry = useWeightStore((s) => s.deleteEntry);
  const weightUnit = usePrefsStore((s) => s.weightUnit);
  const prefsLoaded = usePrefsStore((s) => s.isLoaded);
  const loadPrefs = usePrefsStore((s) => s.loadPrefs);

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);

  const openLogSheet = useCallback((entry: WeightEntry | null) => {
    setEditingEntry(entry);
    requestAnimationFrame(() => sheetRef.current?.present());
  }, []);

  const entries = state.status === 'loading' ? [] : state.entries;
  const todayEntry = useMemo(
    () => getEntryForDateKey(entries, dateKeyToday()),
    [entries],
  );

  const recentEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.dateKey < a.dateKey ? -1 : b.dateKey > a.dateKey ? 1 : 0,
      ),
    [entries],
  );
  const visibleRecent = recentExpanded
    ? recentEntries
    : recentEntries.slice(0, RECENT_COLLAPSED);

  const sheet = (
    <LogWeightSheet
      sheetRef={sheetRef}
      entry={editingEntry}
      onDismiss={() => setEditingEntry(null)}
      onSubmit={async ({ dateKey, weightLbs }) => {
        await upsertEntry({ dateKey, weightLbs });
      }}
      onDelete={async (id) => {
        await deleteEntry(id);
      }}
    />
  );

  if (state.status === 'loading') {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (state.status === 'empty') {
    return (
      <View className="flex-1 bg-surface-0 px-5 pt-6">
        <View className="flex-1 items-center justify-center px-3">
          <Icon name="scale-bathroom" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4 mb-6`}>
            Log your first weigh-in to start tracking.
          </Text>
          <Button label="Log today" icon="plus" onPress={() => openLogSheet(null)} />
        </View>
        {sheet}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-end mb-4">
          <Button
            label={todayEntry ? 'Edit today' : 'Log today'}
            size="sm"
            icon="plus"
            onPress={() => openLogSheet(todayEntry)}
            accessibilityLabel={todayEntry ? "Edit today's weight" : "Log today's weight"}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {WEIGHT_RANGE_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={state.rangeId === option.id}
              onPress={() => state.setRangeId(option.id as WeightRangeId)}
              accessibilityLabel={`Show ${option.label} range`}
            />
          ))}
        </ScrollView>

        {state.visiblePoints.length > 0 ? (
          <WeightLineChart
            points={state.visiblePoints}
            unit={weightUnit}
            onSelect={(point) => {
              const entry = state.entries.find((e) => e.id === point.id) ?? null;
              openLogSheet(entry);
            }}
          />
        ) : (
          <View className="bg-surface-1 rounded-xl px-4 py-8 items-center">
            <Text className={`text-text-secondary ${textRoles.body} text-center`}>
              No entries in this range.
            </Text>
          </View>
        )}

        <View className="mt-4">
          <WeeklyAveragesList averages={state.weeklyAverages} unit={weightUnit} />
        </View>

        <Text className={`text-text-secondary ${textRoles.sectionLabel} mt-2 mb-3`}>Recent</Text>
        {visibleRecent.map((item) => (
          <TouchableOpacity
            key={item.id}
            className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-3 mb-2"
            onPress={() => openLogSheet(item)}
            accessibilityLabel={`Edit ${formatBodyWeightValue(item.weightLbs, weightUnit)} ${unitLabel(weightUnit)} on ${item.dateKey}`}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <View className="flex-1 pr-3">
              <Text className={`text-text-primary ${textRoles.body}`}>
                {(() => {
                  const parsed = parseDateKey(item.dateKey);
                  return parsed ? formatDisplayDate(parsed) : item.dateKey;
                })()}
              </Text>
            </View>
            <Text className={`text-text-primary ${textRoles.metricLarge}`}>
              {formatBodyWeightValue(item.weightLbs, weightUnit)}
              <Text className={`text-text-secondary ${textRoles.bodySmall}`}>
                {' '}
                {unitLabel(weightUnit)}
              </Text>
            </Text>
            <Icon name="chevron-right" size={18} color="text-secondary" />
          </TouchableOpacity>
        ))}

        {recentEntries.length > RECENT_COLLAPSED && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-1 h-11"
            onPress={() => setRecentExpanded((open) => !open)}
            accessibilityLabel={
              recentExpanded ? 'Show fewer entries' : `Show all ${recentEntries.length} entries`
            }
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text className={`text-accent ${textRoles.toggleLabel}`}>
              {recentExpanded ? 'Show fewer' : `See all ${recentEntries.length}`}
            </Text>
            <Icon name={recentExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="accent" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {sheet}
    </View>
  );
}
