import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Icon } from '../../src/shared/components/Icon';
import { Chip } from '../../src/shared/components/Chip';
import { textRoles } from '../../src/shared/theme/typography';
import { formatDisplayDate, parseDateKey } from '../../src/shared/lib/date';
import {
  LogWeightSheet,
  useWeightChartData,
  useWeightStore,
  WEIGHT_RANGE_OPTIONS,
  WeeklyAveragesList,
  WeightLineChart,
  WeightSummary,
  type WeightRangeId,
} from '../../src/features/weight';
import type { WeightEntry } from '../../src/features/weight';
import {
  formatBodyWeightValue,
  unitLabel,
} from '../../src/features/weight/lib/weightUnits';
import { usePrefsStore } from '../../src/shared/store/prefsStore';

export default function WeightTabScreen() {
  const insets = useSafeAreaInsets();
  const state = useWeightChartData();
  const weightUnit = usePrefsStore((s) => s.weightUnit);
  const prefsLoaded = usePrefsStore((s) => s.isLoaded);
  const loadPrefs = usePrefsStore((s) => s.loadPrefs);

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs();
  }, [prefsLoaded, loadPrefs]);
  const upsertEntry = useWeightStore((s) => s.upsertEntry);
  const deleteEntry = useWeightStore((s) => s.deleteEntry);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);

  const openLogSheet = useCallback((entry: WeightEntry | null) => {
    setEditingEntry(entry);
    // Ensure state is applied before presenting so useEffect in the sheet fires.
    requestAnimationFrame(() => sheetRef.current?.present());
  }, []);

  const recentEntries = useMemo(() => {
    if (state.status !== 'ready') return [];
    return [...state.entries]
      .sort((a, b) => (b.dateKey < a.dateKey ? -1 : b.dateKey > a.dateKey ? 1 : 0))
      .slice(0, 14);
  }, [state]);

  const header = (
    <View
      className="px-5 pb-4 flex-row items-end justify-between"
      style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
    >
      <Text className={`text-text-primary ${textRoles.screenTitle}`}>Weight</Text>
      <TouchableOpacity
        onPress={() => openLogSheet(null)}
        accessibilityLabel="Log today's weight"
        accessibilityRole="button"
        activeOpacity={0.7}
        className="bg-accent rounded-lg px-3 py-2 flex-row items-center gap-1 mb-1"
      >
        <Icon name="plus" size={18} color="surface-0" />
        <Text className={`text-surface-0 ${textRoles.buttonLabelSmall}`}>Log today</Text>
      </TouchableOpacity>
    </View>
  );

  if (state.status === 'loading') {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (state.status === 'empty') {
    return (
      <View className="flex-1 bg-surface-0">
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="scale-bathroom" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
            Log your first weigh-in to start tracking.
          </Text>
        </View>
        <LogWeightSheet
          sheetRef={sheetRef}
          entry={editingEntry}
          onDismiss={() => setEditingEntry(null)}
          onSubmit={async ({ dateKey, weightLbs }) => {
            await upsertEntry({ dateKey, weightLbs });
          }}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
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

        <WeightSummary
          currentLbs={state.currentLbs}
          rolling7dayAvgLbs={state.rolling7dayAvgLbs}
          weeklyDelta={state.weeklyDelta}
          unit={weightUnit}
        />

        {state.weeklyAverages.length > 0 ? (
          <WeeklyAveragesList averages={state.weeklyAverages} unit={weightUnit} />
        ) : null}

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

        {/* Recent list */}
        <Text className={`text-text-secondary ${textRoles.sectionLabel} mt-6 mb-3`}>
          Recent
        </Text>
        <FlatList
          data={recentEntries}
          keyExtractor={(entry) => entry.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
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
          )}
        />
      </ScrollView>

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
    </View>
  );
}
