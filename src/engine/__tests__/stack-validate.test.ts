/**
 * Unit tests for the structural validator (stack-validate.ts).
 *
 * Requirements: 2.2, 2.3, 2.4
 *
 * Coverage:
 *  1. Non-object inputs to validateStack → err
 *  2. Missing required top-level fields → err naming the field
 *  3. currentCardIndex out-of-bounds edge cases
 *  4. Nested Rect validation errors deep inside the stack
 */
import { describe, it, expect } from 'vitest';
import {
  validateStack,
  validateRect,
  validateButton,
  validateField,
  validateBackgroundField,
  validateBackground,
  validateCard,
  validateMetadata,
} from '../stack-validate';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validRect = { x: 0, y: 0, w: 100, h: 50 };

const validMetadata = {
  createdAt: '2024-01-01T00:00:00.000Z',
  modifiedAt: '2024-01-01T00:00:00.000Z',
};

const validBackground = {
  id: 'bg-1',
  name: 'Main Background',
  fields: [],
};

const validButton = {
  id: 'btn-1',
  name: 'Click Me',
  rect: validRect,
  style: 'default' as const,
};

const validField = {
  id: 'fld-1',
  name: 'Title',
  rect: validRect,
  text: 'Hello',
};

const validCard = {
  id: 'card-1',
  name: 'Home',
  backgroundId: 'bg-1',
  buttons: [validButton],
  fields: [validField],
};

/** A fully valid stack object used as the baseline. */
const validStack = {
  id: 'stack-1',
  name: 'Demo Stack',
  backgrounds: [validBackground],
  cards: [validCard],
  currentCardIndex: 0,
  metadata: validMetadata,
};

// ---------------------------------------------------------------------------
// 1. Non-object inputs
// ---------------------------------------------------------------------------

