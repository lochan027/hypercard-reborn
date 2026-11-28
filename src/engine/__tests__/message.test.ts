/**
 * Unit tests for dispatchMessage and scriptHasHandler.
 * Requirements: 3.6, 3.7, 3.8, 3.9
 */

import { describe, it, expect } from 'vitest';
import { dispatchMessage, scriptHasHandler } from '../message';
import type { Stack, MessageTarget, HyperTalkMessage } from '../message';

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const RECT = { x: 0, y: 0, w: 100, h: 20 };

const METADATA = { createdAt: '2024-01-01T00:00:00Z', modifiedAt: '2024-01-01T00:00:00Z' };

function makeStack(overrides: Partial<{
  buttonScript: string | undefined;
  fieldScript: string | undefined;
  cardScript: string | undefined;
  bgScript: string | undefined;
  stackScript: string | undefined;
}>): Stack {
  const {
    buttonScript,
    fieldScript,
    cardScript,
    bgScript,
    stackScript,
  } = overrides;

  return {
    id: 's1',
    name: 'Test Stack',
    script: stackScript,
    metadata: METADATA,
    currentCardIndex: 0,
    backgrounds: [
      { id: 'bg1', name: 'Background 1', script: bgScript, fields: [] },
    ],
    cards: [
      {
        id: 'c1',
        name: 'Card 1',
        backgroundId: 'bg1',
        script: cardScript,
        buttons: [
          { id: 'b1', name: 'Button 1', rect: RECT, style: 'default', script: buttonScript },
        ],
        fields: [
          { id: 'f1', name: 'Field 1', rect: RECT, text: '', script: fieldScript },
        ],
      },
    ],
  };
}

const MSG: HyperTalkMessage = { handlerName: 'mouseUp', args: [] };
const BUTTON_TARGET: MessageTarget = { kind: 'button', cardId: 'c1', objectId: 'b1' };
const FIELD_TARGET: MessageTarget = { kind: 'field', cardId: 'c1', objectId: 'f1' };

// ---------------------------------------------------------------------------
// scriptHasHandler
// ---------------------------------------------------------------------------

