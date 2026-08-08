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

/**
 * Read a File as text via FileReader instead of Blob.text(). Blob.text() is
 * modern (Safari 14+) and has been observed to hang indefinitely inside iOS
 * PWAs without resolving or rejecting — freezing the whole import flow with
 * no error to catch. FileReader is older, universally supported, and reports
 * failure through onerror.
 *
 * A 10-second timeout guards against a hang so an unexpected freeze surfaces
 * as a visible error rather than another silent stall.
 */
function webReadFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeoutId = window.setTimeout(() => {
      try {
        reader.abort();
      } catch {
        /* empty */
      }
      reject(new Error('Timed out reading file after 10 seconds.'));
    }, 10_000);
    reader.addEventListener('load', () => {
      window.clearTimeout(timeoutId);
      resolve(String(reader.result ?? ''));
    });
    reader.addEventListener('error', () => {
      window.clearTimeout(timeoutId);
      reject(reader.error ?? new Error('FileReader failed'));
    });
    reader.readAsText(file);
  });
}

function webPickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // iOS Safari refuses to open the picker for inputs with `display: none`
    // (or any input outside the layout tree). Position it off-screen instead
    // so the layout engine still considers it interactable.
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    let settled = false;
    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => {
      settle(input.files?.[0] ?? null);
    });
    // The `change` event is not reliably fired for file inputs inside iOS
    // standalone PWAs — the picker opens, the user selects a file, the picker
    // closes, and the handler simply never runs. When window focus returns,
    // peek at input.files anyway: on iOS PWA the File object is still attached
    // to the input even when the event fires. Only fall back to `null` (real
    // cancel) if input.files is genuinely empty after focus returns.
    const onFocus = () => {
      window.setTimeout(() => {
        settle(input.files?.[0] ?? null);
      }, 500);
    };
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * iOS Safari — and every iOS browser, including installed PWAs — silently
 * suppresses window.alert / window.confirm / window.prompt for the lifetime of
 * a page that has ever called history.pushState. Expo Router calls pushState
 * on every navigation, so these dialogs never appear on our web build.
 * confirm() returns false without asking; alert() does nothing at all.
 *
 * We render a small DOM overlay instead so the dialogs are real elements the
 * browser can't hide. Kept in plain DOM (not React) so the hook stays
 * self-contained and callers don't need modal state or extra JSX.
 */
type WebDialogButton = {
  label: string;
  variant: 'default' | 'destructive';
  value: boolean;
};

function showWebDialog(
  title: string,
  message: string | undefined,
  buttons: WebDialogButton[],
): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      zIndex: '99999',
      fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#141414',
      color: '#F0EDE8',
      borderRadius: '14px',
      padding: '20px',
      maxWidth: '360px',
      width: '100%',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    });

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontSize: '17px',
      fontWeight: '700',
      marginBottom: message ? '8px' : '20px',
    });
    card.appendChild(titleEl);

    if (message) {
      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      Object.assign(messageEl.style, {
        fontSize: '14px',
        color: '#8A8580',
        lineHeight: '1.4',
        marginBottom: '20px',
      });
      card.appendChild(messageEl);
    }

    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      gap: '8px',
      justifyContent: 'flex-end',
    });

    let settled = false;
    const close = (value: boolean) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    };

    buttons.forEach((btn) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = btn.label;
      Object.assign(el.style, {
        padding: '10px 16px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        background: btn.variant === 'destructive' ? '#FF4C4C' : '#1F1F1F',
        color: btn.variant === 'destructive' ? '#0A0A0A' : '#F0EDE8',
      });
      el.addEventListener('click', () => close(btn.value));
      row.appendChild(el);
    });
    card.appendChild(row);

    overlay.addEventListener('click', (e) => {
      // Backdrop tap dismisses like Cancel.
      if (e.target === overlay) close(false);
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function notify(title: string, message?: string): void {
  if (isWeb) {
    void showWebDialog(title, message, [{ label: 'OK', variant: 'default', value: true }]);
  } else {
    Alert.alert(title, message);
  }
}

function confirmDestructive(title: string, message: string): Promise<boolean> {
  if (isWeb) {
    return showWebDialog(title, message, [
      { label: 'Cancel', variant: 'default', value: false },
      { label: 'Import', variant: 'destructive', value: true },
    ]);
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
        raw = await webReadFileAsText(file);
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
    } catch (err) {
      // Surface the actual error message so a silent hang or unexpected
      // failure produces a visible dialog instead of nothing.
      const detail = err instanceof Error ? err.message : String(err);
      notify('Import failed', detail || 'Could not read the selected file.');
    }
  }, [isExporting, isImporting, reloadStores]);

  return {
    isExporting,
    isImporting,
    handleExport,
    handleImport,
  };
}
