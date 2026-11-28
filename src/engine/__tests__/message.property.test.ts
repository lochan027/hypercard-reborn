/**
 * Property-based tests for message dispatch bubbling order.
 *
 * Property 1: Message bubbling order
 * For any valid stack where a handler is defined at exactly one level,
 * dispatchMessage returns handledBy equal to that level.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { dispatchMessage } from '../message';
import type { Stack, Card, Button, Field, Background, Rect } from '../stack-types';
import type { MessageTarget, HyperTalkMessage } from '../message';
import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Non-empty alphanumeric id */
const idArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z0-9]{3,8}$/)
  .filter((s) => s.length > 0);

/** Non-empty display name */
const nameArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,10}$/)
  .filter((s) => s.trim().length > 0);

/** Valid Rect with non-negative dimensions */
const rectArb: fc.Arbitrary<Rect> = fc.record({
  x: fc.integer({ min: 0, max: 500 }),
  y: fc.integer({ min: 0, max: 500 }),
  w: fc.integer({ min: 1, max: 300 }),
  h: fc.integer({ min: 1, max: 300 }),
});

/** A handler name that is a safe identifier (no special chars) */
const handlerNameArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z]{2,8}$/)
  .filter((s) => s.length > 0);

/** Produce the HyperTalk source for a handler */
function makeHandlerScript(handlerName: string): string {
  return `on ${handlerName}\nend ${handlerName}`;
}

// ---------------------------------------------------------------------------
// Object arbitraries
// ---------------------------------------------------------------------------

function buttonArb(id: string): fc.Arbitrary<Button> {
  return fc.record({
    id: fc.constant(id),
    name: nameArb,
    rect: rectArb,
    style: fc.constantFrom('default' as const, 'transparent' as const),
    script: fc.constant(undefined as string | undefined),
  });
}

function fieldArb(id: string): fc.Arbitrary<Field> {
  return fc.record({
    id: fc.constant(id),
    name: nameArb,
    rect: rectArb,
    text: fc.constant(''),
    script: fc.constant(undefined as string | undefined),
  });
}

function backgroundArb(bgId: string, script?: string): fc.Arbitrary<Background> {
  return fc.record({
    id: fc.constant(bgId),
    name: nameArb,
    fields: fc.constant([]),
    script: fc.constant(script),
  });
}

// ---------------------------------------------------------------------------
// Stack builder helpers
// ---------------------------------------------------------------------------

interface ScriptSet {
  objectScript: string | undefined;
  cardScript: string | undefined;
  bgScript: string | undefined;
  stackScript: string | undefined;
}

/** Build a minimal valid stack with one card, one button, using provided scripts */
function buildStackWithButton(
  ids: { stackId: string; bgId: string; cardId: string; btnId: string },
  scripts: ScriptSet,
): Stack {
  const now = new Date().toISOString();
  return {
    id: ids.stackId,
    name: 'TestStack',
    backgrounds: [
      {
        id: ids.bgId,
        name: 'MainBg',
        fields: [],
        script: scripts.bgScript,
      },
    ],
    cards: [
      {
        id: ids.cardId,
        name: 'Card1',
        backgroundId: ids.bgId,
        script: scripts.cardScript,
        buttons: [
          {
            id: ids.btnId,
            name: 'Btn1',
            rect: { x: 10, y: 10, w: 80, h: 30 },
            style: 'default',
            script: scripts.objectScript,
          },
        ],
        fields: [],
      },
    ],
    currentCardIndex: 0,
    script: scripts.stackScript,
    metadata: { createdAt: now, modifiedAt: now },
  };
}

/** Build a minimal valid stack with one card, one field, using provided scripts */
function buildStackWithField(
  ids: { stackId: string; bgId: string; cardId: string; fldId: string },
  scripts: ScriptSet,
): Stack {
  const now = new Date().toISOString();
  return {
    id: ids.stackId,
    name: 'TestStack',
    backgrounds: [
      {
        id: ids.bgId,
        name: 'MainBg',
        fields: [],
        script: scripts.bgScript,
      },
    ],
    cards: [
      {
        id: ids.cardId,
        name: 'Card1',
        backgroundId: ids.bgId,
        script: scripts.cardScript,
        buttons: [],
        fields: [
          {
            id: ids.fldId,
            name: 'Fld1',
            rect: { x: 10, y: 50, w: 200, h: 20 },
            text: '',
            script: scripts.objectScript,
          },
        ],
      },
    ],
    currentCardIndex: 0,
    script: scripts.stackScript,
    metadata: { createdAt: now, modifiedAt: now },
  };
}

// ---------------------------------------------------------------------------
// Id tuple arbitraries (all distinct to avoid accidental cross-matching)
// ---------------------------------------------------------------------------

const buttonIdsArb = fc
  .tuple(idArb, idArb, idArb, idArb)
  .filter(([a, b, c, d]) => new Set([a, b, c, d]).size === 4)
  .map(([stackId, bgId, cardId, btnId]) => ({ stackId, bgId, cardId, btnId }));

