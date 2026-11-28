/**
 * Unit tests for the stack serialiser (stack-serialise.ts).
 *
 * Requirements: 6.3, 6.4
 *
 * Coverage:
 *  1. Invalid JSON strings → loadStack returns err with a parse-failure message
 *  2. Valid JSON but schema violations → loadStack returns err with a descriptive message
 *  3. Happy path → loadStack(saveStack(stack)) returns ok with a deeply equal value
 */
import { describe, it, expect } from 'vitest';
import { loadStack, saveStack } from '../stack-serialise';
import type { Stack } from '../stack-types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validMetadata = {
  createdAt: '2024-01-01T00:00:00.000Z',
  modifiedAt: '2024-01-01T00:00:00.000Z',
};

const validRect = { x: 0, y: 0, w: 100, h: 50 };

/** A fully valid stack used as the happy-path baseline. */
const validStack: Stack = {
  id: 'stack-1',
  name: 'Demo Stack',
  backgrounds: [
    {
      id: 'bg-1',
      name: 'Main Background',
      fields: [],
    },
  ],
  cards: [
    {
      id: 'card-1',
      name: 'Home',
      backgroundId: 'bg-1',
      buttons: [
        {
          id: 'btn-1',
          name: 'Click Me',
          rect: validRect,
          style: 'default',
        },
      ],
      fields: [
        {
          id: 'fld-1',
          name: 'Title',
          rect: validRect,
          text: 'Hello',
        },
      ],
    },
  ],
  currentCardIndex: 0,
  metadata: validMetadata,
};

// ---------------------------------------------------------------------------
// 1. Invalid JSON strings
// ---------------------------------------------------------------------------