describe('scriptHasHandler', () => {
  it('returns true when the exact handler is present', () => {
    expect(scriptHasHandler('on mouseUp\nend mouseUp', 'mouseUp')).toBe(true);
  });

  it('returns false when the handler is absent', () => {
    expect(scriptHasHandler('on mouseDown\nend mouseDown', 'mouseUp')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(scriptHasHandler('ON MOUSEUP\nend mouseUp', 'mouseUp')).toBe(true);
    expect(scriptHasHandler('on mouseup\nend mouseup', 'MOUSEUP')).toBe(true);
  });

  it('does not match a handler whose name starts with the target name', () => {
    expect(scriptHasHandler('on mouseUpAndOver\nend mouseUpAndOver', 'mouseUp')).toBe(false);
  });

  it('returns false for an empty script', () => {
    expect(scriptHasHandler('', 'mouseUp')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler at each level in isolation
// ---------------------------------------------------------------------------

describe('dispatchMessage — handler at object level', () => {
  it('button script handles → handledBy: button', () => {
    const stack = makeStack({ buttonScript: 'on mouseUp\nend mouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'button' });
  });

  it('field script handles → handledBy: field', () => {
    const stack = makeStack({ fieldScript: 'on mouseUp\nend mouseUp' });
    const result = dispatchMessage(FIELD_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'field' });
  });

  it('card script handles (no object script) → handledBy: card', () => {
    const stack = makeStack({ cardScript: 'on mouseUp\nend mouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'card' });
  });

  it('background script handles (no object or card script) → handledBy: background', () => {
    const stack = makeStack({ bgScript: 'on mouseUp\nend mouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'background' });
  });

  it('stack script handles (nothing below) → handledBy: stack', () => {
    const stack = makeStack({ stackScript: 'on mouseUp\nend mouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'stack' });
  });
});

// ---------------------------------------------------------------------------
// Bubbling order: lower level takes precedence over higher
// ---------------------------------------------------------------------------

describe('dispatchMessage — bubbling order', () => {
  it('button handler shadows card handler', () => {
    const stack = makeStack({
      buttonScript: 'on mouseUp\nend mouseUp',
      cardScript: 'on mouseUp\nend mouseUp',
    });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result.handledBy).toBe('button');
  });

  it('card handler shadows background handler', () => {
    const stack = makeStack({
      cardScript: 'on mouseUp\nend mouseUp',
      bgScript: 'on mouseUp\nend mouseUp',
    });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result.handledBy).toBe('card');
  });

  it('background handler shadows stack handler', () => {
    const stack = makeStack({
      bgScript: 'on mouseUp\nend mouseUp',
      stackScript: 'on mouseUp\nend mouseUp',
    });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result.handledBy).toBe('background');
  });
});

// ---------------------------------------------------------------------------
// No handler at any level (Requirement 3.6)
// ---------------------------------------------------------------------------

describe('dispatchMessage — no handler anywhere', () => {
  it('returns handled: false, handledBy: none when no script has the handler', () => {
    const stack = makeStack({});
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: false, handlerName: 'mouseUp', handledBy: 'none' });
  });

  it('returns none when scripts exist but contain a different handler', () => {
    const stack = makeStack({
      buttonScript: 'on mouseDown\nend mouseDown',
      cardScript: 'on mouseDown\nend mouseDown',
    });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: false, handlerName: 'mouseUp', handledBy: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Unknown cardId (Requirement 3.7)
// ---------------------------------------------------------------------------

describe('dispatchMessage — unknown cardId', () => {
  it('returns handled: false when cardId does not exist', () => {
    const stack = makeStack({ stackScript: 'on mouseUp\nend mouseUp' });
    const target: MessageTarget = { kind: 'button', cardId: 'no-such-card', objectId: 'b1' };
    const result = dispatchMessage(target, MSG, stack);
    expect(result).toEqual({ handled: false, handlerName: 'mouseUp', handledBy: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Unknown objectId (Requirement 3.8)
// ---------------------------------------------------------------------------

describe('dispatchMessage — unknown objectId', () => {
  it('returns handled: false when button objectId does not exist on the card', () => {
    const stack = makeStack({ stackScript: 'on mouseUp\nend mouseUp' });
    const target: MessageTarget = { kind: 'button', cardId: 'c1', objectId: 'no-such-button' };
    const result = dispatchMessage(target, MSG, stack);
    expect(result).toEqual({ handled: false, handlerName: 'mouseUp', handledBy: 'none' });
  });

  it('returns handled: false when field objectId does not exist on the card', () => {
    const stack = makeStack({ stackScript: 'on mouseUp\nend mouseUp' });
    const target: MessageTarget = { kind: 'field', cardId: 'c1', objectId: 'no-such-field' };
    const result = dispatchMessage(target, MSG, stack);
    expect(result).toEqual({ handled: false, handlerName: 'mouseUp', handledBy: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Case-insensitive handler matching (Requirement 3.9)
// ---------------------------------------------------------------------------

describe('dispatchMessage — case-insensitive matching', () => {
  it('matches ON MOUSEUP in script against message mouseUp', () => {
    const stack = makeStack({ buttonScript: 'ON MOUSEUP\nend mouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'button' });
  });

  it('matches on mouseup in script against message MOUSEUP', () => {
    const stack = makeStack({ buttonScript: 'on mouseup\nend mouseup' });
    const msgUpper: HyperTalkMessage = { handlerName: 'MOUSEUP', args: [] };
    const result = dispatchMessage(BUTTON_TARGET, msgUpper, stack);
    expect(result).toEqual({ handled: true, handlerName: 'MOUSEUP', handledBy: 'button' });
  });

  it('matches mixed-case handler name in card script', () => {
    const stack = makeStack({ cardScript: 'On MouseUp\nend MouseUp' });
    const result = dispatchMessage(BUTTON_TARGET, MSG, stack);
    expect(result).toEqual({ handled: true, handlerName: 'mouseUp', handledBy: 'card' });
  });
});
