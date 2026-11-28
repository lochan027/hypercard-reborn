/**
 * Property-based tests for the structural validator.
 *
 * Property 5: Validator rejects invalid Rect geometry
 * Validates: Requirements 2.7
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateStack } from '../stack-validate';

// ---------------------------------------------------------------------------
// Arbitraries for valid building blocks
// ---------------------------------------------------------------------------

/** A valid finite-integer coordinate (positive and negative). */
const finiteIntArb = fc.integer({ min: -10_000, max: 10_000 });

/** A valid non-negative dimension. */
const nonNegIntArb = fc.integer({ min: 0, max: 10_000 });

/** A valid Rect. */
const validRectArb = fc.record({
  x: finiteIntArb,
  y: finiteIntArb,
  w: nonNegIntArb,
  h: nonNegIntArb,
});

/** A non-empty string id/name. */
const idArb = fc.string({ minLength: 1, maxLength: 20 });

/** A valid ButtonStyle. */
const buttonStyleArb = fc.constantFrom(
  'default' as const,
  'transparent' as const,
  'checkbox' as const,
  'radio' as const,
);

/** A valid Button (with valid Rect). */
const validButtonArb = fc.record({
  id: idArb,
  name: idArb,
  rect: validRectArb,
  style: buttonStyleArb,
});

/** A valid Field (with valid Rect). */
const validFieldArb = fc.record({
  id: idArb,
  name: idArb,
  rect: validRectArb,
  text: fc.string(),
});

/** A valid BackgroundField (with valid Rect). */
const validBgFieldArb = fc.record({
  id: idArb,
  name: idArb,
  rect: validRectArb,
});

/** A valid Background (with valid BackgroundFields). */
const validBackgroundArb = fc.record({
  id: idArb,
  name: idArb,
  fields: fc.array(validBgFieldArb, { maxLength: 3 }),
});

