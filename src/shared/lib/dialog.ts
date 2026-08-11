import { Alert, Platform } from 'react-native';
import {
  buildConfirmText,
  buildDialogBody,
  resolveDialogChoice,
  type DialogButton,
} from './dialogChoice';

export type { DialogButton, DialogButtonStyle } from './dialogChoice';

export interface DialogOptions {
  cancelable?: boolean;
  /** Native-only: fired when an Android dialog is dismissed without a choice. */
  onDismiss?: () => void;
}

/**
 * Cross-platform replacement for `Alert.alert`.
 *
 * `react-native-web` ships `Alert.alert` as an empty function, so every
 * confirmation and error message in the app silently did nothing in the PWA
 * build — including the one gating a data import, which made importing look
 * broken with no error to show for it.
 *
 * Keeps Alert.alert's signature so call sites swap one-for-one. On web it maps
 * to the browser's own dialogs: a single-action message becomes `alert`, and a
 * choice becomes `confirm`.
 */
export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options?: DialogOptions,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const body = buildDialogBody(title, message);
  const actions = buttons ?? [];

  // Nothing to choose between — just deliver the message.
  if (actions.length <= 1) {
    globalThis.alert?.(body);
    actions[0]?.onPress?.();
    return;
  }

  const choice = resolveDialogChoice(actions);
  const confirmed = globalThis.confirm?.(buildConfirmText(body, choice));

  if (confirmed) {
    choice.confirmButton.onPress?.();
  } else {
    choice.cancelButton.onPress?.();
  }
}
