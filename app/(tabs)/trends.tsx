import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  LogWeightSheet,
  WeightSummary,
  getEntryForDateKey,
  useWeightChartData,
  useWeightStore,
} from '../../src/features/weight';
import type { WeightEntry } from '../../src/features/weight';
import {
  ExerciseProgressRow,
  Sparkline,
  useExerciseMomentum,
  type MomentumRow,
} from '../../src/features/progress';
import {
  buildVolumeSeries,
  formatVolumeAbbreviated,
  getVolumeInLastDays,
} from '../../src/features/progress/lib/sessionVolume';
import { getSeriesTrend } from '../../src/features/progress/lib/sparkline';
import { useHistory } from '../../src/features/history';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import { useAuth } from '../../src/features/auth';
import { Button } from '../../src/shared/components/Button';
import { Icon } from '../../src/shared/components/Icon';
import { SyncStatusDot } from '../../src/shared/components/SyncStatusDot';
import { dateKeyToday, formatDisplayDate } from '../../src/shared/lib/date';
import { kgToLbs } from '../../src/shared/lib/weight';
import { textRoles } from '../../src/shared/theme/typography';

/**
 * Every trend in one place. Progress and Weight used to be separate
 * tabs, and Progress rendered the same split list as Home and Splits —
 * three tabs showing the same rows with different tap behaviour.
 *
 * Order is fastest-read first: today's body weight, then workout volume,
 * then the lifts that are actually moving.
 */
export default function TrendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weightState = useWeightChartData();
  const upsertEntry = useWeightStore((s) => s.upsertEntry);
  const deleteEntry = useWeightStore((s) => s.deleteEntry);
  const { sessions } = useHistory();
  const momentum = useExerciseMomentum();
  const { isUnconfigured } = useAuth();

  const weightUnit = usePrefsStore((s) => s.weightUnit);
  const prefsLoaded = usePrefsStore((s) => s.isLoaded);
  const loadPrefs = usePrefsStore((s) => s.loadPrefs);

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);

  const entries = weightState.status === 'loading' ? [] : weightState.entries;
  const todayEntry = useMemo(
    () => getEntryForDateKey(entries, dateKeyToday()),
    [entries],
  );

  const openLogSheet = useCallback((entry: WeightEntry | null) => {
    setEditingEntry(entry);
    // Let state settle before presenting so the sheet's effect sees it.
    requestAnimationFrame(() => sheetRef.current?.present());
  }, []);

  const volume = useMemo(() => {
    const series = buildVolumeSeries(sessions).map((point) => point.volume);
    const recent = getVolumeInLastDays(sessions, 7);
    return {
      values: series,
      trend: getSeriesTrend(series),
      recentTotal: formatVolumeAbbreviated(
        weightUnit === 'lbs' ? kgToLbs(recent) : recent,
      ),
    };
  }, [sessions, weightUnit]);

  const unitSuffix = weightUnit === 'lbs' ? 'lb' : 'kg';

  return (
    <View className="flex-1 bg-surface-0">
      <View
        className="px-5 pb-4 flex-row items-center justify-between"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>Trends</Text>
        {!isUnconfigured && <SyncStatusDot size={9} />}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Body weight */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-text-secondary ${textRoles.sectionLabel}`}>Body weight</Text>
          <Button
            label={todayEntry ? 'Edit today' : 'Log today'}
            size="sm"
            icon="plus"
            onPress={() => openLogSheet(todayEntry)}
            accessibilityLabel={todayEntry ? "Edit today's weight" : "Log today's weight"}
          />
        </View>

        {weightState.status === 'ready' ? (
          <>
            <WeightSummary
              currentLbs={weightState.currentLbs}
              rolling7dayAvgLbs={weightState.rolling7dayAvgLbs}
              weeklyDelta={weightState.weeklyDelta}
              unit={weightUnit}
              latestLabel={
                todayEntry ? `Today · ${formatDisplayDate(new Date())}` : 'Latest weight'
              }
            />
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1 h-11 -mt-2 mb-4"
              onPress={() => router.push('/trends/weight')}
              accessibilityLabel="See all body weight entries"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text className={`text-accent ${textRoles.toggleLabel}`}>See all</Text>
              <Icon name="chevron-right" size={16} color="accent" />
            </TouchableOpacity>
          </>
        ) : weightState.status === 'empty' ? (
          <View className="bg-surface-1 rounded-xl px-4 py-6 mb-4 items-center">
            <Text className={`text-text-secondary ${textRoles.body} text-center`}>
              Log your first weigh-in to start tracking.
            </Text>
          </View>
        ) : null}

        {/* Workout volume */}
        <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>Workouts</Text>
        <TouchableOpacity
          className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-4 mb-6"
          onPress={() => router.push('/progress/volume')}
          accessibilityLabel="View workout volume over time"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-3 flex-1 pr-3">
            <Icon name="chart-line" size={22} color="accent" />
            <View className="flex-1">
              <Text className={`text-text-primary ${textRoles.listItemTitle}`}>
                Workout volume
              </Text>
              <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                {volume.values.length > 0
                  ? `${volume.recentTotal} ${unitSuffix}·reps in the last 7 days`
                  : `Total ${unitSuffix}·reps across all sessions`}
              </Text>
            </View>
          </View>
          {volume.values.length > 1 && (
            <Sparkline values={volume.values} tone={volume.trend?.direction ?? 'flat'} />
          )}
          <Icon name="chevron-right" size={22} color="text-secondary" />
        </TouchableOpacity>

        {/* Exercises, ranked by what's moving */}
        {momentum.isLoaded && momentum.isEmpty ? (
          <View className="bg-surface-1 rounded-lg px-4 py-6 items-center">
            <Icon name="chart-line" size={40} color="text-disabled" />
            <Text className={`text-text-secondary ${textRoles.body} text-center mt-3`}>
              Log a few workouts and your movers show up here.
            </Text>
          </View>
        ) : (
          <>
            <MomentumSection
              title="Rising"
              rows={momentum.rising}
              onOpen={(id) => router.push(`/progress/exercise/${id}`)}
            />
            <MomentumSection
              title="Stalled"
              rows={momentum.stalled}
              onOpen={(id) => router.push(`/progress/exercise/${id}`)}
            />
            <MomentumSection
              title="PRs this month"
              rows={momentum.prs}
              onOpen={(id) => router.push(`/progress/exercise/${id}`)}
            />
          </>
        )}
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

/** A momentum bucket. Renders nothing when empty — an empty header is noise. */
function MomentumSection({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: MomentumRow[];
  onOpen: (exerciseId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <View className="mb-6">
      <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>{title}</Text>
      {rows.map((row) => (
        <ExerciseProgressRow
          key={row.exerciseId}
          name={row.name}
          values={row.values}
          trend={row.trend}
          onPress={() => onOpen(row.exerciseId)}
        />
      ))}
    </View>
  );
}
