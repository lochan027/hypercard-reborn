/**
 * Property-based tests for the stack runtime API.
 *
 * Property 3: Navigation stays in bounds
 * Validates: Requirements 5.5, 5.6, 5.8, 5.9
 *
 * Property 4: setFieldText is immutable and targeted
 * Validates: Requirements 4.5, 4.6, 4.7, 4.8
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { setFieldText, navigateNext, navigatePrev } from '../stack-runtime';
import type { Stack, Card, Background, Button, Field, Rect } from '../stack-types';

// ── Arbitraries ───────────────────────────────────────────────────────────────

const rectArb: fc.Arbitrary<Rect> = fc.record({
  x: fc.integer({ min: 0, max: 1000 }),
  y: fc.integer({ min: 0, max: 1000 }),
  w: fc.integer({ min: 0, max: 500 }),
  h: fc.integer({ min: 0, max: 500 }),
});

const idArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z0-9]{2,7}$/)
  .filter((s) => s.length > 0);

const buttonArb: fc.Arbitrary<Button> = fc.record({
  id: idArb,
  name: idArb,
  rect: rectArb,
  style: fc.constantFrom('default', 'transparent', 'checkbox', 'radio') as fc.Arbitrary<Button['style']>,
  script: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
});

const fieldArb: fc.Arbitrary<Field> = fc.record({
  id: idArb,
  name: idArb,
  rect: rectArb,
  text: fc.string({ maxLength: 50 }),
  script: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
});

const backgroundArb: fc.Arbitrary<Background> = fc.record({
  id: idArb,
  name: idArb,
  script: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  fields: fc.array(
    fc.record({ id: idArb, name: idArb, rect: rectArb }),
    { maxLength: 3 },
  ),
});

/**
 * Generates a valid card with at least one field.
 * The backgroundId is passed in so we can wire it to a real background.
 */
function cardWithFieldsArb(backgroundId: string): fc.Arbitrary<Card> {
  return fc.record({
    id: idArb,
    name: idArb,
    backgroundId: fc.constant(backgroundId),
    script: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
    buttons: fc.array(buttonArb, { maxLength: 3 }),
    // minLength 1: the card must carry at least one field
    fields: fc.array(fieldArb, { minLength: 1, maxLength: 4 }),
  });
}

/**
 * Generates a valid Stack that has:
 * - at least one background
 * - at least one card (tied to that background)
 * - at least one field on the first card
 *
 * Returns the stack along with the first card's id and a randomly-chosen
 * field id on that card so the test can target them directly.
 */
const stackWithFieldArb: fc.Arbitrary<{
  stack: Stack;
  cardId: string;
  fieldId: string;
}> = fc
  .tuple(
    backgroundArb,
    // Extra backgrounds beyond the first (optional)
    fc.array(backgroundArb, { maxLength: 2 }),
  )
  .chain(([primaryBg, extraBgs]) => {
    const backgrounds = [primaryBg, ...extraBgs];
    return fc
      .tuple(
        cardWithFieldsArb(primaryBg.id),
        // Additional cards on any background
        fc.array(
          fc
            .integer({ min: 0, max: backgrounds.length - 1 })
            .chain((bgIdx) => cardWithFieldsArb(backgrounds[bgIdx].id)),
          { maxLength: 3 },
        ),
      )
      .chain(([primaryCard, extraCards]) => {
        const cards = [primaryCard, ...extraCards];
        // Pick a random field index on the primary card
        return fc
          .integer({ min: 0, max: primaryCard.fields.length - 1 })
          .map((fieldIdx) => ({
            stack: {
              id: 'stack-prop-test',
              name: 'PropTestStack',
              backgrounds,
              cards,
              currentCardIndex: 0,
              metadata: {
                createdAt: '2024-01-01T00:00:00.000Z',
                modifiedAt: '2024-01-01T00:00:00.000Z',
              },
            } satisfies Stack,
            cardId: primaryCard.id,
            fieldId: primaryCard.fields[fieldIdx].id,
          }));
      });
  });

/**
 * Generates a valid Stack with at least one card.
 * Cards are allowed to have zero fields — we only need navigation to work.
 */
