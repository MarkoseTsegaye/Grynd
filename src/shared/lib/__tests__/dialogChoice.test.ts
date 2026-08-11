import { describe, expect, it } from 'vitest';
import {
  buildConfirmText,
  buildDialogBody,
  resolveDialogChoice,
  type DialogButton,
} from '../dialogChoice';

const cancel: DialogButton = { text: 'Cancel', style: 'cancel' };
const importAction: DialogButton = { text: 'Import', style: 'destructive' };

describe('resolveDialogChoice', () => {
  it('maps the cancel-styled button to dismiss and the action to OK', () => {
    const choice = resolveDialogChoice([cancel, importAction]);
    expect(choice.cancelButton).toBe(cancel);
    expect(choice.confirmButton).toBe(importAction);
    expect(choice.unavailable).toEqual([]);
  });

  it('still maps correctly when the action comes first', () => {
    const choice = resolveDialogChoice([importAction, cancel]);
    expect(choice.cancelButton).toBe(cancel);
    expect(choice.confirmButton).toBe(importAction);
  });

  it('falls back to the first button as cancel when none is styled cancel', () => {
    const discard: DialogButton = { text: 'Discard', style: 'destructive' };
    const resume: DialogButton = { text: 'Resume' };
    const choice = resolveDialogChoice([discard, resume]);
    expect(choice.cancelButton).toBe(discard);
    expect(choice.confirmButton).toBe(resume);
  });

  it('never puts the same button on both sides', () => {
    const only: DialogButton[] = [cancel, cancel];
    const choice = resolveDialogChoice(only);
    expect(choice.confirmButton).toBe(choice.cancelButton);
  });

  it('reports extra actions a two-way confirm cannot offer', () => {
    const third: DialogButton = { text: 'Later' };
    const choice = resolveDialogChoice([cancel, third, importAction]);
    expect(choice.cancelButton).toBe(cancel);
    expect(choice.confirmButton).toBe(importAction);
    expect(choice.unavailable).toEqual([third]);
  });
});

describe('buildDialogBody', () => {
  it('joins title and message', () => {
    expect(buildDialogBody('Import data?', 'This replaces everything.')).toBe(
      'Import data?\n\nThis replaces everything.',
    );
  });

  it('uses the title alone when there is no message', () => {
    expect(buildDialogBody('Import data?')).toBe('Import data?');
  });
});

describe('buildConfirmText', () => {
  it('spells out which action each browser button triggers', () => {
    const choice = resolveDialogChoice([cancel, importAction]);
    expect(buildConfirmText('Import data?', choice)).toBe(
      'Import data?\n\nOK → Import\nCancel → Cancel',
    );
  });

  it('lists actions that cannot be offered', () => {
    const choice = resolveDialogChoice([cancel, { text: 'Later' }, importAction]);
    expect(buildConfirmText('Pick', choice)).toContain('Unavailable here: Later');
  });
});
