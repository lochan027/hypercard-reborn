/**
 * Property-based tests for the stack serialiser.
 *
 * Property 2: Save/load round-trip
 * For any valid Stack, loadStack(saveStack(stack)) returns ok and the
 * loaded value is deeply equal to the original.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { saveStack, loadStack } from '../stack-serialise';
import type { Stack, Background, Card, Button, Field, Rect, BackgroundField } from '../stack-types';

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Non-empty string for ids and names. */
const idArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

/** Valid Rect: finite integers, w/h ≥ 0. */
const rectArb: fc.Arbitrary<Rect> = fc.record({
  x: fc.integer({ min: -10_000, max: 10_000 }),
  y: fc.integer({ min: -10_000, max: 10_000 }),
  w: fc.integer({ min: 0, max: 5_000 }),
  h: fc.integer({ min: 0, max: 5_000 }),
});

/** Valid BackgroundField. */
const bgFieldArb: fc.Arbitrary<BackgroundField> = fc.record({
  id: idArb,
  name: idArb,
  rect: rectArb,
});

/** Valid Background. */
const backgroundArb: fc.Arbitrary<Background> = fc.record({
  id: idArb,
  name: idArb,
  script: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  fields: fc.array(bgFieldArb, { maxLength: 3 }),
});

/** Valid Button. */
const buttonArb: fc.Arbitrary<Button> = fc.record({
  id: idArb,
  name: idArb,
  rect: rectArb,
  style: fc.constantFrom('default', 'transparent', 'checkbox', 'radio') as fc.Arbitrary<Button['style']>,
  script: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
});

/** Valid Field. */
const fieldArb: fc.Arbitrary<Field> = fc.record({
  id: idArb,
  name: idArb,
  rect: rectArb,
  text: fc.string({ maxLength: 100 }),
  script: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
});

/**
 * Generates a valid Card whose backgroundId is wired to a provided background id.
 */
function cardArb(backgroundId: string): fc.Arbitrary<Card> {
  return fc.record({
    id: idArb,
    name: idArb,
    backgroundId: fc.constant(backgroundId),
    script: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    buttons: fc.array(buttonArb, { maxLength: 3 }),
    fields: fc.array(fieldArb, { maxLength: 3 }),
  });
}

/**
 * Generates a fully valid Stack:
 * - at least one background
 * - 0–4 cards, each with a backgroundId that references an existing background
 * - currentCardIndex in [0, cards.length - 1] (or 0 for empty stacks)
 * - valid ISO 8601 metadata timestamps
 */
const validStackArb: fc.Arbitrary<Stack> = fc
  .array(backgroundArb, { minLength: 1, maxLength: 3 })
  .chain((backgrounds) => {
    // Each card picks one of the generated backgrounds
    const anyCardArb = fc
      .integer({ min: 0, max: backgrounds.length - 1 })
      .chain((bgIdx) => cardArb(backgrounds[bgIdx].id));

    return fc
      .array(anyCardArb, { minLength: 0, maxLength: 4 })
      .chain((cards) => {
        // currentCardIndex must be 0 when there are no cards, otherwise in [0, cards.length - 1]
        const idxArb =
          cards.length === 0
            ? fc.constant(0)
            : fc.integer({ min: 0, max: cards.length - 1 });

        return idxArb.map(
          (currentCardIndex): Stack => ({
            id: 'stack-roundtrip-test',
            name: 'Round-trip Test Stack',
            backgrounds,
            cards,
            currentCardIndex,
            script: undefined,
            metadata: {
              createdAt: '2024-01-01T00:00:00.000Z',
              modifiedAt: '2024-01-01T00:00:00.000Z',
            },
          }),
        );
      });
  });

// ── Property 2: Save/load round-trip ─────────────────────────────────────────

describe('Stack serialiser — Property 2: Save/load round-trip', () => {
  /**
   * For any valid Stack, saveStack produces a JSON string and loadStack
   * parses it back to an identical value.
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  it('loadStack(saveStack(stack)) returns ok and a deeply-equal value', () => {
    fc.assert(
      fc.property(validStackArb, (stack) => {
        // 1. Serialise
        const json = saveStack(stack);
        expect(typeof json).toBe('string');

        // 2. Deserialise
        const result = loadStack(json);

        // 3. Must succeed
        expect(
          result.ok,
          result.ok ? '' : `loadStack failed: ${result.error.message}`,
        ).toBe(true);
        if (!result.ok) return;

        // 4. Loaded value must be deeply equal to the original
        expect(result.value).toEqual(stack);
      }),
      { numRuns: 100 },
    );
  });
});