const stackWithCardsArb: fc.Arbitrary<Stack> = fc
  .tuple(
    backgroundArb,
    fc.array(backgroundArb, { maxLength: 2 }),
  )
  .chain(([primaryBg, extraBgs]) => {
    const backgrounds = [primaryBg, ...extraBgs];
    return fc
      .array(
        fc
          .integer({ min: 0, max: backgrounds.length - 1 })
          .chain((bgIdx) =>
            fc.record({
              id: idArb,
              name: idArb,
              backgroundId: fc.constant(backgrounds[bgIdx].id),
              script: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
              buttons: fc.array(buttonArb, { maxLength: 2 }),
              fields: fc.array(fieldArb, { maxLength: 2 }),
            }),
          ),
        // At least 1 card — the core precondition for Property 3
        { minLength: 1, maxLength: 5 },
      )
      .map(
        (cards): Stack => ({
          id: 'stack-nav-test',
          name: 'NavTestStack',
          backgrounds,
          cards,
          currentCardIndex: 0,
          metadata: {
            createdAt: '2024-01-01T00:00:00.000Z',
            modifiedAt: '2024-01-01T00:00:00.000Z',
          },
        }),
      );
  });

// ── Properties ────────────────────────────────────────────────────────────────

/**
 * Property 3: Navigation stays in bounds
 *
 * For any valid stack with ≥ 1 card, applying any sequence of
 * navigateNext / navigatePrev always keeps currentCardIndex in
 * [0, cards.length - 1] after every step.
 *
 * Validates: Requirements 5.5, 5.6, 5.8, 5.9
 */
describe('Stack runtime — Property 3: Navigation stays in bounds', () => {
  it('currentCardIndex stays in [0, cards.length - 1] after any sequence of navigateNext/navigatePrev', () => {
    fc.assert(
      fc.property(
        stackWithCardsArb,
        // true = navigateNext, false = navigatePrev; at least one step
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (initialStack, moves) => {
          let current = initialStack;

          for (const goNext of moves) {
            const result = goNext ? navigateNext(current) : navigatePrev(current);

            // Both functions must succeed — stack has ≥ 1 card
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            current = result.value;

            // Index must remain within the valid card range after every step
            expect(current.currentCardIndex).toBeGreaterThanOrEqual(0);
            expect(current.currentCardIndex).toBeLessThan(current.cards.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Stack runtime — Property 4: setFieldText is immutable and targeted', () => {
  it('setFieldText returns ok and leaves the original stack unchanged', () => {
    fc.assert(
      fc.property(
        stackWithFieldArb,
        fc.string({ maxLength: 100 }),
        ({ stack, cardId, fieldId }, newText) => {
          // Deep-clone the stack before the call to verify no mutation occurs
          const originalSnapshot = JSON.parse(JSON.stringify(stack)) as Stack;

          const result = setFieldText(stack, cardId, fieldId, newText);

          // 1. Result must be ok
          expect(result.ok).toBe(true);
          if (!result.ok) return; // narrowing for TS

          const newStack = result.value;

          // 2. Original stack is unchanged
          expect(stack).toEqual(originalSnapshot);

          // 3. The targeted field's text equals newText
          const targetCard = newStack.cards.find((c) => c.id === cardId);
          expect(targetCard).toBeDefined();
          const targetField = targetCard!.fields.find((f) => f.id === fieldId);
          expect(targetField).toBeDefined();
          expect(targetField!.text).toBe(newText);

          // 4. All other fields in newStack are identical to stack
          for (const card of newStack.cards) {
            const originalCard = stack.cards.find((c) => c.id === card.id);
            expect(originalCard).toBeDefined();

            for (const field of card.fields) {
              if (card.id === cardId && field.id === fieldId) {
                // This is the targeted field — only its text should differ
                const origField = originalCard!.fields.find((f) => f.id === field.id);
                expect(origField).toBeDefined();
                expect({ ...field, text: origField!.text }).toEqual(origField);
              } else {
                // Every other field must be identical
                const origField = originalCard!.fields.find((f) => f.id === field.id);
                expect(field).toEqual(origField);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
