import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { exportBackup, importBackup, validateBackup } from '../../../storage/backup';
import { useSplitsStore } from '../../splits';
import { useCycleStore } from '../../splits/store/cycleStore';
import { useHistoryStore } from '../../history/store/historyStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { useWorkoutStore } from '../../workout/store/workoutStore';

function getBackupFilename(exportedAt: string): string {
  const dateStr = exportedAt.slice(0, 10);
  return `grynd-backup-${dateStr}.json`;
}

export function useDataBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = useSplitsStore((state) => state.loadData);
  const loadSessions = useHistoryStore((state) => state.loadSessions);
  const loadCycle = useCycleStore((state) => state.loadCycle);
  const loadPrefs = usePrefsStore((state) => state.loadPrefs);

  const reloadStores = useCallback(async () => {
    useWorkoutStore.setState({ session: null, currentExerciseIndex: 0 });
    await Promise.all([loadData(), loadSessions(), loadCycle(), loadPrefs()]);
  }, [loadData, loadSessions, loadCycle, loadPrefs]);

  const handleExport = useCallback(async () => {
    if (isExporting || isImporting) return;

    setIsExporting(true);
    try {
      const backup = await exportBackup();
      const filename = getBackupFilename(backup.exportedAt);

      if (!cacheDirectory) {
        throw new Error('Cache directory unavailable');
      }

      const fileUri = `${cacheDirectory}${filename}`;
      await writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Export failed', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });
      Alert.alert('Export complete', 'Your backup file is ready to save or share.');
    } catch {
      Alert.alert('Export failed', 'Could not create backup file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, isImporting]);

  const handleImport = useCallback(async () => {
    if (isExporting || isImporting) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const raw = await readAsStringAsync(result.assets[0].uri);
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        Alert.alert('Import failed', 'The selected file is not valid JSON.');
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.ok) {
        Alert.alert('Import failed', validation.error);
        return;
      }

      Alert.alert(
        'Import data?',
        'This will replace all splits, exercises, history, and settings on this device. Any workout in progress will be discarded.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setIsImporting(true);
                try {
                  await importBackup(validation.backup);
                  await reloadStores();
                  Alert.alert('Import complete', 'Your data has been restored.');
                } catch {
                  Alert.alert(
                    'Import failed',
                    'Could not fully restore the backup. Some data may have been partially updated — try importing again.',
                  );
                } finally {
                  setIsImporting(false);
                }
              })();
            },
          },
        ],
      );
    } catch {
      Alert.alert('Import failed', 'Could not read the selected file.');
    }
  }, [isExporting, isImporting, reloadStores]);

  return {
    isExporting,
    isImporting,
    handleExport,
    handleImport,
  };
}