const fieldIdsArb = fc
  .tuple(idArb, idArb, idArb, idArb)
  .filter(([a, b, c, d]) => new Set([a, b, c, d]).size === 4)
  .map(([stackId, bgId, cardId, fldId]) => ({ stackId, bgId, cardId, fldId }));

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('dispatchMessage — Property 1: Message bubbling order', () => {
  /**
   * Property 1a: Handler at object (button) level
   * When the button script has the handler and no higher level does,
   * dispatchMessage must return handledBy === 'button'.
   * Validates: Requirement 3.2
   */
  it('Property 1a — handler at button level: handledBy === "button"', () => {
    fc.assert(
      fc.property(buttonIdsArb, handlerNameArb, (ids, handlerName) => {
        const stack = buildStackWithButton(ids, {
          objectScript: makeHandlerScript(handlerName),
          cardScript: undefined,
          bgScript: undefined,
          stackScript: undefined,
        });

        const target: MessageTarget = {
          kind: 'button',
          cardId: ids.cardId,
          objectId: ids.btnId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handlerName).toBe(handlerName);
        expect(result.handledBy).toBe('button');
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1b: Handler at object (field) level
   * When the field script has the handler and no higher level does,
   * dispatchMessage must return handledBy === 'field'.
   * Validates: Requirement 3.2
   */
  it('Property 1b — handler at field level: handledBy === "field"', () => {
    fc.assert(
      fc.property(fieldIdsArb, handlerNameArb, (ids, handlerName) => {
        const stack = buildStackWithField(ids, {
          objectScript: makeHandlerScript(handlerName),
          cardScript: undefined,
          bgScript: undefined,
          stackScript: undefined,
        });

        const target: MessageTarget = {
          kind: 'field',
          cardId: ids.cardId,
          objectId: ids.fldId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handlerName).toBe(handlerName);
        expect(result.handledBy).toBe('field');
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1c: Handler at card level only
   * Button script absent, card script has the handler.
   * dispatchMessage must return handledBy === 'card'.
   * Validates: Requirement 3.3
   */
  it('Property 1c — handler at card level only: handledBy === "card"', () => {
    fc.assert(
      fc.property(buttonIdsArb, handlerNameArb, (ids, handlerName) => {
        const stack = buildStackWithButton(ids, {
          objectScript: undefined,
          cardScript: makeHandlerScript(handlerName),
          bgScript: undefined,
          stackScript: undefined,
        });

        const target: MessageTarget = {
          kind: 'button',
          cardId: ids.cardId,
          objectId: ids.btnId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handlerName).toBe(handlerName);
        expect(result.handledBy).toBe('card');
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1d: Handler at background level only
   * Button and card scripts absent; background script has the handler.
   * dispatchMessage must return handledBy === 'background'.
   * Validates: Requirement 3.4
   */
  it('Property 1d — handler at background level only: handledBy === "background"', () => {
    fc.assert(
      fc.property(buttonIdsArb, handlerNameArb, (ids, handlerName) => {
        const stack = buildStackWithButton(ids, {
          objectScript: undefined,
          cardScript: undefined,
          bgScript: makeHandlerScript(handlerName),
          stackScript: undefined,
        });

        const target: MessageTarget = {
          kind: 'button',
          cardId: ids.cardId,
          objectId: ids.btnId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handlerName).toBe(handlerName);
        expect(result.handledBy).toBe('background');
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1e: Handler at stack level only
   * Button, card, and background scripts absent; stack script has the handler.
   * dispatchMessage must return handledBy === 'stack'.
   * Validates: Requirement 3.5
   */
  it('Property 1e — handler at stack level only: handledBy === "stack"', () => {
    fc.assert(
      fc.property(buttonIdsArb, handlerNameArb, (ids, handlerName) => {
        const stack = buildStackWithButton(ids, {
          objectScript: undefined,
          cardScript: undefined,
          bgScript: undefined,
          stackScript: makeHandlerScript(handlerName),
        });

        const target: MessageTarget = {
          kind: 'button',
          cardId: ids.cardId,
          objectId: ids.btnId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handlerName).toBe(handlerName);
        expect(result.handledBy).toBe('stack');
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 1f: Object-level handler takes precedence over all higher levels
   * When handlers exist at all four levels, the object (button) must win.
   * Validates: Requirement 3.2
   */
  it('Property 1f — object handler wins when all levels have handler', () => {
    fc.assert(
      fc.property(buttonIdsArb, handlerNameArb, (ids, handlerName) => {
        const handler = makeHandlerScript(handlerName);
        const stack = buildStackWithButton(ids, {
          objectScript: handler,
          cardScript: handler,
          bgScript: handler,
          stackScript: handler,
        });

        const target: MessageTarget = {
          kind: 'button',
          cardId: ids.cardId,
          objectId: ids.btnId,
        };
        const message: HyperTalkMessage = { handlerName, args: [] };
        const result = dispatchMessage(target, message, stack);

        expect(result.handled).toBe(true);
        expect(result.handledBy).toBe('button');
      }),
      { numRuns: 50 },
    );
  });
});
