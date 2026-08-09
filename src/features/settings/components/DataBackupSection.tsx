import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { colors } from '../../../shared/theme/colors';
import { textRoles } from '../../../shared/theme/typography';
import { useDataBackup } from '../hooks/useDataBackup';

export function DataBackupSection() {
  const { isExporting, isImporting, handleExport, handleImport, handleWebFile } =
    useDataBackup();
  const isBusy = isExporting || isImporting;

  const importRowContent = (
    <>
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
    </>
  );

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

      {Platform.OS === 'web' ? (
        // Real <label> wrapping a real <input type="file"> so iOS PWA treats
        // this as a first-class form control. No JavaScript .click(), no
        // hidden element triggered from a touch handler — the label IS the
        // button, tapping anywhere in it natively opens the file picker.
        // React Native Web's View renders as <div>, safe as label children.
        <label
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors['surface-1'],
            borderRadius: 8,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 16,
            paddingBottom: 16,
            marginBottom: 32,
            cursor: isBusy ? 'default' : 'pointer',
            opacity: isBusy ? 0.5 : 1,
          }}
          aria-label="Import data"
          aria-busy={isImporting}
          aria-disabled={isBusy}
        >
          <input
            type="file"
            accept="application/json,.json"
            disabled={isBusy}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              // Reset value so picking the same file again still fires change.
              e.currentTarget.value = '';
              if (file) void handleWebFile(file);
            }}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              opacity: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          />
          {importRowContent}
        </label>
      ) : (
        <TouchableOpacity
          className={`bg-surface-1 rounded-lg px-4 py-4 mb-8 flex-row items-center ${isBusy ? 'opacity-50' : ''}`}
          onPress={() => void handleImport()}
          disabled={isBusy}
          accessibilityLabel="Import data"
          accessibilityState={{ disabled: isBusy, busy: isImporting }}
          activeOpacity={0.7}
        >
          {importRowContent}
        </TouchableOpacity>
      )}
    </>
  );
}
