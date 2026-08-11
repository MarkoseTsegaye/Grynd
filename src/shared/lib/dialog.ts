import { Alert, Platform } from 'react-native';
import { resolveDialogChoice, type DialogButton } from './dialogChoice';

export type { DialogButton, DialogButtonStyle } from './dialogChoice';

export interface DialogOptions {
  cancelable?: boolean;
  /** Native-only: fired when an Android dialog is dismissed without a choice. */
  onDismiss?: () => void;
}

/**
 * iOS Safari — and every iOS browser, including installed PWAs — silently
 * suppresses window.alert / window.confirm / window.prompt for the lifetime of
 * a page that has ever called history.pushState. Expo Router calls pushState on
 * every navigation, so those dialogs never appear on our web build: confirm()
 * returns false without asking and alert() does nothing at all.
 *
 * So web gets a real DOM overlay the browser cannot suppress. Kept in plain DOM
 * rather than React so callers stay one-line and need no modal state.
 */
function showWebDialog(title: string, message: string | undefined, actions: DialogButton[]): void {
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
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
      whiteSpace: 'pre-wrap',
    });
    card.appendChild(messageEl);
  }

  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  });

  let settled = false;
  const close = (onPress?: () => void) => {
    if (settled) return;
    settled = true;
    overlay.remove();
    onPress?.();
  };

  // Every action gets its own button, so a three-way choice stays three-way
  // instead of collapsing into OK/Cancel.
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.text;
    const destructive = action.style === 'destructive';
    Object.assign(button.style, {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      background: destructive ? '#FF4C4C' : '#1F1F1F',
      color: destructive ? '#0A0A0A' : '#F0EDE8',
    });
    button.addEventListener('click', () => close(action.onPress));
    row.appendChild(button);
  }
  card.appendChild(row);

  const { cancelButton } = resolveDialogChoice(actions);
  overlay.addEventListener('click', (event) => {
    // Backdrop tap dismisses like Cancel.
    if (event.target === overlay) close(cancelButton?.onPress);
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/**
 * Cross-platform replacement for `Alert.alert`, which react-native-web ships as
 * an empty function — every confirmation and error in the app was a no-op in the
 * PWA build. Keeps Alert.alert's signature so call sites swap one-for-one.
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

  const actions = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  showWebDialog(title, message, actions);
}
