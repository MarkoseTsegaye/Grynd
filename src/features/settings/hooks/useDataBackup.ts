import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
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

const isWeb = Platform.OS === 'web';

/**
 * Web can't reach expo-file-system (`cacheDirectory` is null), expo-sharing
 * (`isAvailableAsync()` is false), or `Alert.alert` prompts (buttons no-op).
 * Fall back to a hidden `<a download>` for export, a `<input type=file>` for
 * import, and `window.confirm`/`window.alert` for the messaging.
 */
function webDownloadJson(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function webPickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    let settled = false;
    input.addEventListener('change', () => {
      settled = true;
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    // Cancel isn't a real event; fall back so the promise doesn't leak if the
    // user closes the picker. The `focus` handler fires when the dialog closes.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!settled) {
          resolve(null);
          input.remove();
        }
      }, 300);
    };
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

function notify(title: string, message?: string): void {
  if (isWeb) {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function confirmDestructive(title: string, message: string): Promise<boolean> {
  if (isWeb) {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Import', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
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
      const contents = JSON.stringify(backup, null, 2);

      if (isWeb) {
        webDownloadJson(filename, contents);
        notify('Export complete', 'Your backup file was downloaded.');
        return;
      }

      if (!cacheDirectory) {
        throw new Error('Cache directory unavailable');
      }

      const fileUri = `${cacheDirectory}${filename}`;
      await writeAsStringAsync(fileUri, contents);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        notify('Export failed', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });
      notify('Export complete', 'Your backup file is ready to save or share.');
    } catch {
      notify('Export failed', 'Could not create backup file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, isImporting]);

  const handleImport = useCallback(async () => {
    if (isExporting || isImporting) return;

    try {
      let raw: string;

      if (isWeb) {
        const file = await webPickJsonFile();
        if (!file) return;
        raw = await file.text();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        raw = await readAsStringAsync(result.assets[0].uri);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        notify('Import failed', 'The selected file is not valid JSON.');
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.ok) {
        notify('Import failed', validation.error);
        return;
      }

      const confirmed = await confirmDestructive(
        'Import data?',
        'This will replace all splits, exercises, history, and settings on this device. Any workout in progress will be discarded.',
      );
      if (!confirmed) return;

      setIsImporting(true);
      try {
        await importBackup(validation.backup);
        await reloadStores();
        notify('Import complete', 'Your data has been restored.');
      } catch {
        notify(
          'Import failed',
          'Could not fully restore the backup. Some data may have been partially updated — try importing again.',
        );
      } finally {
        setIsImporting(false);
      }
    } catch {
      notify('Import failed', 'Could not read the selected file.');
    }
  }, [isExporting, isImporting, reloadStores]);

  return {
    isExporting,
    isImporting,
    handleExport,
    handleImport,
  };
}