/** A valid StackMetadata. */
const validMetadataArb = fc.record({
  createdAt: fc.constant(new Date().toISOString()),
  modifiedAt: fc.constant(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Invalid Rect geometry arbitraries
// ---------------------------------------------------------------------------

/**
 * An invalid Rect coordinate: a float, NaN, Infinity, or -Infinity.
 * None of these are finite integers.
 */
const nonIntegerCoordArb: fc.Arbitrary<number> = fc.oneof(
  // Float that is definitely not an integer — add 0.5 to any integer sample
  fc.integer({ min: -1000, max: 1000 }).map((n) => n + 0.5),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
);

/**
 * A Rect with at least one coordinate that is not a finite integer.
 * Randomly corrupt one of the four fields.
 */
const invalidCoordRectArb: fc.Arbitrary<Record<string, unknown>> = fc
  .record({
    base: validRectArb,
    badValue: nonIntegerCoordArb,
    field: fc.constantFrom('x' as const, 'y' as const, 'w' as const, 'h' as const),
  })
  .map(({ base, badValue, field }) => ({ ...base, [field]: badValue }));

/**
 * A Rect with negative w or h (or both). The coordinates x and y remain valid;
 * only dimensions are made negative.
 */
const negativeDimRectArb: fc.Arbitrary<Record<string, unknown>> = fc
  .record({
    base: validRectArb,
    whichDim: fc.constantFrom('w' as const, 'h' as const, 'both' as const),
    negW: fc.integer({ min: -10_000, max: -1 }),
    negH: fc.integer({ min: -10_000, max: -1 }),
  })
  .map(({ base, whichDim, negW, negH }) => {
    if (whichDim === 'w') return { ...base, w: negW };
    if (whichDim === 'h') return { ...base, h: negH };
    return { ...base, w: negW, h: negH };
  });

/** Either invalid-coordinate or negative-dimension Rect. */
const invalidRectArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  invalidCoordRectArb,
  negativeDimRectArb,
);

// ---------------------------------------------------------------------------
// Helpers that inject an invalid Rect into a stack-shaped object
// ---------------------------------------------------------------------------

/**
 * Build a minimal but otherwise valid stack, then replace one Rect in a
 * randomly chosen location (button, card field, or background field) with
 * an invalid one.
 */
function makeStackWithInvalidRect(
  bg: { id: string; name: string; fields: { id: string; name: string; rect: Record<string, unknown> }[] },
  card: {
    id: string;
    name: string;
    backgroundId: string;
    buttons: { id: string; name: string; rect: Record<string, unknown>; style: string }[];
    fields: { id: string; name: string; rect: Record<string, unknown>; text: string }[];
  },
  meta: { createdAt: string; modifiedAt: string },
): unknown {
  return {
    id: 'stack-1',
    name: 'Test Stack',
    backgrounds: [bg],
    cards: [card],
    currentCardIndex: 0,
    metadata: meta,
  };
}

// ---------------------------------------------------------------------------
// Property 5: Validator rejects invalid Rect geometry
// ---------------------------------------------------------------------------

describe('Property 5 — Validator rejects invalid Rect geometry', () => {
  /**
   * Sub-property 5a: invalid Rect on a Button rejects the stack.
   */
  it('5a — rejects stack when a Button contains an invalid Rect', () => {
    const arb = fc.tuple(
      validBackgroundArb,
      fc.record({
        id: idArb,
        name: idArb,
        bgId: idArb,
      }),
      validFieldArb,
      fc.record({ id: idArb, name: idArb, style: buttonStyleArb }),
      invalidRectArb,
      validMetadataArb,
    );

    fc.assert(
      fc.property(arb, ([bg, cardBase, cardField, btnBase, badRect, meta]) => {
        const bgWithId = { ...bg, id: cardBase.bgId };
        const card = {
          id: cardBase.id,
          name: cardBase.name,
          backgroundId: cardBase.bgId,
          buttons: [{ ...btnBase, rect: badRect }],
          fields: [cardField],
        };
        const stack = makeStackWithInvalidRect(bgWithId, card, meta);
        const result = validateStack(stack);
        return result.ok === false;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Sub-property 5b: invalid Rect on a card Field rejects the stack.
   */
  it('5b — rejects stack when a card Field contains an invalid Rect', () => {
    const arb = fc.tuple(
      validBackgroundArb,
      fc.record({ id: idArb, name: idArb, bgId: idArb }),
      validButtonArb,
      fc.record({ id: idArb, name: idArb }),
      invalidRectArb,
      validMetadataArb,
    );

    fc.assert(
      fc.property(arb, ([bg, cardBase, btn, fieldBase, badRect, meta]) => {
        const bgWithId = { ...bg, id: cardBase.bgId };
        const card = {
          id: cardBase.id,
          name: cardBase.name,
          backgroundId: cardBase.bgId,
          buttons: [btn],
          fields: [{ ...fieldBase, rect: badRect, text: '' }],
        };
        const stack = makeStackWithInvalidRect(bgWithId, card, meta);
        const result = validateStack(stack);
        return result.ok === false;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Sub-property 5c: invalid Rect on a BackgroundField rejects the stack.
   */
  it('5c — rejects stack when a BackgroundField contains an invalid Rect', () => {
    const arb = fc.tuple(
      fc.record({ bgId: idArb, bgName: idArb }),
      fc.record({ id: idArb, name: idArb }),
      invalidRectArb,
      fc.record({ id: idArb, name: idArb, bgId: idArb }),
      validButtonArb,
      validFieldArb,
      validMetadataArb,
    );

    fc.assert(
      fc.property(
        arb,
        ([bgBase, bgFieldBase, badRect, cardBase, btn, field, meta]) => {
          const bg = {
            id: bgBase.bgId,
            name: bgBase.bgName,
            fields: [{ ...bgFieldBase, rect: badRect }],
          };
          const card = {
            id: cardBase.id,
            name: cardBase.name,
            backgroundId: bgBase.bgId,
            buttons: [btn],
            fields: [field],
          };
          const stack = makeStackWithInvalidRect(bg, card, meta);
          const result = validateStack(stack);
          return result.ok === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Validator rejects broken backgroundId references
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe('Property 6 — Validator rejects broken backgroundId references', () => {
  /**
   * Generate a valid stack that has at least one card whose `backgroundId`
   * is guaranteed not to match any background `id` in the stack.
   *
   * Strategy: build a fully valid stack, then replace at least one card's
   * `backgroundId` with a string constructed by appending "-invalid" to its
   * original value. Because background ids are constrained to `idArb`
   * (maxLength 20) this suffix cannot already exist in `backgrounds`.
   */
  it('6 — rejects stack when any card has a backgroundId with no matching background', () => {
    const validCardArb = fc.record({
      id: idArb,
      name: idArb,
      buttons: fc.array(validButtonArb, { maxLength: 3 }),
      fields: fc.array(validFieldArb, { maxLength: 3 }),
    });

    const arb = fc.tuple(
      // 1-3 backgrounds
      fc.array(validBackgroundArb, { minLength: 1, maxLength: 3 }),
      // 1-3 cards (before backgroundId injection)
      fc.array(validCardArb, { minLength: 1, maxLength: 3 }),
      // Which card index gets the broken backgroundId
      fc.integer({ min: 0, max: 2 }),
      validMetadataArb,
    );

    fc.assert(
      fc.property(arb, ([backgrounds, cardBases, brokenIdx, metadata]) => {
        const bgIds = backgrounds.map((bg) => bg.id);

        // Assign valid backgroundIds first (cycle through available bgs)
        const cards = cardBases.map((cardBase, i) => ({
          ...cardBase,
          backgroundId: bgIds[i % bgIds.length],
        }));

        // Replace the card at `brokenIdx % cards.length` with a dangling backgroundId.
        // The suffix "-invalid" can never appear in an id generated by idArb
        // (which uses maxLength 20 and plain alphanumeric characters), so this
        // is guaranteed to be absent from `backgrounds`.
        const targetIdx = brokenIdx % cards.length;
        const brokenCards = cards.map((card, i) =>
          i === targetIdx
            ? { ...card, backgroundId: card.backgroundId + '-invalid' }
            : card,
        );

        const stack = {
          id: 'stack-broken-ref',
          name: 'Broken Ref Stack',
          backgrounds,
          cards: brokenCards,
          currentCardIndex: 0,
          metadata,
        };

        const result = validateStack(stack);
        return result.ok === false;
      }),
      { numRuns: 100 },
    );
  });
});