describe('loadStack — invalid JSON', () => {
  it('rejects a non-JSON string', () => {
    const result = loadStack('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Error message should indicate a parse failure, not a schema violation.
      expect(result.error.message.toLowerCase()).toMatch(/invalid json|json/i);
    }
  });

  it('rejects an unclosed brace', () => {
    const result = loadStack('{unclosed');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message.toLowerCase()).toMatch(/invalid json|json/i);
    }
  });

  it('rejects an empty string', () => {
    const result = loadStack('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message.toLowerCase()).toMatch(/invalid json|json/i);
    }
  });

  it('rejects a bare number string', () => {
    // `JSON.parse('42')` succeeds but validates as a non-object Stack.
    const result = loadStack('42');
    expect(result.ok).toBe(false);
  });

  it('rejects a bare null string', () => {
    // `JSON.parse('null')` succeeds but validates as null, which is not an object.
    const result = loadStack('null');
    expect(result.ok).toBe(false);
  });

  it('rejects a bare array string', () => {
    const result = loadStack('[]');
    expect(result.ok).toBe(false);
  });

  it('rejects a string with trailing garbage after valid JSON', () => {
    const result = loadStack('{"id":"x"}garbage');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Valid JSON but schema violations
// ---------------------------------------------------------------------------

describe('loadStack — valid JSON with schema violations', () => {
  it('rejects when only id is present (most required fields missing)', () => {
    const result = loadStack('{"id":"x"}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // name, backgrounds, cards, currentCardIndex, or metadata should be mentioned
      expect(result.error.message).toBeTruthy();
    }
  });

  it('rejects when cards array is missing', () => {
    const { cards: _cards, ...noCards } = {
      id: 'stack-1',
      name: 'Test',
      backgrounds: [],
      cards: [],
      currentCardIndex: 0,
      metadata: validMetadata,
    };
    const result = loadStack(JSON.stringify(noCards));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/cards/i);
    }
  });

  it('rejects when backgrounds is missing', () => {
    const obj = {
      id: 'stack-1',
      name: 'Test',
      cards: [],
      currentCardIndex: 0,
      metadata: validMetadata,
    };
    const result = loadStack(JSON.stringify(obj));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/backgrounds/i);
    }
  });

  it('rejects when id is an empty string', () => {
    const obj = { ...validStack, id: '' };
    const result = loadStack(JSON.stringify(obj));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/id/i);
    }
  });

  it('rejects when name is missing', () => {
    const { name: _name, ...noName } = validStack;
    const result = loadStack(JSON.stringify(noName));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/name/i);
    }
  });

  it('rejects when metadata is missing', () => {
    const { metadata: _meta, ...noMeta } = validStack;
    const result = loadStack(JSON.stringify(noMeta));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/metadata/i);
    }
  });

  it('rejects when a card has a backgroundId that references no background', () => {
    const stackWithBrokenRef = {
      ...validStack,
      backgrounds: [{ id: 'bg-exists', name: 'Real BG', fields: [] }],
      cards: [
        {
          id: 'card-1',
          name: 'Home',
          backgroundId: 'bg-does-not-exist',  // ← broken reference
          buttons: [],
          fields: [],
        },
      ],
    };
    const result = loadStack(JSON.stringify(stackWithBrokenRef));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Message should mention the bad backgroundId
      expect(result.error.message).toMatch(/backgroundId|background/i);
    }
  });

  it('rejects with a message that names the broken backgroundId value', () => {
    const stackWithBrokenRef = {
      ...validStack,
      backgrounds: [],
      cards: [
        {
          id: 'card-1',
          name: 'Home',
          backgroundId: 'ghost-bg',
          buttons: [],
          fields: [],
        },
      ],
    };
    const result = loadStack(JSON.stringify(stackWithBrokenRef));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The error should contain the offending id or at least mention backgroundId
      expect(result.error.message).toMatch(/ghost-bg|backgroundId|background/i);
    }
  });

  it('rejects when currentCardIndex is 999 on a 1-card stack', () => {
    const obj = { ...validStack, currentCardIndex: 999 };
    const result = loadStack(JSON.stringify(obj));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/currentCardIndex/i);
    }
  });

  it('rejects when currentCardIndex is negative', () => {
    const obj = { ...validStack, currentCardIndex: -1 };
    const result = loadStack(JSON.stringify(obj));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/currentCardIndex/i);
    }
  });

  it('rejects when a button inside a card has an invalid style', () => {
    const stackWithBadButton = {
      ...validStack,
      cards: [
        {
          ...validStack.cards[0],
          buttons: [{ id: 'btn-1', name: 'Go', rect: validRect, style: 'neon' }],
        },
      ],
    };
    const result = loadStack(JSON.stringify(stackWithBadButton));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/style/i);
    }
  });

  it('rejects when a field rect has a negative width', () => {
    const stackWithBadRect = {
      ...validStack,
      cards: [
        {
          ...validStack.cards[0],
          fields: [{ id: 'fld-1', name: 'Title', rect: { x: 0, y: 0, w: -5, h: 20 }, text: 'Hi' }],
        },
      ],
    };
    const result = loadStack(JSON.stringify(stackWithBadRect));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/w/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Happy path: saveStack → loadStack round-trip
// ---------------------------------------------------------------------------

describe('loadStack — happy path', () => {
  it('round-trips the valid baseline stack', () => {
    const json = saveStack(validStack);
    expect(typeof json).toBe('string');

    const result = loadStack(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(validStack);
    }
  });

  it('produces a JSON string from saveStack', () => {
    const json = saveStack(validStack);
    // Must be valid JSON
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips a stack with optional script fields', () => {
    const stackWithScripts: Stack = {
      ...validStack,
      script: 'on idle\n  -- stack script\nend idle',
      cards: [
        {
          ...validStack.cards[0]!,
          script: 'on mouseUp\n  go next card\nend mouseUp',
          buttons: [
            {
              ...validStack.cards[0]!.buttons[0]!,
              script: 'on mouseUp\n  answer "hi"\nend mouseUp',
            },
          ],
        },
      ],
    };

    const result = loadStack(saveStack(stackWithScripts));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(stackWithScripts);
    }
  });

  it('round-trips a minimal blank stack (no backgrounds, no cards)', () => {
    const blankStack: Stack = {
      id: 'blank',
      name: 'Blank Stack',
      backgrounds: [],
      cards: [],
      currentCardIndex: 0,
      metadata: validMetadata,
    };

    const result = loadStack(saveStack(blankStack));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(blankStack);
    }
  });

  it('preserves nested field text through the round-trip', () => {
    const result = loadStack(saveStack(validStack));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cards[0]?.fields[0]?.text).toBe('Hello');
    }
  });

  it('preserves currentCardIndex through the round-trip', () => {
    const result = loadStack(saveStack(validStack));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currentCardIndex).toBe(0);
    }
  });
});
