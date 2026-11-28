import { describe, it, expect } from 'vitest';
import {
  getFieldText,
  setFieldText,
  currentCard,
  navigateTo,
  navigateNext,
  navigatePrev,
} from '../stack-runtime';
import type { Stack } from '../stack-types';

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

function makeStack(overrides?: Partial<Stack>): Stack {
  return {
    id: 'stack-1',
    name: 'Test Stack',
    backgrounds: [{ id: 'bg-1', name: 'Main', fields: [] }],
    cards: [
      {
        id: 'card-1',
        name: 'Card One',
        backgroundId: 'bg-1',
        buttons: [],
        fields: [
          {
            id: 'fld-1',
            name: 'Title',
            rect: { x: 0, y: 0, w: 100, h: 20 },
            text: 'Hello',
          },
          {
            id: 'fld-2',
            name: 'Body',
            rect: { x: 0, y: 30, w: 100, h: 60 },
            text: 'World',
          },
        ],
      },
      {
        id: 'card-2',
        name: 'Card Two',
        backgroundId: 'bg-1',
        buttons: [],
        fields: [],
      },
    ],
    currentCardIndex: 0,
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      modifiedAt: '2024-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function makeSingleCardStack(): Stack {
  return { ...makeStack(), cards: [makeStack().cards[0]], currentCardIndex: 0 };
}

function makeEmptyStack(): Stack {
  return { ...makeStack(), cards: [], currentCardIndex: 0 };
}

// ---------------------------------------------------------------------------
// getFieldText
// ---------------------------------------------------------------------------

describe('getFieldText', () => {
  it('returns ok(field.text) for valid card and field ids', () => {
    const stack = makeStack();
    const result = getFieldText(stack, 'card-1', 'fld-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('Hello');
  });

  it('returns ok for the second field on a card', () => {
    const stack = makeStack();
    const result = getFieldText(stack, 'card-1', 'fld-2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('World');
  });

  it('returns err when card id does not exist', () => {
    const stack = makeStack();
    const result = getFieldText(stack, 'no-such-card', 'fld-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no-such-card');
  });

  it('returns err when field id does not exist on a valid card', () => {
    const stack = makeStack();
    const result = getFieldText(stack, 'card-1', 'no-such-field');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no-such-field');
  });

  it('does not mutate the stack', () => {
    const stack = makeStack();
    const before = JSON.stringify(stack);
    getFieldText(stack, 'card-1', 'fld-1');
    expect(JSON.stringify(stack)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// setFieldText
// ---------------------------------------------------------------------------

describe('setFieldText', () => {
  it('returns ok(newStack) with the updated text', () => {
    const stack = makeStack();
    const result = setFieldText(stack, 'card-1', 'fld-1', 'Updated');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const updatedField = result.value.cards[0].fields.find((f) => f.id === 'fld-1');
      expect(updatedField?.text).toBe('Updated');
    }
  });

  it('leaves all other fields untouched', () => {
    const stack = makeStack();
    const result = setFieldText(stack, 'card-1', 'fld-1', 'Updated');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const otherField = result.value.cards[0].fields.find((f) => f.id === 'fld-2');
      expect(otherField?.text).toBe('World');
    }
  });

  it('leaves the original stack unchanged (immutability)', () => {
    const stack = makeStack();
    const before = JSON.stringify(stack);
    setFieldText(stack, 'card-1', 'fld-1', 'Updated');
    expect(JSON.stringify(stack)).toBe(before);
  });

  it('accepts empty string as the new text', () => {
    const stack = makeStack();
    const result = setFieldText(stack, 'card-1', 'fld-1', '');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cards[0].fields[0].text).toBe('');
    }
  });

  it('returns err when card id does not exist', () => {
    const stack = makeStack();
    const result = setFieldText(stack, 'no-such-card', 'fld-1', 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no-such-card');
  });

  it('leaves the original stack unchanged on unknown card id', () => {
    const stack = makeStack();
    const before = JSON.stringify(stack);
    setFieldText(stack, 'no-such-card', 'fld-1', 'x');
    expect(JSON.stringify(stack)).toBe(before);
  });

  it('returns err when field id does not exist on a valid card', () => {
    const stack = makeStack();
    const result = setFieldText(stack, 'card-1', 'no-such-field', 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no-such-field');
  });

  it('leaves the original stack unchanged on unknown field id', () => {
    const stack = makeStack();
    const before = JSON.stringify(stack);
    setFieldText(stack, 'card-1', 'no-such-field', 'x');
    expect(JSON.stringify(stack)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// navigateTo
// ---------------------------------------------------------------------------

describe('navigateTo', () => {
  it('returns ok(newStack) with the correct currentCardIndex for the first card', () => {
    const stack = makeStack();
    const result = navigateTo(stack, 'card-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(0);
  });

  it('returns ok(newStack) with the correct currentCardIndex for the second card', () => {
    const stack = makeStack();
    const result = navigateTo(stack, 'card-2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(1);
  });

  it('leaves the original stack unchanged', () => {
    const stack = makeStack();
    const before = JSON.stringify(stack);
    navigateTo(stack, 'card-2');
    expect(JSON.stringify(stack)).toBe(before);
  });

  it('returns err when card id does not exist', () => {
    const stack = makeStack();
    const result = navigateTo(stack, 'no-such-card');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('no-such-card');
  });
});

// ---------------------------------------------------------------------------
// navigateNext / navigatePrev — empty stack
// ---------------------------------------------------------------------------

describe('navigateNext on empty stack', () => {
  it('returns err', () => {
    const result = navigateNext(makeEmptyStack());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBeTruthy();
  });
});

describe('navigatePrev on empty stack', () => {
  it('returns err', () => {
    const result = navigatePrev(makeEmptyStack());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// navigateNext / navigatePrev — single-card stack (index stays at 0)
// ---------------------------------------------------------------------------

describe('navigateNext on a single-card stack', () => {
  it('stays at index 0', () => {
    const stack = makeSingleCardStack();
    const result = navigateNext(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(0);
  });
});

describe('navigatePrev on a single-card stack', () => {
  it('stays at index 0', () => {
    const stack = makeSingleCardStack();
    const result = navigatePrev(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// navigateNext / navigatePrev — two-card wrap-around
// ---------------------------------------------------------------------------

describe('navigateNext on a two-card stack', () => {
  it('advances from index 0 to 1', () => {
    const stack = makeStack(); // currentCardIndex: 0, 2 cards
    const result = navigateNext(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(1);
  });

  it('wraps around from the last card (index 1) back to index 0', () => {
    const stack = { ...makeStack(), currentCardIndex: 1 };
    const result = navigateNext(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(0);
  });
});

describe('navigatePrev on a two-card stack', () => {
  it('goes back from index 1 to 0', () => {
    const stack = { ...makeStack(), currentCardIndex: 1 };
    const result = navigatePrev(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(0);
  });

  it('wraps around from index 0 to the last card (index 1)', () => {
    const stack = makeStack(); // currentCardIndex: 0, 2 cards
    const result = navigatePrev(stack);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentCardIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// currentCard
// ---------------------------------------------------------------------------

describe('currentCard', () => {
  it('returns the card at currentCardIndex', () => {
    const stack = makeStack();
    const card = currentCard(stack);
    expect(card.id).toBe('card-1');
  });

  it('returns the second card when currentCardIndex is 1', () => {
    const stack = { ...makeStack(), currentCardIndex: 1 };
    const card = currentCard(stack);
    expect(card.id).toBe('card-2');
  });
});