describe('validateStack — non-object inputs', () => {
  it('rejects null', () => {
    const result = validateStack(null);
    expect(result.ok).toBe(false);
  });

  it('rejects a string', () => {
    const result = validateStack('not a stack');
    expect(result.ok).toBe(false);
  });

  it('rejects a number', () => {
    const result = validateStack(42);
    expect(result.ok).toBe(false);
  });

  it('rejects an array', () => {
    const result = validateStack([]);
    expect(result.ok).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validateStack(undefined);
    expect(result.ok).toBe(false);
  });

  it('rejects a boolean', () => {
    const result = validateStack(true);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Missing required fields
// ---------------------------------------------------------------------------

describe('validateStack — missing required fields', () => {
  it('rejects when id is missing', () => {
    const { id: _id, ...noId } = validStack;
    const result = validateStack(noId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/id/i);
  });

  it('rejects when id is an empty string', () => {
    const result = validateStack({ ...validStack, id: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/id/i);
  });

  it('rejects when name is missing', () => {
    const { name: _name, ...noName } = validStack;
    const result = validateStack(noName);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/name/i);
  });

  it('rejects when name is an empty string', () => {
    const result = validateStack({ ...validStack, name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/name/i);
  });

  it('rejects when backgrounds is missing', () => {
    const { backgrounds: _bgs, ...noBgs } = validStack;
    const result = validateStack(noBgs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/backgrounds/i);
  });

  it('rejects when backgrounds is not an array', () => {
    const result = validateStack({ ...validStack, backgrounds: 'not an array' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/backgrounds/i);
  });

  it('rejects when cards is missing', () => {
    const { cards: _cards, ...noCards } = validStack;
    const result = validateStack(noCards);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/cards/i);
  });

  it('rejects when cards is not an array', () => {
    const result = validateStack({ ...validStack, cards: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/cards/i);
  });

  it('rejects when currentCardIndex is missing', () => {
    const { currentCardIndex: _idx, ...noIdx } = validStack;
    const result = validateStack(noIdx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/currentCardIndex/i);
  });

  it('rejects when metadata is missing', () => {
    const { metadata: _meta, ...noMeta } = validStack;
    const result = validateStack(noMeta);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/metadata/i);
  });

  it('rejects when metadata is not an object', () => {
    const result = validateStack({ ...validStack, metadata: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/metadata/i);
  });

  it('rejects when metadata.createdAt is missing', () => {
    const result = validateStack({
      ...validStack,
      metadata: { modifiedAt: '2024-01-01T00:00:00.000Z' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/createdAt/i);
  });

  it('rejects when metadata.modifiedAt is missing', () => {
    const result = validateStack({
      ...validStack,
      metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/modifiedAt/i);
  });
});

// ---------------------------------------------------------------------------
// 3. currentCardIndex bounds
// ---------------------------------------------------------------------------

describe('validateStack — currentCardIndex bounds', () => {
  it('rejects currentCardIndex = -1', () => {
    const result = validateStack({ ...validStack, currentCardIndex: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/currentCardIndex/i);
  });

  it('rejects currentCardIndex = cards.length (one past the end)', () => {
    // validStack has 1 card, so index 1 is out of bounds
    const result = validateStack({ ...validStack, currentCardIndex: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/currentCardIndex/i);
  });

  it('rejects currentCardIndex = cards.length on a multi-card stack', () => {
    const card2 = { ...validCard, id: 'card-2', name: 'Second' };
    const result = validateStack({
      ...validStack,
      cards: [validCard, card2],
      currentCardIndex: 2, // length is 2, so 2 is out of bounds
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/currentCardIndex/i);
  });

  it('rejects currentCardIndex = -2', () => {
    const result = validateStack({ ...validStack, currentCardIndex: -2 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-integer currentCardIndex', () => {
    const result = validateStack({ ...validStack, currentCardIndex: 0.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/currentCardIndex/i);
  });

  it('rejects a NaN currentCardIndex', () => {
    const result = validateStack({ ...validStack, currentCardIndex: NaN });
    expect(result.ok).toBe(false);
  });

  it('accepts currentCardIndex = 0 on an empty cards array (blank stack)', () => {
    const blankStack = {
      id: 'stack-blank',
      name: 'Blank',
      backgrounds: [],
      cards: [],
      currentCardIndex: 0,
      metadata: validMetadata,
    };
    const result = validateStack(blankStack);
    expect(result.ok).toBe(true);
  });

  it('accepts currentCardIndex = 0 on a one-card stack', () => {
    const result = validateStack({ ...validStack, currentCardIndex: 0 });
    expect(result.ok).toBe(true);
  });

  it('accepts the last valid index on a multi-card stack', () => {
    const card2 = { ...validCard, id: 'card-2', name: 'Second' };
    const result = validateStack({
      ...validStack,
      cards: [validCard, card2],
      currentCardIndex: 1, // 0-based last index for 2 cards
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Nested validation errors (deep inside the stack structure)
// ---------------------------------------------------------------------------

describe('validateStack — nested Rect validation errors', () => {
  it('rejects a stack whose button has rect.w = -5', () => {
    const badButton = { ...validButton, rect: { ...validRect, w: -5 } };
    const cardWithBadButton = { ...validCard, buttons: [badButton] };
    const result = validateStack({ ...validStack, cards: [cardWithBadButton] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/w/i);
  });

  it('rejects a stack whose button has rect.h = -1', () => {
    const badButton = { ...validButton, rect: { ...validRect, h: -1 } };
    const cardWithBadButton = { ...validCard, buttons: [badButton] };
    const result = validateStack({ ...validStack, cards: [cardWithBadButton] });
    expect(result.ok).toBe(false);
  });

  it('rejects a stack whose field has a non-integer rect.x', () => {
    const badField = { ...validField, rect: { ...validRect, x: 1.5 } };
    const cardWithBadField = { ...validCard, fields: [badField] };
    const result = validateStack({ ...validStack, cards: [cardWithBadField] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/x/i);
  });

  it('rejects a stack whose field has rect.y = Infinity', () => {
    const badField = { ...validField, rect: { ...validRect, y: Infinity } };
    const cardWithBadField = { ...validCard, fields: [badField] };
    const result = validateStack({ ...validStack, cards: [cardWithBadField] });
    expect(result.ok).toBe(false);
  });

  it('rejects a stack whose background field has rect.w = -10', () => {
    const badBgField = { id: 'bgf-1', name: 'BG Field', rect: { ...validRect, w: -10 } };
    const bgWithBadField = { ...validBackground, fields: [badBgField] };
    const result = validateStack({ ...validStack, backgrounds: [bgWithBadField] });
    expect(result.ok).toBe(false);
  });

  it('rejects a stack whose background field rect has NaN coordinate', () => {
    const badBgField = { id: 'bgf-1', name: 'BG Field', rect: { x: NaN, y: 0, w: 10, h: 10 } };
    const bgWithBadField = { ...validBackground, fields: [badBgField] };
    const result = validateStack({ ...validStack, backgrounds: [bgWithBadField] });
    expect(result.ok).toBe(false);
  });

  it('rejects a stack with a card button missing its style', () => {
    const { style: _s, ...btnNoStyle } = validButton;
    const cardWithBadButton = { ...validCard, buttons: [btnNoStyle] };
    const result = validateStack({ ...validStack, cards: [cardWithBadButton] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/style/i);
  });

  it('rejects a stack with a card button whose style is invalid', () => {
    const badButton = { ...validButton, style: 'fancy' };
    const cardWithBadButton = { ...validCard, buttons: [badButton] };
    const result = validateStack({ ...validStack, cards: [cardWithBadButton] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/style/i);
  });

  it('rejects a stack with a card field missing text', () => {
    const { text: _t, ...fieldNoText } = validField;
    const cardWithBadField = { ...validCard, fields: [fieldNoText] };
    const result = validateStack({ ...validStack, cards: [cardWithBadField] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/text/i);
  });
});

// ---------------------------------------------------------------------------
// 5. Valid stack — baseline acceptance
// ---------------------------------------------------------------------------

describe('validateStack — valid inputs', () => {
  it('accepts the baseline valid stack', () => {
    const result = validateStack(validStack);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('stack-1');
      expect(result.value.cards).toHaveLength(1);
    }
  });

  it('accepts a stack with an optional script field', () => {
    const result = validateStack({ ...validStack, script: 'on idle\n  -- nothing\nend idle' });
    expect(result.ok).toBe(true);
  });

  it('rejects when script is not a string', () => {
    const result = validateStack({ ...validStack, script: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/script/i);
  });

  it('accepts a stack with zero backgrounds and zero cards', () => {
    const result = validateStack({
      id: 'stack-empty',
      name: 'Empty',
      backgrounds: [],
      cards: [],
      currentCardIndex: 0,
      metadata: validMetadata,
    });
    expect(result.ok).toBe(true);
  });

  it('round-trips nested values correctly on a valid stack', () => {
    const result = validateStack(validStack);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cards[0]?.buttons[0]?.rect).toEqual(validRect);
      expect(result.value.cards[0]?.fields[0]?.text).toBe('Hello');
      expect(result.value.backgrounds[0]?.id).toBe('bg-1');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Individual validator smoke tests (validateRect, validateButton, etc.)
// ---------------------------------------------------------------------------

describe('validateRect', () => {
  it('accepts a valid rect', () => {
    expect(validateRect({ x: 0, y: 0, w: 10, h: 20 }).ok).toBe(true);
  });
  it('rejects negative w', () => {
    expect(validateRect({ x: 0, y: 0, w: -1, h: 20 }).ok).toBe(false);
  });
  it('rejects negative h', () => {
    expect(validateRect({ x: 0, y: 0, w: 10, h: -1 }).ok).toBe(false);
  });
  it('accepts zero w and h', () => {
    expect(validateRect({ x: 0, y: 0, w: 0, h: 0 }).ok).toBe(true);
  });
  it('rejects float coordinates', () => {
    expect(validateRect({ x: 1.5, y: 0, w: 10, h: 10 }).ok).toBe(false);
  });
  it('rejects NaN', () => {
    expect(validateRect({ x: NaN, y: 0, w: 10, h: 10 }).ok).toBe(false);
  });
  it('rejects Infinity', () => {
    expect(validateRect({ x: 0, y: Infinity, w: 10, h: 10 }).ok).toBe(false);
  });
  it('rejects non-object', () => {
    expect(validateRect(null).ok).toBe(false);
    expect(validateRect('rect').ok).toBe(false);
  });
  it('rejects missing field', () => {
    expect(validateRect({ x: 0, y: 0, w: 10 }).ok).toBe(false);
  });
});

describe('validateBackgroundField', () => {
  it('accepts a valid background field', () => {
    expect(validateBackgroundField({ id: 'f1', name: 'Field', rect: validRect }).ok).toBe(true);
  });
  it('rejects when id is missing', () => {
    expect(validateBackgroundField({ name: 'Field', rect: validRect }).ok).toBe(false);
  });
  it('rejects when name is empty', () => {
    expect(validateBackgroundField({ id: 'f1', name: '', rect: validRect }).ok).toBe(false);
  });
  it('rejects when rect is invalid', () => {
    expect(validateBackgroundField({ id: 'f1', name: 'F', rect: { x: 0, y: 0, w: -1, h: 0 } }).ok).toBe(false);
  });
});

describe('validateButton', () => {
  it('accepts a valid button', () => {
    expect(validateButton(validButton).ok).toBe(true);
  });
  it('rejects unknown style', () => {
    expect(validateButton({ ...validButton, style: 'neon' }).ok).toBe(false);
  });
  it('rejects missing rect', () => {
    const { rect: _r, ...noRect } = validButton;
    expect(validateButton(noRect).ok).toBe(false);
  });
  it('rejects when script is a number', () => {
    expect(validateButton({ ...validButton, script: 42 }).ok).toBe(false);
  });
});

describe('validateField', () => {
  it('accepts a valid field', () => {
    expect(validateField(validField).ok).toBe(true);
  });
  it('rejects when text is missing', () => {
    const { text: _t, ...noText } = validField;
    expect(validateField(noText).ok).toBe(false);
  });
  it('accepts empty text string', () => {
    expect(validateField({ ...validField, text: '' }).ok).toBe(true);
  });
});

describe('validateBackground', () => {
  it('accepts a valid background with no fields', () => {
    expect(validateBackground(validBackground).ok).toBe(true);
  });
  it('rejects when fields is not an array', () => {
    expect(validateBackground({ ...validBackground, fields: 'nope' }).ok).toBe(false);
  });
  it('propagates nested bgField errors', () => {
    const badBgField = { id: 'f', name: 'F', rect: { x: 0, y: 0, w: -1, h: 0 } };
    expect(validateBackground({ ...validBackground, fields: [badBgField] }).ok).toBe(false);
  });
});

describe('validateCard', () => {
  it('accepts a valid card without bgId check', () => {
    expect(validateCard(validCard).ok).toBe(true);
  });
  it('rejects when backgroundId is missing', () => {
    const { backgroundId: _bid, ...noId } = validCard;
    expect(validateCard(noId).ok).toBe(false);
  });
  it('rejects when backgroundId is not in the provided bgIds set', () => {
    const bgIds = new Set(['other-bg']);
    expect(validateCard(validCard, bgIds).ok).toBe(false);
  });
  it('accepts when backgroundId is in the provided bgIds set', () => {
    const bgIds = new Set(['bg-1']);
    expect(validateCard(validCard, bgIds).ok).toBe(true);
  });
  it('rejects when buttons is not an array', () => {
    expect(validateCard({ ...validCard, buttons: null }).ok).toBe(false);
  });
});

describe('validateMetadata', () => {
  it('accepts valid metadata', () => {
    expect(validateMetadata(validMetadata).ok).toBe(true);
  });
  it('rejects when createdAt is empty', () => {
    expect(validateMetadata({ createdAt: '', modifiedAt: '2024-01-01T00:00:00.000Z' }).ok).toBe(false);
  });
  it('rejects when modifiedAt is missing', () => {
    expect(validateMetadata({ createdAt: '2024-01-01T00:00:00.000Z' }).ok).toBe(false);
  });
  it('rejects non-object', () => {
    expect(validateMetadata(null).ok).toBe(false);
  });
});
