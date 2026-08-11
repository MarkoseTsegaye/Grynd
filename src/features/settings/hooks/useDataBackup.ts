import { useCallback, useState } from 'react';
import { showDialog } from '../../../shared/lib/dialog';
import * as DocumentPicker from 'expo-document-picker';
import {
  BACKUP_PICKER_TYPES,
  readPickedFile,
  saveBackupFile,
} from '../lib/backupFile';
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
      const outcome = await saveBackupFile(filename, JSON.stringify(backup, null, 2));

      showDialog(
        'Export complete',
        outcome === 'downloaded'
          ? `Saved ${filename} to your downloads.`
          : 'Your backup file is ready to save or share.',
      );
    } catch (err) {
      showDialog('Export failed', `Could not create backup file.\n\n${String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, isImporting]);

  const handleImport = useCallback(async () => {
    if (isExporting || isImporting) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: BACKUP_PICKER_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      let raw: string;
      try {
        raw = await readPickedFile(result.assets[0]);
      } catch (err) {
        showDialog(
          'Import failed',
          `Could not read "${result.assets[0].name ?? 'the selected file'}". If it is stored in iCloud, open it once in the Files app to download it, then try again.\n\n${String(err)}`,
        );
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        showDialog(
          'Import failed',
          `"${result.assets[0].name ?? 'The selected file'}" is not valid JSON. Pick the grynd-backup-*.json file produced by Export data.`,
        );
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.ok) {
        showDialog('Import failed', validation.error);
        return;
      }

      showDialog(
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
                  showDialog('Import complete', 'Your data has been restored.');
                } catch (err) {
                  showDialog(
                    'Import failed',
                    `Could not fully restore the backup. Some data may have been partially updated — try importing again.\n\n${String(err)}`,
                  );
                } finally {
                  setIsImporting(false);
                }
              })();
            },
          },
        ],
      );
    } catch (err) {
      showDialog('Import failed', `Could not open the file picker.\n\n${String(err)}`);
    }
  }, [isExporting, isImporting, reloadStores]);

  return {
    isExporting,
    isImporting,
    handleExport,
    handleImport,
  };
}
