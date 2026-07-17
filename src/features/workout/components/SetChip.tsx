import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatSetWeightDisplay } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import type { LoggedSet } from '../types';

interface Props {
  setNumber: number;
  set: LoggedSet;
  onDelete: () => void;
}

function EffortBadge({ effort }: { effort: NonNullable<LoggedSet['effort']> }) {
  const hasFail = effort.toFailure;
  const hasRpe = effort.rpe !== undefined;
  if (!hasFail && !hasRpe) return null;

  let label = '';
  if (hasFail && hasRpe) label = `FAIL · RPE ${effort.rpe}`;
  else if (hasFail) label = 'FAIL';
  else label = `RPE ${effort.rpe}`;

  const isDanger = hasFail;
  return (
    <View className={`rounded-md px-1.5 py-0.5 ${isDanger ? 'bg-danger/10' : 'bg-surface-2'}`}>
      <Text className={`${textRoles.caption} ${isDanger ? 'text-danger' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </View>
  );
}

export function SetChip({ setNumber, set, onDelete }: Props) {
  const { weightUnit } = usePrefsStore();
  const { weightText, unitLabel } = formatSetWeightDisplay(set, weightUnit);
  const weightAccessibility = unitLabel ? `${weightText} ${unitLabel}` : weightText;

  return (
    <TouchableOpacity
      className="bg-surface-2 rounded px-3 py-2 mr-2 mb-2 flex-row items-center gap-2"
      onPress={onDelete}
      accessibilityLabel={`Set ${setNumber}, ${weightAccessibility} × ${set.reps} reps — tap to delete`}
      activeOpacity={0.6}
    >
      <View className="flex-row items-center flex-wrap gap-1">
        <Text className={`text-text-secondary ${textRoles.metric}`}>Set {setNumber} — </Text>
        <Text className={`text-text-primary ${textRoles.metric}`}>{weightText}</Text>
        {unitLabel ? (
          <Text className={`text-text-secondary ${textRoles.metric}`}> {unitLabel} × </Text>
        ) : (
          <Text className={`text-text-secondary ${textRoles.metric}`}> × </Text>
        )}
        <Text className={`text-text-primary ${textRoles.metric}`}>{set.reps}</Text>
        <Text className={`text-text-secondary ${textRoles.metric}`}> reps</Text>
        {set.effort && <EffortBadge effort={set.effort} />}
        {set.notes ? (
          <View className="rounded-md px-1.5 py-0.5 bg-surface-1 max-w-[140px]">
            <Text className={`text-text-secondary ${textRoles.caption}`} numberOfLines={1}>
              {set.notes}
            </Text>
          </View>
        ) : null}
      </View>
      <Icon name="close-circle" size={16} color="danger" />
    </TouchableOpacity>
  );
}
