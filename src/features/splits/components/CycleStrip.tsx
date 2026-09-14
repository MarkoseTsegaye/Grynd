import React, { useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { CycleStripDay } from '../lib/cycleStrip';

interface Props {
  days: CycleStripDay[];
  totalDays: number;
  /** Long-press a pill to make that day today. */
  onPickDay?: (index: number) => void;
}

const PILL_WIDTH = 52;
const PILL_HEIGHT = 56;
const PILL_GAP = 8;
/**
 * Scroll today one pill in from the leading edge rather than flush to it, so
 * the day you just finished stays visible and the strip reads as a sequence
 * you are moving through.
 */
const LEADING_PILLS = 1;

const STATE_STYLES = {
  today: { frame: 'bg-accent', glyph: 'surface-0', text: 'text-surface-0' },
  done: { frame: 'bg-surface-2', glyph: 'text-secondary', text: 'text-text-secondary' },
  upcoming: { frame: 'bg-surface-1 border border-surface-2', glyph: 'text-primary', text: 'text-text-primary' },
} as const;

/**
 * The cycle as a scrolling row of pills, so where you are in it is visible at
 * a glance rather than only stated as "Day 5 of 8" in text. Every day is
 * rendered — a 14-day cycle scrolls instead of being windowed down to 8.
 */
export function CycleStrip({ days, totalDays, onPickDay }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Position on first layout only. Re-scrolling on every render would yank
  // the strip back while the user is looking at another part of the cycle.
  const hasPositioned = useRef(false);
  const handleContentSizeChange = useCallback(() => {
    if (hasPositioned.current) return;
    const todayIndex = days.findIndex((day) => day.state === 'today');
    if (todayIndex < 0) return;
    hasPositioned.current = true;
    scrollRef.current?.scrollTo({
      x: Math.max(0, (todayIndex - LEADING_PILLS) * (PILL_WIDTH + PILL_GAP)),
      animated: false,
    });
  }, [days]);

  if (days.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={{ gap: PILL_GAP }}
    >
      {days.map((day) => {
        const s = STATE_STYLES[day.state];
        const position = `Day ${day.dayNumber} of ${totalDays}, ${day.label}`;

        return (
          <Pressable
            key={day.key}
            onLongPress={onPickDay ? () => onPickDay(day.index) : undefined}
            delayLongPress={350}
            disabled={!onPickDay}
            className={`${s.frame} rounded-lg items-center justify-center`}
            style={{ width: PILL_WIDTH, height: PILL_HEIGHT, gap: 4 }}
            accessibilityRole={onPickDay ? 'button' : undefined}
            accessibilityLabel={
              day.state === 'today'
                ? `${position}. Today.`
                : `${position}. ${day.state === 'done' ? 'Done' : 'Upcoming'}.${
                    onPickDay ? ' Long press to make it today.' : ''
                  }`
            }
          >
            <Icon name={day.glyph} size={20} color={s.glyph} />
            <Text className={`${s.text} ${textRoles.captionBold}`}>{day.dayNumber}</Text>

            {/* Done days carry a check rather than just dimming — a dimmed
                pill and an upcoming one were nearly the same colour. */}
            {day.state === 'done' && (
              <View
                className="absolute bg-success items-center justify-center rounded-full"
                style={{ top: 4, right: 4, width: 12, height: 12 }}
              >
                <Icon name="check" size={8} color="surface-0" />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
