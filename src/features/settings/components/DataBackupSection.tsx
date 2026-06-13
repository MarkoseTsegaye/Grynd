import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { colors } from '../../../shared/theme/colors';
import { textRoles } from '../../../shared/theme/typography';
import { useDataBackup } from '../hooks/useDataBackup';

export function DataBackupSection() {
  const { isExporting, isImporting, handleExport, handleImport } = useDataBackup();
  const isBusy = isExporting || isImporting;

  return (
    <>
      <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>Data</Text>

      <TouchableOpacity
        className={`bg-surface-1 rounded-lg px-4 py-4 mb-3 flex-row items-center ${isBusy ? 'opacity-50' : ''}`}
        onPress={() => void handleExport()}
        disabled={isBusy}
        accessibilityLabel="Export data"
        accessibilityState={{ disabled: isBusy, busy: isExporting }}
        activeOpacity={0.7}
      >
        <View className="flex-1 mr-3">
          <Text className={`text-text-primary ${textRoles.cardTitle}`}>Export data</Text>
          <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
            Save all splits, exercises, history, and settings to a file
          </Text>
        </View>
        {isExporting ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Icon name="share" size={20} color="text-secondary" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className={`bg-surface-1 rounded-lg px-4 py-4 mb-8 flex-row items-center ${isBusy ? 'opacity-50' : ''}`}
        onPress={() => void handleImport()}
        disabled={isBusy}
        accessibilityLabel="Import data"
        accessibilityState={{ disabled: isBusy, busy: isImporting }}
        activeOpacity={0.7}
      >
        <View className="flex-1 mr-3">
          <Text className={`text-text-primary ${textRoles.cardTitle}`}>Import data</Text>
          <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
            Replace local data with a Grynd backup file
          </Text>
        </View>
        {isImporting ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Icon name="download" size={20} color="text-secondary" />
        )}
      </TouchableOpacity>
    </>
  );
}
