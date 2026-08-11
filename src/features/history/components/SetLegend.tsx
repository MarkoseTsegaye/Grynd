import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';

function Row({ chip, text }: { chip: React.ReactNode; text: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-1.5">
      <View style={{ width: 76 }} className="flex-row">
        {chip}
      </View>
      <Text className={`flex-1 text-text-secondary ${textRoles.caption}`}>{text}</Text>
    </View>
  );
}

function DeltaChip({ up, count }: { up: boolean; count: string }) {
  return (
    <View
      className={`flex-row items-center rounded-md pl-0.5 pr-1.5 py-0.5 ${up ? 'bg-success/15' : 'bg-danger/15'}`}
    >
      <Icon name={up ? 'menu-up' : 'menu-down'} size={14} color={up ? 'success' : 'danger'} />
      <Text
        className={`${textRoles.metricBold} ${up ? 'text-success' : 'text-danger'}`}
        style={{ fontSize: 12 }}
      >
        {count}
      </Text>
    </View>
  );
}

/** Explains the set-row shorthand once, so the dense rows don't need decoding. */
export function SetLegend() {
  return (
    <View className="rounded-lg bg-surface-1 px-4 py-3 mb-4">
      <Text className={`text-text-disabled ${textRoles.sectionLabel} mb-2`}>Reading a set</Text>

      <Row chip={<DeltaChip up count="3" />} text="Weight and reps both beat last session" />
      <Row chip={<DeltaChip up count="2" />} text="Net gain — traded reps for load, or the reverse" />
      <Row chip={<DeltaChip up count="1" />} text="One metric improved, the other held" />
      <Row chip={<DeltaChip up={false} count="2" />} text="Down versus last session" />
      <Row
        chip={
          <View className="rounded-md border border-danger/50 px-1.5 py-0.5">
            <Text className={`text-danger ${textRoles.caption}`} style={{ fontSize: 11 }}>
              FAILURE
            </Text>
          </View>
        }
        text="Taken to failure — intensity, not a missed target"
      />
      <Row
        chip={
          <Text className={`text-text-secondary ${textRoles.metric} pl-1`} style={{ fontSize: 12 }}>
            45+25
          </Text>
        }
        text="Plates loaded per side, behind the total weight"
      />
      <View className="flex-row items-center gap-2">
        <View style={{ width: 76 }} className="flex-row items-center gap-1.5 pl-1">
          <View className="rounded-full bg-text-disabled" style={{ width: 3, height: 3 }} />
          <Text className={`text-text-secondary ${textRoles.caption} italic`}>note</Text>
        </View>
        <Text className={`flex-1 text-text-secondary ${textRoles.caption}`}>
          Your free-text note on that set
        </Text>
      </View>
    </View>
  );
}
