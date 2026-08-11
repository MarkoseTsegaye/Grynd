export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
}

export interface DialogChoice {
  /** Runs when the browser confirm is accepted. */
  confirmButton: DialogButton;
  /** Runs when it is dismissed. */
  cancelButton: DialogButton;
  /** Extra actions a two-way confirm cannot offer. */
  unavailable: DialogButton[];
}

/**
 * Maps Alert-style buttons onto the browser's OK/Cancel confirm.
 *
 * Getting this backwards would fire a destructive action on dismiss, so the
 * cancel side is chosen explicitly: the button marked `cancel`, else the first.
 */
export function resolveDialogChoice(buttons: DialogButton[]): DialogChoice {
  const cancelButton = buttons.find((button) => button.style === 'cancel') ?? buttons[0];
  const confirmButton =
    [...buttons].reverse().find((button) => button !== cancelButton) ??
    buttons[buttons.length - 1];
  const unavailable = buttons.filter(
    (button) => button !== confirmButton && button !== cancelButton,
  );

  return { confirmButton, cancelButton, unavailable };
}

/**
 * `confirm` only labels its buttons OK/Cancel, so spell out what each maps to.
 */
export function buildConfirmText(body: string, choice: DialogChoice): string {
  const lines = [
    body,
    '',
    `OK → ${choice.confirmButton.text}`,
    `Cancel → ${choice.cancelButton.text}`,
  ];

  if (choice.unavailable.length > 0) {
    lines.push('', `Unavailable here: ${choice.unavailable.map((b) => b.text).join(', ')}`);
  }

  return lines.join('\n');
}

export function buildDialogBody(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}
