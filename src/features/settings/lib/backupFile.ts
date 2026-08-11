import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import type { DocumentPickerAsset } from 'expo-document-picker';

/**
 * Backup file I/O, split by platform.
 *
 * `expo-file-system` has no web implementation — on web its legacy module is a
 * shim whose `cacheDirectory` is null and which exposes no read/write methods.
 * Calling it there fails at runtime, which broke both export and import in the
 * PWA build. On web we use the browser directly instead: the document picker
 * already hands back a real `File`, and a download is just a blob URL.
 */

export type SaveOutcome = 'shared' | 'downloaded';

export async function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (asset.file) {
      return await asset.file.text();
    }
    // Fall back to the blob: URI the web picker creates.
    const response = await fetch(asset.uri);
    return await response.text();
  }

  return await readAsStringAsync(asset.uri);
}

export async function saveBackupFile(
  filename: string,
  contents: string,
): Promise<SaveOutcome> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(url);
    }
    return 'downloaded';
  }

  if (!cacheDirectory) {
    throw new Error('Cache directory unavailable');
  }

  const fileUri = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(fileUri, contents);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    UTI: 'public.json',
  });
  return 'shared';
}

/**
 * Types accepted by the picker. Native filters by UTI, where a backup that has
 * been through Files/iCloud/AirDrop often reports as `public.data` rather than
 * `public.json` — which greys the file out. Accept broadly and let
 * `validateBackup` reject on content.
 */
export const BACKUP_PICKER_TYPES = [
  'application/json',
  'public.json',
  'text/plain',
  '*/*',
];
