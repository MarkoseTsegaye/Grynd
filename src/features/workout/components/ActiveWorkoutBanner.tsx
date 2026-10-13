import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Icon } from '../../../shared/components/Icon';
import { showDialog } from '../../../shared/lib/dialog';
import { textRoles } from '../../../shared/theme/typography';
import { useWorkoutStore } from '../store/workoutStore';
import { isIncompleteActiveSession, isWorkoutRoute } from '../lib/workoutRoute';

/** Clearance for the tab bar the banner floats above. */
const TAB_BAR_HEIGHT = 60;

/**
 * Persistent reminder that a workout is still open, mounted at the root
 * layout so it follows the user across every tab and pushed screen.
 *
 * Before this, an unfinished session was only surfaced when it had been
 * parked via Leave Workout, or when the user happened to try starting a
 * different split. A session abandoned by killing the app or closing the
 * PWA tab left no trace in the UI at all.
 *
 * Sits at the bottom: the top edge belongs to SyncErrorBanner and the
 * screen titles. Hidden on the workout route itself, where it would float
 * over the thing it points at.
 */
export function ActiveWorkoutBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const session = useWorkoutStore((s) => s.session);
  const abandonWorkout = useWorkoutStore((s) => s.abandonWorkout);

  if (!isIncompleteActiveSession(session)) return null;
  if (isWorkoutRoute(pathname)) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: TAB_BAR_HEIGHT + insets.bottom + 8,
        zIndex: 90,
      }}
    >
      <View
        className="bg-surface-2 rounded-lg flex-row items-center"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 8,
        }}
      >
        <TouchableOpacity
          className="flex-1 flex-row items-center gap-2 pl-3 pr-2 py-2.5"
          onPress={() => router.push(`/workout/${session.splitId}`)}
          accessibilityRole="button"
          accessibilityLabel={`Workout in progress, ${session.splitName}. Resume it.`}
          activeOpacity={0.7}
        >
          <Icon name="progress-clock" size={18} color="accent" />
          <Text className={`flex-1 text-text-primary ${textRoles.bodySmall}`} numberOfLines={1}>
            Workout in progress · {session.splitName}
          </Text>
          <Text className={`text-accent ${textRoles.toggleLabel}`}>Resume</Text>
        </TouchableOpacity>

        {/* Discard lives here too. For a session left behind by a killed app
            there is no launch dialog offering it, so without this the only
            way to clear one is to open it and cancel from inside. The
            confirm covers a mis-tap next to Resume. */}
        <TouchableOpacity
          className="pl-2 pr-3 py-2.5"
          onPress={() =>
            showDialog(
              'Discard workout?',
              `The sets logged in ${session.splitName} will be thrown away. This cannot be undone.`,
              [
                { text: 'Keep it', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => void abandonWorkout() },
              ],
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`Discard the in-progress ${session.splitName} workout`}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Icon name="close" size={16} color="text-secondary" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
